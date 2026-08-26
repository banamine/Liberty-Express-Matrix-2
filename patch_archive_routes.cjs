const fs = require('fs');
let code = fs.readFileSync('server/archive-routes.ts', 'utf8');

// We can inject a function to log telemetry
const logFn = `
  async function logArchiveEvent(category, message, identifier) {
    try {
      const db = require('./db').getDb();
      const { telemetryEvents } = require('../shared/schema');
      const crypto = require('crypto');
      await db.insert(telemetryEvents).values({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: 'info',
        category: category,
        message: message,
        data: { identifier }
      });
    } catch(e) {}
  }
`;

if (!code.includes('logArchiveEvent')) {
  code = code.replace('export function registerArchiveRoutes(app: Express) {', logFn + '\nexport function registerArchiveRoutes(app: Express) {');
  
  // Patch import-items
  code = code.replace(
    'res.json({ message: "Import queued", imported: 1 });',
    'logArchiveEvent("queue", `Import queued: ${identifier}`, identifier);\n      res.json({ message: "Import queued", imported: 1 });'
  );
  
  // Patch tvnews/import
  code = code.replace(
    'res.json({ message: `${imported} TV News items queued`, imported });',
    'logArchiveEvent("queue", `Batch TV News items queued: ${imported} items`, "batch");\n      res.json({ message: `${imported} TV News items queued`, imported });'
  );
  
  // Patch transcript ingest
  code = code.replace(
    'res.json({ message: "Transcripts ingested", count: insertedCount });',
    'logArchiveEvent("system", `Transcripts ingested for ${identifier}`, identifier);\n      res.json({ message: "Transcripts ingested", count: insertedCount });'
  );
  
  fs.writeFileSync('server/archive-routes.ts', code);
}
