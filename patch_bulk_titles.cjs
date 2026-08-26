const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

const endpoints = `
  app.post('/api/episodes/bulk-clean-titles', async (req, res) => {
    try {
      const db = (await import("./db")).getDb();
      const { episodes } = await import("../shared/schema");
      const { inArray, eq } = await import("drizzle-orm");
      
      const { ids, pattern, flags, replacement } = req.body;
      const targetEpisodes = await db.select().from(episodes).where(inArray(episodes.id, ids));
      const re = new RegExp(pattern, flags);
      
      let updatedCount = 0;
      for (const ep of targetEpisodes) {
        const newTitle = ep.title.replace(re, replacement).replace(/\\s{2,}/g, " ").trim();
        if (newTitle !== ep.title) {
          await db.update(episodes).set({ title: newTitle }).where(eq(episodes.id, ep.id));
          updatedCount++;
        }
      }
      res.json({ success: true, updatedCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/episodes/bulk-remaster-titles', async (req, res) => {
    try {
      const db = (await import("./db")).getDb();
      const { episodes } = await import("../shared/schema");
      const { inArray, eq } = await import("drizzle-orm");
      const { sanitizeTitle } = await import("../src/lib/title-sanitizer");
      
      const { ids, dryRun } = req.body;
      const targetEpisodes = await db.select().from(episodes).where(inArray(episodes.id, ids));
      
      const previews = [];
      
      for (const ep of targetEpisodes) {
        let baseName = ep.filename || ep.title;
        let cleaned = sanitizeTitle(baseName);
        
        if (/^(s\\d+e\\d+|\\d+x\\d+)$/i.test(cleaned) && ep.groupTitle) {
          cleaned = \`\${ep.groupTitle} \${cleaned}\`;
        }
        
        if (cleaned && cleaned !== ep.title) {
          previews.push({ id: ep.id, original: ep.title, remastered: cleaned });
          if (!dryRun) {
            await db.update(episodes).set({ title: cleaned }).where(eq(episodes.id, ep.id));
          }
        }
      }
      
      res.json({ previews });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
`;

code = code.replace(
  /app\.post\('\/api\/episodes\/bulk-update'/,
  endpoints + '\n  app.post(\'/api/episodes/bulk-update\''
);

fs.writeFileSync('server/routes.ts', code);
