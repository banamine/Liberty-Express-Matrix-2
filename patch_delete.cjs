const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

const newEndpoint = `  // DELETE /api/archive/holding-queue
  app.delete("/api/archive/holding-queue", async (req, res) => {
    try {
      const db = getDb();
      await db.delete(archiveHoldingQueue);
      res.json({ success: true, message: "Workspace cleared" });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // GET /api/archive/holding-queue`;

if (code.includes('  // GET /api/archive/holding-queue')) {
  fs.writeFileSync('server/archive-routes.ts', code.replace('  // GET /api/archive/holding-queue', newEndpoint));
  console.log("Success");
} else {
  console.log("Target not found");
}
