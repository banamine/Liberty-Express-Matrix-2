import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { telemetry } from './lib/telemetry';
import { BACKEND_URL } from './config';

// Global fetch override for Correlation ID and Network Telemetry
const originalFetch = window.fetch;
const patchedFetch = async function(resource: RequestInfo | URL, config?: RequestInit) {
  let urlStr = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : resource.toString());
  
  if (urlStr.startsWith('/')) {
    urlStr = BACKEND_URL + urlStr;
  }

  if (urlStr.includes('/api/telemetry') || urlStr.includes('/api/watchdog') || urlStr.includes('/api/probe')) {
    return originalFetch(urlStr, config);
  }

  const correlationId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  
  if (config.headers instanceof Headers) {
    config.headers.append('x-correlation-id', correlationId);
  } else if (Array.isArray(config.headers)) {
    config.headers.push(['x-correlation-id', correlationId]);
  } else {
    (config.headers as Record<string, string>)['x-correlation-id'] = correlationId;
  }
  
  const startTime = Date.now();
  try {
    const response = await originalFetch(urlStr, config);
    const duration = Date.now() - startTime;
    if (!response.ok) {
      telemetry.error('network', `[${config.method || 'GET'}] ${urlStr} - ${response.status}`, { correlationId, duration, status: response.status });
    }
    return response;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    if (err.name !== 'AbortError') {
      telemetry.error('network', `[${config.method || 'GET'}] ${urlStr} - FAILED`, { correlationId, duration, error: err.message });
    }
    throw err;
  }
};

try {
  window.fetch = patchedFetch as typeof fetch;
} catch (e) {
  try {
    Object.defineProperty(window, 'fetch', {
      value: patchedFetch,
      configurable: true,
      writable: true
    });
  } catch (err) {
    console.warn("Could not override window.fetch for telemetry:", err);
  }
}



const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
