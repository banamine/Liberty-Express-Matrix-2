const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

if (!code.includes('const originalFetch = window.fetch;')) {
  const patch = `
import { telemetry } from './lib/telemetry';

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : 'unknown');
  
  if (url.includes('/api/telemetry') || url.includes('/api/watchdog')) {
    return originalFetch(...args);
  }

  const correlationId = crypto.randomUUID();
  telemetry.debug('network', \`Fetch started: \${url}\`, { url, correlationId });
  
  // Attach correlation ID to headers if it's a Request or we have options
  let newArgs = [...args];
  if (typeof newArgs[0] === 'string' || newArgs[0] instanceof URL) {
    newArgs[1] = newArgs[1] || {};
    newArgs[1].headers = newArgs[1].headers || {};
    newArgs[1].headers['x-correlation-id'] = correlationId;
  }
  
  const startTime = Date.now();
  try {
    const response = await originalFetch(...newArgs);
    const duration = Date.now() - startTime;
    if (!response.ok) {
      telemetry.error('network', \`Fetch failed: \${url} - \${response.status}\`, { url, status: response.status, duration, correlationId });
    } else {
      telemetry.info('network', \`Fetch succeeded: \${url}\`, { url, status: response.status, duration, correlationId });
    }
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    telemetry.error('network', \`Fetch error: \${url} - \${error.message}\`, { url, error: error.message, duration, correlationId });
    throw error;
  }
};
`;
  code = code.replace('import React from \'react\'', patch + '\nimport React from \'react\'');
  fs.writeFileSync('src/main.tsx', code);
}
