import * as cheerio from 'cheerio';
import { fetchWithTimeout } from './archive-utils';

export interface DeepCrawlerResult {
  title: string;
  filename: string;
  path: string;
  url: string;
  sizeMB: number;
  format: string;
  durationSec?: number;
  thumbnailUrl?: string;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchWithBackoff(url: string, maxRetries = 5) {
  let attempt = 0;
  let waitMs = 3000;
  while (attempt < maxRetries) {
    try {
      const res = await fetchWithTimeout(url, { timeout: 10000 });
      if (res.status === 429) {
        attempt++;
        console.warn(`[Crawler] 429 Too Many Requests on ${url}. Retrying in ${waitMs}ms... (Attempt ${attempt}/${maxRetries})`);
        await delay(waitMs);
        waitMs *= 2;
      } else {
        return res;
      }
    } catch (e: any) {
      if (e.message && e.message.includes('Gateway Timeout')) {
        attempt++;
        console.warn(`[Crawler] 504 Gateway Timeout on ${url}. Retrying in ${waitMs}ms... (Attempt ${attempt}/${maxRetries})`);
        await delay(waitMs);
        waitMs *= 2;
      } else {
        throw e;
      }
    }
  }
  throw new Error(`[Crawler] Failed after ${maxRetries} attempts`);
}

/**
 * Recursively parses Archive.org JSON metadata
 * to find long-form video files. Handles both single items and collections.
 */
export async function crawlArchiveItem(
  rawIdentifier: string,
  minSizeMB: number = 50,
  minDurationSec: number = 600
): Promise<DeepCrawlerResult[]> {
  // Normalize URL to identifier
  let identifier = rawIdentifier;
  const archiveUrlPattern = /archive\.org\/(?:details|download|metadata|embed)\/([^\/\?#]+)/i;
  const match = identifier.match(archiveUrlPattern);
  if (match && match[1]) {
    identifier = match[1];
  } else if (identifier.includes('://')) {
    const parts = identifier.split('/');
    identifier = parts[parts.length - 1] || identifier;
  }
  identifier = identifier.trim().replace(/\/+$/, '');

  const metadataUrl = `https://archive.org/metadata/${identifier}`;
  const response = await fetchWithBackoff(metadataUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for ${identifier}`);
  }

  const data = await response.json();
  const results: DeepCrawlerResult[] = [];

  // Handle Collection Enumeration
  if ((data as any).metadata && (data as any).metadata.mediatype === 'collection') {
    const searchUrl = `https://archive.org/advancedsearch.php?q=collection:(${identifier})&fl[]=identifier&sort[]=addeddate+desc&rows=50&output=json`;
    const searchRes = await fetchWithBackoff(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`Failed to enumerate collection ${identifier}`);
    }
    const searchData = await searchRes.json();
    const docs = (searchData as any).response?.docs || [];
    
    // Process items in small batches to avoid timeouts
    for (const doc of docs) {
      try {
        const itemMetaRes = await fetchWithBackoff(`https://archive.org/metadata/${doc.identifier}`);
        if (itemMetaRes.ok) {
          const itemData = await itemMetaRes.json();
          results.push(...extractVideoFiles((itemData as any).files || [], doc.identifier, minSizeMB, minDurationSec));
        }
      } catch (err) {
        console.error(`[Crawler] Failed to parse item ${doc.identifier} in collection ${identifier}`);
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  // Handle Single Item
  results.push(...extractVideoFiles((data as any).files || [], identifier, minSizeMB, minDurationSec));
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function extractVideoFiles(
  files: any[],
  identifier: string,
  minSizeMB: number,
  minDurationSec: number
): DeepCrawlerResult[] {
  const videoFormats = ['h.264', 'mpeg4', 'matroska', 'quicktime', '512kb mpeg4', 'mpeg-4'];
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.webm'];
  const results: DeepCrawlerResult[] = [];
  const thumbnailFiles = files.filter(f => (f.format || '') === 'Thumbnail' || (f.name || '').toLowerCase().endsWith('.jpg'));

  for (const f of files) {
    const name = f.name || '';
    const format = (f.format || '').toLowerCase();
    const size = parseInt(f.size || '0', 10);
    const sizeMB = size / (1024 * 1024);
    const length = parseFloat(f.length || '0');
    
    const isVideoFormat = videoFormats.some(ext => format.includes(ext));
    const isVideoExt = videoExtensions.some(ext => name.toLowerCase().endsWith(ext));

    if ((isVideoFormat || isVideoExt) && sizeMB >= minSizeMB) {
      if (length > 0 && length < minDurationSec) {
        continue;
      }

      // Try to find a matching thumbnail for this video file
      const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
      // Archive.org usually creates thumbnails with the video's basename + _000001.jpg or similar.
      // We look for a thumbnail file that contains the exact basename of the video.
      const basenameParts = nameWithoutExt.split('/');
      const pureBasename = basenameParts[basenameParts.length - 1];
      
      let thumbnailUrl;
      const matchedThumb = thumbnailFiles.find(t => t.name.includes(pureBasename) && t.name.endsWith('.jpg'));
      if (matchedThumb) {
        // Double check it's not a generic thumb for a totally different video with a similar name
        // Usually, the thumbnail path matches the video path (inside the .thumbs dir)
        thumbnailUrl = `https://archive.org/download/${identifier}/${matchedThumb.name}`;
      }

      results.push({
        title: f.title || name.split('/').pop() || name,
        filename: name.split('/').pop() || name,
        path: name,
        url: `https://archive.org/download/${identifier}/${name}`,
        sizeMB: parseFloat(sizeMB.toFixed(2)),
        format: f.format,
        durationSec: length > 0 ? length : undefined,
        thumbnailUrl
      });
    }
  }
  return results;
}
