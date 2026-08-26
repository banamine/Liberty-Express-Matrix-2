import { getDb } from './db/index';
import { currentRundown, archiveHoldingQueue, episodes } from '../shared/schema';
import { isAllowedEntertainmentChannel } from './playlist-filter';

export async function getDynamicRundown() {
  const db = getDb();
  
  const [dbRundowns, holdingItems, epItems] = await Promise.all([
    db.select().from(currentRundown),
    db.select().from(archiveHoldingQueue),
    db.select().from(episodes)
  ]);

  const networkMap = new Map<string, string[]>();

  // Add from currentRundown
  for (const r of dbRundowns) {
    if (!networkMap.has(r.network)) {
      networkMap.set(r.network, []);
    }
    networkMap.get(r.network)!.push(...r.broadcastIds);
  }

  // Add from archiveHoldingQueue
  for (const h of holdingItems) {
    let network = h.identifier.split('_')[0] || 'UNKNOWN';
    if (h.pendingEpisodeJson) {
      try {
        const parsed = JSON.parse(h.pendingEpisodeJson);
        if (parsed.groupTitle) network = parsed.groupTitle;
      } catch (e) {}
    }
    
    if (!isAllowedEntertainmentChannel(network, h.identifier)) {
      continue; // Block news
    }

    if (!networkMap.has(network)) {
      networkMap.set(network, []);
    }
    const ids = networkMap.get(network)!;
    if (!ids.includes(h.identifier)) {
      ids.push(h.identifier);
    }
  }

  // Add from episodes
  for (const e of epItems) {
    if (e.sourceType === 'archive' || e.url.includes('archive.org')) {
      // try to extract identifier from url
      const { parseArchiveUrl } = await import('../src/lib/archive-parser');
      const parsed = parseArchiveUrl(e.url);
      let identifier = parsed ? parsed.identifier : e.tvgId || e.id;

      if (identifier) {
        let network = identifier.split('_')[0] || 'UNKNOWN';
        if (e.groupTitle) {
          network = e.groupTitle;
        } else if (e.tvgName) {
          network = e.tvgName;
        }
        
        if (!isAllowedEntertainmentChannel(network, identifier)) {
          continue; // Block news from reaching the scheduler playlist
        }

        if (!networkMap.has(network)) {
          networkMap.set(network, []);
        }
        const ids = networkMap.get(network)!;
        if (!ids.includes(identifier)) {
          ids.push(identifier);
        }
      }
    }
  }

  const result = Array.from(networkMap.entries()).map(([network, ids]) => ({
    network,
    broadcastIds: ids,
    updatedAt: new Date().toISOString()
  }));

  // Auto-ingest into currentRundown table so they persist
  for (const r of result) {
    if (r.broadcastIds.length > 0) {
      await db.insert(currentRundown).values({
        network: r.network,
        broadcastIds: r.broadcastIds
      }).onConflictDoUpdate({
        target: currentRundown.network,
        set: {
          broadcastIds: r.broadcastIds,
          updatedAt: new Date()
        }
      });
    }
  }

  return result;
}
