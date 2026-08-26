import { Express } from "express";
import { telemetry } from "../src/lib/telemetry";
import { getDb } from './db/index';
import { archiveHoldingQueue, archiveTranscripts } from '../shared/schema';
import * as cheerio from 'cheerio';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

import { searchArchiveItems, fetchArchiveCollection, getSafeArchiveUrl, fetchWithTimeout } from "./archive-utils";
import { parseTranscript } from "./transcript-parser";
import { crawlArchiveItem } from "./archive-deep-crawler";
import { crawlArchiveList } from "./archive-list-crawler";
import { matchThumbnails } from "../src/lib/thumbnail-matcher";
import { isAllowedEntertainmentChannel } from "./playlist-filter";

const deepSearchCache = new Map<string, { data: any, expires: number }>();


  async function logArchiveEvent(category, message, identifier) {
    try {
      const db = (await import("./db")).getDb();
      const { telemetryEvents } = (await import("../shared/schema"));
      const crypto = (await import("crypto"));
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

export function registerArchiveRoutes(app: Express) {
  app.get("/api/archive/latest", async (req, res) => {
    try {
      const resp = await fetchWithTimeout("https://archive.org/services/collection-rss.php?collection=tvnews", { timeout: 10000 });
      if (!resp.ok) throw new Error("Failed to fetch RSS");
      const xml = await resp.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const items: any[] = [];
      const seenIds = new Set<string>();

      $('item').each((i, el) => {
        const title = $(el).find('title').text();
        const link = $(el).find('link').text();
        let broadcast_id = "";
        const match = link.match(/\/details\/([^/]+)/);
        if (match) broadcast_id = match[1];

        if (broadcast_id && !seenIds.has(broadcast_id)) {
          seenIds.add(broadcast_id);
          items.push({ broadcast_id, title });
        }
      });
      res.json(items);
    } catch (e: any) {
      if (e.message && e.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: e.message });
      }
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  app.get("/api/archive/deep-search", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const query = req.query.query as string || "";
      const rows = 50;
      
      const cacheKey = `${query}_${page}_${rows}`;
      const cached = deepSearchCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return res.json(cached.data);
      }

      let q = `collection:(tvnews)`;
      if (query) {
        q += ` AND (${query})`;
      }

      const u = new URL('https://archive.org/advancedsearch.php');
      u.searchParams.set('q', q);
      u.searchParams.set('fl[]', 'identifier,title,date,source,mediatype');
      u.searchParams.set('sort[]', '-addeddate');
      u.searchParams.set('rows', String(rows));
      u.searchParams.set('page', String(page));
      u.searchParams.set('output', 'json');

      const resp = await fetchWithTimeout(u.toString(), { timeout: 10000 });
      if (!resp.ok) throw new Error("Failed to search archive");
      const data = await resp.json();

      const items = (data as any).response?.docs || [];
      const totalFound = (data as any).response?.numFound || 0;
      const hasMore = (page * rows) < totalFound;

      const result = {
        items,
        totalFound,
        currentPage: page,
        hasMore
      };
      
      // Cache for 60 seconds
      deepSearchCache.set(cacheKey, { data: result, expires: Date.now() + 60000 });

      res.json(result);
    } catch (e: any) {
      if (e.message && e.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: e.message });
      }
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // New Native Player Search Endpoint
  app.get("/api/archive/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const results = await searchArchiveItems(query, page, 50);
      res.json(results);
    } catch (error: any) {
      if (error.message && error.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: error.message });
      }
      res.status(500).json({ error: "Archive search failed" });
    }
  });

  // Series Deep Crawl Endpoint
  app.get("/api/archive/series-crawl/:identifier(*)", async (req, res) => {
    try {
      let { identifier } = req.params;
      // Normalize URL to identifier
      const archiveUrlPattern = /archive\.org\/(?:details|download|metadata|embed)\/([^\/\?#]+)/i;
      const match = identifier.match(archiveUrlPattern);
      if (match && match[1]) {
        identifier = match[1];
      } else if (identifier.includes('://')) {
        const parts = identifier.split('/');
        identifier = parts[parts.length - 1] || identifier;
      }
      identifier = identifier.trim().replace(/\/+$/, '');
      const minSize = req.query.minSize ? parseInt(req.query.minSize as string) : 50;
      const minDuration = req.query.minDuration ? parseInt(req.query.minDuration as string) : 600;
      
      const files = await crawlArchiveItem(identifier, minSize, minDuration);
      res.json({ identifier, files });
    } catch (error: any) {
      if (error.message && error.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: error.message });
      }
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // Series Thumbnails Endpoint
  app.get("/api/archive/series-thumbnails/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      const count = parseInt(req.query.count as string) || 0;
      const matches = await matchThumbnails(identifier, count);
      res.json({ identifier, matches });
    } catch (error: any) {
      if (error.message && error.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: error.message });
      }
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // New Native Player Resolve Endpoint
  app.get("/api/archive/resolve/:identifier", async (req, res) => {
    try {
      const { identifier } = req.params;
      const collection = await fetchArchiveCollection(identifier, true); 
      
      const validItems = collection.items.filter((item: any) => {
        const format = (Array.isArray(item.format) ? item.format.join(' ') : String(item.format || '')).toLowerCase();
        const url = String(item.url || '').toLowerCase();
        const isLegacy = url.endsWith('.mpg') || url.endsWith('.wmv') || url.endsWith('.flv') || url.endsWith('.avi');
        if (isLegacy) return false;
        
        const isSupportedFormat = format.includes('mp4') || format.includes('webm') || format.includes('h.264') || format.includes('matroska') || format.includes('mpeg') || format.includes('mpegts');
        const isSupportedUrl = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ts');
        return isSupportedFormat || isSupportedUrl;
      });

      if (!validItems.length) {
        // Fallback to a constructed .mp4 URL directly if metadata parsing fails or no valid item is found
        const fallbackUrl = `https://archive.org/download/${identifier}/${identifier}.mp4`;
        return res.json({
          identifier,
          title: identifier,
          safeUrl: fallbackUrl,
          duration: 0,
          format: "MPEG4"
        });
      }

      const bestItem = validItems[0];
      const safeUrl = getSafeArchiveUrl(bestItem.url);

      res.json({
        identifier,
        title: bestItem.title,
        safeUrl,
        duration: bestItem.duration,
        format: bestItem.format
      });
    } catch (error: any) {
      if (error.message && error.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to resolve playback URLs" });
    }
  });

  // 1. /api/archive/expand-rss
  app.post("/api/archive/expand-rss", async (req, res) => {
    try {
      const { rssUrl } = req.body;
      const resp = await fetchWithTimeout(rssUrl, { timeout: 10000 });
      if (!resp.ok) throw new Error("Failed to fetch RSS");
      const xml = await resp.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const items: any[] = [];
      $('item').each((i, el) => {
        const title = $(el).find('title').text();
        const link = $(el).find('link').text();
        let identifier = "";
        const match = link.match(/\/details\/([^/]+)/);
        if (match) identifier = match[1];
        if (identifier) {
          items.push({ identifier, title, mediatype: 'movies' });
        }
      });
      res.json({ items, total: items.length });
    } catch (e: any) {
      if (e.message && e.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: e.message });
      }
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // 2. /api/archive/import-items
  app.post("/api/archive/import-items", async (req, res) => {
    try {
      const { items, groupTitle } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      const db = getDb();

      // 1. Strict Gatekeeper: Drop zero-byte or corrupt files instantly
      const validItemsRaw = items.filter((item: any) => 
        item.sizeMB !== undefined && 
        item.sizeMB > 0 && 
        item.format !== 'Unknown' &&
        isAllowedEntertainmentChannel(groupTitle || '', item.identifier)
      );

      const droppedCount = items.length - validItemsRaw.length;

      if (validItemsRaw.length === 0) {
        return res.json({ 
          message: "Import processing complete", 
          requested: items.length,
          inserted: 0,
          duplicates: 0,
          corruptDropped: droppedCount
        });
      }

      const valuesToInsert = validItemsRaw.map((item: any) => ({
        identifier: item.identifier,
        filename: item.filename || '',
        thumbnailUrl: `https://archive.org/services/img/${item.identifier}`,
        status: 'pending',
        pendingEpisodeJson: JSON.stringify({ groupTitle, title: item.title, thumbnailUrl: item.thumbnailUrl, sizeMB: item.sizeMB, format: item.format }),
        fileSizeBytes: item.sizeMB ? Math.floor(item.sizeMB * 1024 * 1024) : 0,
        format: item.format
      }));

      // 2. Perform the insert and calculate the real delta
      const { sql } = await import('drizzle-orm');
      const initialCountRes = await db.select({ count: sql<number>`count(*)` }).from(archiveHoldingQueue);
      const initialCount = Number(initialCountRes[0].count);

      // Insert valid items
      await db.insert(archiveHoldingQueue)
        .values(valuesToInsert)
        .onConflictDoNothing({ target: archiveHoldingQueue.identifier });

      const finalCountRes = await db.select({ count: sql<number>`count(*)` }).from(archiveHoldingQueue);
      const finalCount = Number(finalCountRes[0].count);

      const actualInserted = finalCount - initialCount;
      const skippedAsDuplicates = validItemsRaw.length - actualInserted;

      // 3. Return the highly accurate telemetry payload to the frontend
      res.json({ 
        message: "Import processing complete", 
        requested: items.length,
        inserted: actualInserted,
        duplicates: skippedAsDuplicates,
        corruptDropped: droppedCount
      });

    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // 2b. /api/archive/import-list
  app.post("/api/archive/import-list", async (req, res) => {
    try {
      const { url, groupTitle } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Missing list URL" });
      }
      
      const { sanitizeTitle } = await import('../src/lib/title-sanitizer');
      const { v4: uuidv4 } = await import('uuid');
      const { episodes } = await import('../shared/schema');
      
      const listItems = await crawlArchiveList(url);
      const db = getDb();
      let imported = 0;
      
      let extractedTitle = 'Channel: List Items';
      const match = url.match(/\/lists\/\d+\/([^/?#]+)/);
      if (match) {
        extractedTitle = match[1].replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      const finalGroupTitle = groupTitle || extractedTitle;
      
      if (!isAllowedEntertainmentChannel(finalGroupTitle, '')) {
         return res.status(403).json({ error: "News lists are blocked from entertainment channels." });
      }
      
      for (const item of listItems) {
        const identifier = item.identifier;
        if (!isAllowedEntertainmentChannel(finalGroupTitle, identifier)) continue;
        
        try {
          // Dual-Mode: crawlArchiveItem handles both deep folders and shallow single items
          const crawlerResults = await crawlArchiveItem(identifier, 50, 600);
          
          for (const [index, f] of crawlerResults.entries()) {
            const fakeId = `list_${identifier}_${index}_${uuidv4().slice(0, 8)}`;
            
            await db.insert(episodes).values({
              id: fakeId,
              season: 1,
              episode: index + 1,
              title: sanitizeTitle(f.title),
              url: f.url,
              duration: f.durationSec || 0,
              groupTitle: finalGroupTitle,
              tvgId: identifier,
              tvgName: finalGroupTitle,
              thumbnailUrl: f.thumbnailUrl || `https://archive.org/services/img/${identifier}`,
              allowedPlayers: ["player1", "player2"],
            }).onConflictDoNothing();
            imported++;
          }
        } catch (crawlErr) {
          console.error(`Failed to crawl item ${identifier}:`, crawlErr);
        }
      }
      
      res.json({ message: `${imported} items extracted and added to ${finalGroupTitle}`, imported });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // 3. /api/archive/fetch
  app.post("/api/archive/fetch", async (req, res) => {
    try {
      const { url } = req.body;
      const { parseArchiveUrl } = await import('../src/lib/archive-parser');
      const parsed = parseArchiveUrl(url);
      let identifier = parsed ? parsed.identifier : url;
      
      let resp;
      try {
        resp = await fetchWithTimeout(`https://archive.org/metadata/${identifier}`, {
          timeout: 10000
        });
      } catch (err: any) {
        if (err.message && err.message.includes('Gateway Timeout')) {
          return res.status(504).json({ error: err.message });
        }
        throw err;
      }
      
      const data = await resp.json() as any;
      
      // Transform raw Archive.org data into the expected FetchResponse shape
      const files = data.files || [];
      const videoFiles = files.filter((f: any) => {
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
          fmt.includes('mpegts')
        );
      });

      const items = videoFiles.map((f: any) => ({
        identifier: data.metadata?.identifier || identifier,
        filename: f.name,
        title: f.title || f.name,
        url: `https://archive.org/download/${data.metadata?.identifier || identifier}/${f.name}`,
        thumbnailUrl: `https://archive.org/services/img/${data.metadata?.identifier || identifier}`,
        duration: parseFloat(f.length || '0'),
        format: f.format,
        size: parseInt(f.size || '0', 10),
        suspect: parseFloat(f.length || '0') < 60 // mark as suspect if less than 60 seconds
      }));

      res.json({
        items,
        metadata: data.metadata || { identifier },
        errors: [],
        count: items.length
      });
    } catch(e: any) {
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // 4. /api/archive/import
  app.post("/api/archive/import", async (req, res) => {
    try {
      const { url, groupTitle } = req.body;
      const { parseArchiveUrl } = await import('../src/lib/archive-parser');
      const parsed = parseArchiveUrl(url);
      let identifier = parsed ? parsed.identifier : url;
      
      if (!isAllowedEntertainmentChannel(groupTitle || '', identifier)) {
        return res.status(403).json({ error: "News content is blocked from entertainment channels." });
      }
      
      // If we got full URL, maybe we want to store the whole URL in pendingEpisodeJson if there are start/end boundaries, 
      // but for now identifier is key. If start/end exist, store it.
      let jsonPayload = { groupTitle };
      if (parsed && (parsed.start > 0 || parsed.end > 0)) {
        jsonPayload = Object.assign(jsonPayload, { start: parsed.start, end: parsed.end });
      }
      
      const db = getDb();
      await db.insert(archiveHoldingQueue).values({
        identifier: identifier,
        filename: '',
        thumbnailUrl: `https://archive.org/services/img/${identifier}`,
        status: 'pending',
        pendingEpisodeJson: JSON.stringify(jsonPayload)
      }).onConflictDoNothing({ target: archiveHoldingQueue.identifier });
      logArchiveEvent("queue", `Import queued: ${identifier}`, identifier);
      res.json({ message: "Import queued", imported: 1 });
    } catch(e: any) {
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // 5. /api/archive/collection
  app.post("/api/archive/collection", async (req, res) => {
    try {
      const { collection, page, rows, sort } = req.body;
      const q = `collection:(${collection})`;
      const u = new URL('https://archive.org/advancedsearch.php');
      u.searchParams.set('q', q);
      u.searchParams.set('fl[]', 'identifier,title,mediatype');
      u.searchParams.set('sort[]', sort || 'publicdate desc');
      u.searchParams.set('rows', String(rows || 50));
      u.searchParams.set('page', String(page || 1));
      u.searchParams.set('output', 'json');
      const resp = await fetchWithTimeout(u.toString(), { timeout: 10000 });
      const data = await resp.json();
      res.json({ items: (data as any).response?.docs || [], total: (data as any).response?.numFound || 0 });
    } catch (e: any) {
      if (e.message && e.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: e.message });
      }
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // 6. /api/archive/tvnews/search
  app.post("/api/archive/tvnews/search", async (req, res) => {
    try {
      const { network, query, startDate, endDate, rows, start } = req.body;
      let q = `collection:(TV-NEWS)`;
      if (network) {
        let cleanNetwork = network.replace(/^TV-/, '');
        if (cleanNetwork === 'MSNBCW') {
          q += ` AND identifier:(MSNBCW_* OR MSNOW_*)`;
        } else {
          q += ` AND identifier:(${cleanNetwork}_*)`;
        }
      }
      if (query) q += ` AND (${query})`;
      const u = new URL('https://archive.org/advancedsearch.php');
      u.searchParams.set('q', q);
      u.searchParams.set('fl[]', 'identifier,title,date,source');
      u.searchParams.set('sort[]', 'date desc');
      u.searchParams.set('rows', String(rows || 50));
      u.searchParams.set('start', String(start || 0));
      u.searchParams.set('output', 'json');
      const resp = await fetchWithTimeout(u.toString(), { timeout: 10000 });
      const data = await resp.json();
      res.json({ items: (data as any).response?.docs || [], total: (data as any).response?.numFound || 0 });
    } catch(e: any) {
      if (e.message && e.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: e.message });
      }
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // 7. /api/archive/tvnews/import
  app.post("/api/archive/tvnews/import", async (req, res) => {
    try {
      const { items, groupTitle, expandSegments, segmentSecs } = req.body;
      const db = getDb();
      let imported = 0;
      let skipped = 0;
      for (const item of items) {
        const identifier = item.identifier;
        if (item.sizeMB !== undefined && item.sizeMB === 0) {
           skipped++;
           continue;
        }
        const result = await db.insert(archiveHoldingQueue).values({
          identifier,
          filename: '',
          thumbnailUrl: `https://archive.org/services/img/${identifier}`,
          status: 'pending',
          pendingEpisodeJson: JSON.stringify({ groupTitle, expandSegments, segmentSecs })
        }).onConflictDoNothing({ target: archiveHoldingQueue.identifier }).returning({ id: archiveHoldingQueue.id });
        
        if (result.length > 0) {
          imported++;
        } else {
          skipped++;
        }
      }
      logArchiveEvent("queue", `Batch TV News items queued: ${imported} items`, "batch");
      res.json({ message: `${imported} TV News items queued${skipped ? ` (${skipped} skipped)` : ''}`, imported, skipped });
    } catch(e: any) {
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // POST /api/archive/queue
  app.post('/api/archive/queue', async (req, res) => {
    try {
      const { identifier, title, format, fileSizeBytes } = req.body;
      
      if (!identifier || !title) {
         telemetry.log('error' as any, 'system' as any, "Missing required fields for archive queue insert");
         return res.status(400).json({ error: "Missing required fields" });
      }

      // Construct the canonical Archive.org thumbnail URL
      const canonicalThumb = `https://archive.org/services/img/${identifier}`;
      const db = getDb();

      await db.insert(archiveHoldingQueue)
        .values({
          identifier,
          title,
          format,
          fileSizeBytes,
          thumbnailUrl: canonicalThumb, // Force thumbnail write
          status: 'pending'
        })
        .onConflictDoNothing({ target: archiveHoldingQueue.identifier }); // Absolute block on duplicates

      telemetry.log('info' as any, 'system' as any, `Successfully queued archive item: ${identifier}`);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      telemetry.log('error' as any, 'system' as any, `Failed to queue archive item: ${error.message}`);
      return res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/archive/holding-queue
  app.delete("/api/archive/holding-queue", async (req, res) => {
    try {
      const db = getDb();
      await db.delete(archiveHoldingQueue);
      res.json({ success: true, message: "Workspace cleared" });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || String(e) });
    }
  });

  // GET /api/archive/holding-queue
  app.get("/api/archive/holding-queue", async (req, res) => {
    try {
       const db = getDb();
       const items = await db.select().from(archiveHoldingQueue);
       return res.status(200).json(items);
    } catch (error: any) {
       telemetry.log('error' as any, 'system' as any, `Failed to fetch holding queue: ${error.message}`);
       return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/episodes/bulk-clean-titles
  app.post('/api/episodes/bulk-clean-titles', async (req, res) => {
    try {
        const db = getDb();
        const { sanitizeTitle } = await import('../src/lib/title-sanitizer');
        const { episodes } = await import('../shared/schema');
        const { eq } = await import('drizzle-orm');

        const allEpisodes = await db.select().from(episodes);
        let updatedCount = 0;

        for (const ep of allEpisodes) {
            if (ep.title) {
                const cleanedTitle = sanitizeTitle(ep.title);
                if (cleanedTitle !== ep.title) {
                    await db.update(episodes)
                        .set({ title: cleanedTitle })
                        .where(eq(episodes.id, ep.id));
                    updatedCount++;
                }
            }
        }
        
        telemetry.log('info' as any, 'system' as any, `Bulk clean titles executed. Updated ${updatedCount} records.`);
        return res.status(200).json({ success: true, updated: updatedCount });
    } catch (error: any) {
        telemetry.log('error' as any, 'system' as any, `Bulk clean titles failed: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
  });

  // 8. /api/archive/transcript/ingest
  app.post("/api/archive/transcript/ingest", async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ error: "Missing identifier" });
      }

      // Fetch metadata to find transcript files
      const resp = await fetchWithTimeout(`https://archive.org/metadata/${identifier}`, { timeout: 10000 });
      const data = await resp.json() as any;
      const files = data.files || [];

      // Look for .srt or .tsv
      const transcriptFile = files.find((f: any) => f.name && (f.name.endsWith('.srt') || f.name.endsWith('.tsv')));
      if (!transcriptFile) {
        return res.status(404).json({ error: "No transcript file found for this broadcast" });
      }

      const downloadUrl = `https://archive.org/download/${identifier}/${transcriptFile.name}`;
      const textResp = await fetchWithTimeout(downloadUrl, { timeout: 10000 });
      if (!textResp.ok) throw new Error("Failed to fetch transcript file");
      
      const rawText = await textResp.text();

      // We need to parse .srt or .tsv and extract start, end, text
      const parsedTranscripts = parseTranscript(rawText, transcriptFile.name.endsWith('.srt'));
      
      const db = getDb();

      let insertedCount = 0;
      await db.transaction(async (tx) => {
        for (const entry of parsedTranscripts) {
          // Strict Text Sanitization (Critical Constraint)
          // /[^\a-zA-Z0-9\s.,?!'"-]/g
          const sanitized = entry.text.replace(/[^a-zA-Z0-9\s.,?!'"-]/g, '').trim();
          if (sanitized) {
            await tx.insert(archiveTranscripts).values({
              broadcastId: identifier,
              startTime: entry.start,
              endTime: entry.end,
              textPayload: sanitized,
            });
            insertedCount++;
          }
        }
      });

      logArchiveEvent("system", `Transcripts ingested for ${identifier}`, identifier);
      res.json({ message: "Transcripts ingested", count: insertedCount });
    } catch (e: any) {
      console.error("Transcript ingest error:", e);
      if (e.message && e.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: e.message });
      }
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });

  // 9. /api/archive/transcript/ingest/batch
  app.post("/api/archive/transcript/ingest/batch", async (req, res) => {
    try {
      const { broadcast_ids } = req.body;
      if (!Array.isArray(broadcast_ids)) {
        return res.status(400).json({ error: "broadcast_ids must be an array" });
      }

      const idsToProcess = broadcast_ids.slice(0, 50);
      const db = getDb();
      let totalInserted = 0;

      for (const id of idsToProcess) {
        try {
          await delay(750);
          let textResp = await fetchWithTimeout(`https://archive.org/download/${id}/${id}.srt`, { timeout: 10000 });
          let isSrt = true;

          if (!textResp.ok) {
            textResp = await fetchWithTimeout(`https://archive.org/download/${id}/${id}.tsv`, { timeout: 10000 });
            isSrt = false;
          }

          if (!textResp.ok) {
            console.log(`No transcript found for ${id}`);
            continue;
          }

          const rawText = await textResp.text();
          const parsedTranscripts = parseTranscript(rawText, isSrt);

          await db.transaction(async (tx) => {
            for (const entry of parsedTranscripts) {
              const sanitized = entry.text
                .normalize("NFKC")
                .replace(/[^\w\s.,!?'"—–\-\n]/gu, "")
                .replace(/\s+/g, " ")
                .trim();

              if (sanitized) {
                await tx.insert(archiveTranscripts).values({
                  broadcastId: id,
                  startTime: entry.start,
                  endTime: entry.end,
                  textPayload: sanitized,
                });
                totalInserted++;
              }
            }
          });
        } catch (err) {
          console.error(`Error processing ${id}:`, err);
        }
        await new Promise(resolve => setTimeout(resolve, 750));
      }

      res.json({ message: "Batch transcripts ingested", count: totalInserted });
    } catch (e: any) {
      console.error("Batch ingest error:", e);
      if (e.message && e.message.includes('Gateway Timeout')) {
        return res.status(504).json({ error: e.message });
      }
      res.status(500).json({ error: e?.message || String(e), stack: e?.stack || "" });
    }
  });
}

