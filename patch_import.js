const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

const target = `  app.post("/api/archive/import-items", async (req, res) => {
    try {
      const { items, groupTitle } = req.body;
      const db = getDb();
      let imported = 0;
      let skipped = 0;
      for (const item of items) { console.log("INSERTING ITEM:", item);
        const identifier = item.identifier;
        if (!isAllowedEntertainmentChannel(groupTitle || '', identifier)) {
          skipped++;
          continue;
        }
        if (item.sizeMB !== undefined && item.sizeMB === 0) {
          skipped++;
          continue;
        }
        const result = await db.insert(archiveHoldingQueue).values({
          identifier,
          filename: item.filename || '',
          thumbnailUrl: \`https://archive.org/services/img/\${identifier}\`,
          status: 'pending',
          pendingEpisodeJson: JSON.stringify({ groupTitle, title: item.title, thumbnailUrl: item.thumbnailUrl, sizeMB: item.sizeMB, format: item.format }),
          fileSizeBytes: item.sizeMB ? Math.floor(item.sizeMB * 1024 * 1024) : 0,
          format: item.format
        }).onConflictDoNothing({ target: archiveHoldingQueue.identifier }).returning({ id: archiveHoldingQueue.id });
        
        if (result.length > 0) {
          imported++;
        } else {
          skipped++;
        }
      }
      res.json({ message: \`\${imported} items queued\${skipped ? \` (\${skipped} skipped as duplicates or blocked)\` : ''}\`, imported, skipped });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });`;

const replacement = `  app.post("/api/archive/import-items", async (req, res) => {
    try {
      const { items, groupTitle } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      const db = getDb();

      // 1. Strict Gatekeeper: Drop zero-byte or corrupt files instantly
      const validItemsRaw = items.filter((item: any) => 
        item.sizeMB !== undefined && 
        item.sizeMB > 0 && 
        item.format !== 'Unknown' &&
        isAllowedEntertainmentChannel(groupTitle || '', item.identifier)
      );

      const droppedCount = items.length - validItemsRaw.length;

      if (validItemsRaw.length === 0) {
        return res.json({ 
          message: "Import processing complete", 
          requested: items.length,
          inserted: 0,
          duplicates: 0,
          corruptDropped: droppedCount
        });
      }

      const valuesToInsert = validItemsRaw.map((item: any) => ({
        identifier: item.identifier,
        filename: item.filename || '',
        thumbnailUrl: \`https://archive.org/services/img/\${item.identifier}\`,
        status: 'pending',
        pendingEpisodeJson: JSON.stringify({ groupTitle, title: item.title, thumbnailUrl: item.thumbnailUrl, sizeMB: item.sizeMB, format: item.format }),
        fileSizeBytes: item.sizeMB ? Math.floor(item.sizeMB * 1024 * 1024) : 0,
        format: item.format
      }));

      // 2. Perform the insert and calculate the real delta
      const { sql } = await import('drizzle-orm');
      const initialCountRes = await db.select({ count: sql<number>\`count(*)\` }).from(archiveHoldingQueue);
      const initialCount = Number(initialCountRes[0].count);

      // Insert valid items
      await db.insert(archiveHoldingQueue)
        .values(valuesToInsert)
        .onConflictDoNothing({ target: archiveHoldingQueue.identifier });

      const finalCountRes = await db.select({ count: sql<number>\`count(*)\` }).from(archiveHoldingQueue);
      const finalCount = Number(finalCountRes[0].count);

      const actualInserted = finalCount - initialCount;
      const skippedAsDuplicates = validItemsRaw.length - actualInserted;

      // 3. Return the highly accurate telemetry payload to the frontend
      res.json({ 
        message: "Import processing complete", 
        requested: items.length,
        inserted: actualInserted,
        duplicates: skippedAsDuplicates,
        corruptDropped: droppedCount
      });

    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });`;

if (code.includes(target)) {
  fs.writeFileSync('server/archive-routes.ts', code.replace(target, replacement));
  console.log("Success");
} else {
  console.log("Target not found");
}
