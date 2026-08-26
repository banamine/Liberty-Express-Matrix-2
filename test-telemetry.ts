import { v4 as uuidv4 } from 'uuid';

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  length: 0,
  key: () => null,
  clear: () => {}
};

async function test() {
  const { telemetry } = await import('./src/lib/telemetry.js');
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, options: RequestInit = {}) => {
    const correlationId = uuidv4();
    const headers = new Headers(options.headers || {});
    headers.set('x-correlation-id', correlationId);
    
    try {
      const res = await originalFetch('http://localhost:3000' + url, { ...options, headers });
      telemetry.info('network', `[GET] ${url} - ${res.status}`, { correlationId, status: res.status });
      return res;
    } catch (err) {
      telemetry.error('network', `[GET] ${url} - FAILED`, { correlationId, error: err.message });
      throw err;
    }
  };

  await globalThis.fetch('/api/archive/latest');
  await new Promise(r => setTimeout(r, 2000));
  
  const events = telemetry.getEvents();
  console.log("CLIENT TELEMETRY:");
  console.log(JSON.stringify(events[events.length - 1], null, 2));

  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite('./pgdata');
  const res = await db.query('SELECT * FROM telemetry_events ORDER BY timestamp DESC LIMIT 5');
  console.log("SERVER TELEMETRY (most recent 5):");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
test();
