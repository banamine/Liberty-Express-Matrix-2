const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

const patchRoute = `
  app.patch('/api/episodes/:id', express.json(), async (req, res) => {
    try {
      const db = (await import("./db")).getDb();
      const { episodes } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const { id } = req.params;
      const updates = req.body;
      
      await db.update(episodes).set(updates).where(eq(episodes.id, id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/episodes/:id', async (req, res) => {
    try {
      const db = (await import("./db")).getDb();
      const { episodes } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const { id } = req.params;
      await db.delete(episodes).where(eq(episodes.id, id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
`;

if (!code.includes("app.patch('/api/episodes/:id'")) {
    code = code.replace(
      /app\.post\('\/api\/episodes\/bulk-update'/,
      patchRoute + '\n  app.post(\'/api/episodes/bulk-update\''
    );
    fs.writeFileSync('server/routes.ts', code);
}
