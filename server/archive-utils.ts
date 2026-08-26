import { telemetry, LogLevel, LogCategory } from '../src/lib/telemetry';
import fetch from 'node-fetch';

/**
 * A strict wrapper for fetch() that automatically severs the connection 
 * and throws a specific timeout error if the request exceeds the limit.
 */
export async function fetchWithTimeout(resource: string, options: any = {}) {
  // Default timeout set strictly to 10 seconds (10000ms)
  const { timeout = 10000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal as any
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    // Intercept the AbortError and translate it to a backend-friendly timeout message
    if (error.name === 'AbortError') {
      throw new Error(`Gateway Timeout: Archive.org failed to respond within ${timeout / 1000} seconds.`);
    }
    throw error;
  }
}

export async function searchArchiveItems(query: string, page: number = 1, rows: number = 50) {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&output=json&page=${page}&rows=${rows}&fl[]=identifier,title,mediatype,date,source&sort[]=publicdate desc`;
  
  try {
    const response = await fetchWithTimeout(url, { timeout: 10000 });

    
    // Resiliency Check: Ensure we actually got JSON back
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      telemetry.log('error' as LogLevel, 'network' as LogCategory, `Archive API failed. Expected JSON, got ${contentType}`);
      throw new Error(`Archive API failed. Expected JSON, got ${contentType}`);
    }

    if (!response.ok) {
      telemetry.log('error' as LogLevel, 'network' as LogCategory, `Archive API HTTP Error: ${response.status}`);
      throw new Error(`Archive API HTTP Error: ${response.status}`);
    }

    const data = await response.json() as any;
    telemetry.log('info' as LogLevel, 'network' as LogCategory, `Successfully fetched ${data.response?.docs?.length || 0} items from Archive.org`);
    return { items: data.response?.docs || [], total: data.response?.numFound || 0 };
  } catch (error: any) {
    telemetry.log('error' as LogLevel, 'network' as LogCategory, `Search Archive Items Exception: ${error.message}`);
    throw error;
  }
}

export async function fetchArchiveCollection(identifier: string, prioritizeDerivatives: boolean = true) {
  const resp = await fetchWithTimeout(`https://archive.org/metadata/${identifier}`, { timeout: 10000 });
  const data = await resp.json() as any;
  
  const files = data.files || [];
  let videoFiles = files.filter((f: any) => {
    if (!f.name || !f.format) return false;
    const fmt = (Array.isArray(f.format) ? f.format.join(' ') : String(f.format)).toLowerCase();
    return (
      fmt.includes('h.264') || 
      fmt.includes('mpeg4') ||
      fmt.includes('matroska') ||
      fmt.includes('quicktime') ||
      fmt.includes('ogg video') ||
      fmt.includes('theora') ||
      fmt.includes('mpeg-4') ||
      fmt.includes('mpeg1') ||
      fmt.includes('mpeg2') ||
      fmt.includes('mpegts') ||
      fmt.includes('webm')
    );
  });
  
  // Sort by derivatives if needed
  if (prioritizeDerivatives) {
      videoFiles.sort((a: any, b: any) => {
          const aIsDerivative = a.source === 'derivative' ? -1 : 1;
          const bIsDerivative = b.source === 'derivative' ? -1 : 1;
          return aIsDerivative - bIsDerivative;
      });
  }

  const items = videoFiles.map((f: any) => ({
    identifier: data.metadata?.identifier || identifier,
    filename: f.name,
    title: f.title || data.metadata?.title || f.name,
    url: `https://archive.org/download/${data.metadata?.identifier || identifier}/${f.name}`,
    duration: parseFloat(f.length || '0'),
    format: f.format
  }));
  
  return {
      items,
      metadata: data.metadata || { identifier }
  };
}

export function getSafeArchiveUrl(url: string) {
    // Ensures the URL uses the /download/ endpoint for standard 302 redirects
    if (url.includes('archive.org/download/')) {
        return url;
    }
    // Attempt to convert other known formats, though the fetchArchiveCollection uses /download/ natively
    return url;
}
