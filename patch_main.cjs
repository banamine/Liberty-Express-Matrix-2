const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const patch = `
import { telemetry } from './lib/telemetry';

// Global fetch override for Correlation ID and Network Telemetry
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  let [resource, config] = args;
  
  // Skip telemetry routes to avoid infinite recursion
  const urlStr = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
  if (urlStr.includes('/api/telemetry') || urlStr.includes('/api/watchdog')) {
    return originalFetch(...args);
  }

  // Generate correlation ID
  const correlationId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  
  // Inject header
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  
  if (config.headers instanceof Headers) {
    config.headers.append('x-correlation-id', correlationId);
  } else if (Array.isArray(config.headers)) {
    config.headers.push(['x-correlation-id', correlationId]);
  } else {
    (config.headers as any)['x-correlation-id'] = correlationId;
  }
  
  args[1] = config;
  
  const startTime = Date.now();
  try {
    const response = await originalFetch(...args);
    const duration = Date.now() - startTime;
    // Log successful client-side fetch (server also logs it, but client might see different durations)
    if (!response.ok) {
      telemetry.error('network', \`[\${config.method || 'GET'}] \${urlStr} - \${response.status}\`, { correlationId, duration, status: response.status });
    }
    return response;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    telemetry.error('network', \`[\${config.method || 'GET'}] \${urlStr} - FAILED\`, { correlationId, duration, error: err.message });
    throw err;
  }
};
`;

code = code.replace("import './index.css';", "import './index.css';" + patch);
fs.writeFileSync('src/main.tsx', code);
