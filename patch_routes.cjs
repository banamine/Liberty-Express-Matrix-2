const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

if (!code.includes('/api/telemetry')) {
  // Add telemetry route at the top of registerRoutes
  code = code.replace('export function registerRoutes(app: Express) {', `export function registerRoutes(app: Express) {
  // Telemetry middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, originalUrl } = req;
      const { statusCode } = res;
      // Exclude /api/telemetry from logging itself to avoid infinite loop
      if (originalUrl.startsWith('/api/telemetry') || originalUrl.startsWith('/api/watchdog')) return;
      
      const db = require('./db').getDb();
      const { telemetryEvents } = require('../shared/schema');
      const crypto = require('crypto');
      const correlationId = req.headers['x-correlation-id'] || null;
      
      db.insert(telemetryEvents).values({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level: statusCode >= 400 ? 'error' : 'info',
        category: 'network',
        message: \`[\${method}] \${originalUrl} - \${statusCode} (\${duration}ms)\`,
        correlationId: correlationId,
        data: { method, path: originalUrl, statusCode, duration }
      }).catch(console.error);
    });
    next();
  });

  app.post('/api/telemetry', async (req, res) => {
    try {
      const db = require('./db').getDb();
      const { telemetryEvents } = require('../shared/schema');
      const crypto = require('crypto');
      const events = req.body.events || [];
      
      if (events.length > 0) {
        const values = events.map(e => ({
          id: e.id || crypto.randomUUID(),
          timestamp: e.timestamp || Date.now(),
          level: e.level,
          category: e.category,
          message: e.message,
          data: e.data,
          correlationId: e.correlationId || null
        }));
        await db.insert(telemetryEvents).values(values);
      }
      res.json({ success: true, count: events.length });
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/telemetry', async (req, res) => {
    try {
      const db = require('./db').getDb();
      const { telemetryEvents } = require('../shared/schema');
      const { desc, gte } = require('drizzle-orm');
      
      // 24 hour retention: also delete old events on read
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const { lt } = require('drizzle-orm');
      await db.delete(telemetryEvents).where(lt(telemetryEvents.timestamp, oneDayAgo));
      
      const rows = await db.select().from(telemetryEvents).orderBy(desc(telemetryEvents.timestamp)).limit(1000);
      res.json({ events: rows });
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
`);
  fs.writeFileSync('server/routes.ts', code);
}
