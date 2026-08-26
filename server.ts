import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { registerRoutes } from './server/routes';
import { playoutEngine } from './server/ntd-playout-engine';
import { WebSocketServer } from 'ws';
import { startScheduler } from './server/scheduler';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '50mb' }));

  // Wait for DB migrations
  const { ensureDbReady } = await import('./server/db/index.ts');
  await ensureDbReady();

  // Register API routes
  registerRoutes(app);

  app.post('/api/playout/restart', (req, res) => {
    playoutEngine.manualRestart();
    res.json({ success: true });
  });

  app.post('/api/playout/swap', (req, res) => {
    const { channel } = req.body;
    playoutEngine.manualPlaylistSwap(channel);
    res.json({ success: true });
  });

  app.get('/api/build-info', (req, res) => {
    const manifestPath = path.join(process.cwd(), 'dist', 'build-manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        res.json(data);
      } catch (err) {
        res.json({ error: 'Failed to parse manifest', timestamp: new Date().toISOString() });
      }
    } else {
      res.json({
        timestamp: new Date().toISOString(),
        gitCommit: 'unknown',
        files: {},
        note: 'Manifest not generated yet (run npm run build)'
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      console.error('API Error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    } else {
      next(err);
    }
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server, path: '/api/ws' });
  playoutEngine.attachWebSocket(wss);
  
  startScheduler();

  // Handle graceful shutdown to avoid EADDRINUSE on restarts
  const shutdown = () => {
    console.log('Shutting down gracefully...');
    wss.close();
    server.close(() => {
      process.exit(0);
    });
    // Force shutdown after 2 seconds
    setTimeout(() => process.exit(1), 2000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
