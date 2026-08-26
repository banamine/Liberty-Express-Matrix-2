import fs from 'fs/promises';
import path from 'path';

export interface BroadcastSegment {
  identifier: string;
  title: string;
  start: number;
  duration: number;
  thumbBase: string;
  showId: string;
  addedDate?: string;
}

export interface NetworkRundown {
  channelId: string;
  network: string;
  segments: BroadcastSegment[];
}

export interface ShowQuery {
  showId: string;
  query: string;
}

export interface NetworkChannel {
  channelId: string;
  network: string;
  shows: ShowQuery[];
}

// Confirmed TV news archive collections structured for per-show scale out
const NEWS_NETWORKS: NetworkChannel[] = [
  {
    channelId: 'cnn-primary',
    network: 'CNN',
    shows: [
      { showId: 'cnn-general', query: 'identifier:(CNNW_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'msnbc-primary',
    network: 'MSNBC',
    shows: [
      { showId: 'msnbc-general', query: 'identifier:(MSNBCW_* OR MSNOW_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'foxnews-primary',
    network: 'FOXNEWS',
    shows: [
      { showId: 'foxnews-general', query: 'identifier:(FOXNEWSW_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'bbc-primary',
    network: 'BBC',
    shows: [
      { showId: 'bbc-general', query: 'identifier:(BBCNEWS_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'rt-primary',
    network: 'RT',
    shows: [
      { showId: 'rt-general', query: 'identifier:(RT_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'cspan-primary',
    network: 'CSPAN',
    shows: [
      { showId: 'cspan-general', query: 'identifier:(CSPAN_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'cspan2-primary',
    network: 'CSPAN2',
    shows: [
      { showId: 'cspan2-general', query: 'identifier:(CSPAN2_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'cspan3-primary',
    network: 'CSPAN3',
    shows: [
      { showId: 'cspan3-general', query: 'identifier:(CSPAN3_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'dw-primary',
    network: 'DW',
    shows: [
      { showId: 'dw-general', query: 'identifier:(DW_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'bloomberg-primary',
    network: 'BLOOMBERG',
    shows: [
      { showId: 'bloomberg-general', query: 'identifier:(BLOOMBERG_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'cnbc-primary',
    network: 'CNBC',
    shows: [
      { showId: 'cnbc-general', query: 'identifier:(CNBC_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'aljazam-primary',
    network: 'ALJAZAM',
    shows: [
      { showId: 'aljazam-general', query: 'identifier:(ALJAZAM_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'wjla-primary',
    network: 'ABC-WJLA',
    shows: [
      { showId: 'wjla-general', query: 'identifier:(WJLA_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'kgo-primary',
    network: 'ABC-KGO',
    shows: [
      { showId: 'kgo-general', query: 'identifier:(KGO_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'wrc-primary',
    network: 'NBC-WRC',
    shows: [
      { showId: 'wrc-general', query: 'identifier:(WRC_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: 'ktvu-primary',
    network: 'FOX-KTVU',
    shows: [
      { showId: 'ktvu-general', query: 'identifier:(KTVU_*) AND mediatype:(movies)' }
    ]
  },
  {
    channelId: '1tv-primary',
    network: '1TV',
    shows: [
      { showId: '1tv-general', query: 'identifier:(1TV_*) AND mediatype:(movies)' }
    ]
  }
];

/**
 * Safely parses Archive.org length formats ("1:32:05", "45:12", "5523.5", or undefined).
 * We explicitly guess missing durations because recently uploaded Archive.org items
 * often lack the 'runtime' field until their derivation tasks complete.
 */
function parseDuration(length: string | number | undefined, network: string): number | null {
  if (!length) {
    if (network === 'RT') {
      return 1860; // RT's average duration is slightly longer (31m)
    }
    return 1800; // Default 30 minutes for other networks
  }
  
  if (typeof length === 'number') return Math.floor(length);
  
  const lengthStr = String(length).trim();
  if (/^\d+(\.\d+)?$/.test(lengthStr)) {
    return Math.floor(parseFloat(lengthStr));
  }

  const parts = lengthStr.split(':').map(Number);
  if (parts.some(isNaN)) return null;

  // Handles h:mm:ss or mm:ss
  return parts.reduce((acc, val) => acc * 60 + val, 0);
}

async function harvestShowData(show: ShowQuery, network: string, retries = 3): Promise<BroadcastSegment[]> {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(show.query)}&fl[]=identifier,title,runtime,addeddate,format&sort[]=addeddate desc&rows=50&page=1&output=json`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s per-request timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AJN-Chronicle-PlayoutEngine/3.0 (contact@ajnnews.org)'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited (429)');
        }
        throw new Error(`Archive.org API HTTP ${response.status}`);
      }

      const data = await response.json();
      const docs = data.response?.docs || [];

      if (docs.length === 0) {
        console.warn(`[NewsBuilder] WARNING: 0 items returned for show "${show.showId}". Query may be empty or throttled.`);
      }

      const segments: BroadcastSegment[] = [];
      let skippedCount = 0;
      
      for (const doc of docs) {
        const hasCompatibleFormat = Array.isArray(doc.format)
          ? doc.format.some((f: string) => /^(h\.?264|512kbps mpeg4|mpeg4)$/i.test(f.trim()))
          : /^(h\.?264|512kbps mpeg4|mpeg4)$/i.test((doc.format || '').trim());

        if (!hasCompatibleFormat) {
          console.warn(`[NewsBuilder] Skipping ${doc.identifier} — no confirmed compatible video format.`);
          continue;
        }

        const parsedDuration = parseDuration(doc.runtime, network);
        
        if (parsedDuration === null) {
          skippedCount++;
          continue;
        }

        // Verified Archive.org thumbnail URL pattern:
        // Primary thumbnail image generated by Archive's derivation engine
        const thumbBase = `https://archive.org/services/get-item-image.php?identifier=${doc.identifier}&mediatype=movies`;

        segments.push({
          identifier: doc.identifier,
          title: doc.title || doc.identifier,
          start: 0, // Will be computed sequentially at the channel level
          duration: parsedDuration,
          thumbBase,
          showId: show.showId,
          addedDate: doc.addeddate
        });
      }

      if (skippedCount > 0) {
        console.warn(`[NewsBuilder] WARNING: Skipped ${skippedCount} items in "${show.showId}" due to unparseable (garbage) duration.`);
        if (segments.length > 0 && skippedCount > segments.length) {
          console.warn(`[NewsBuilder] CRITICAL: Majority of items skipped for "${show.showId}". This may indicate a parsing regression.`);
        }
      }

      clearTimeout(timeoutId);
      return segments;
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? 'Request timed out' : err.message;
      
      console.error(`[NewsBuilder] Attempt ${attempt} failed for show "${show.showId}": ${msg}`);
      
      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`[NewsBuilder] Retrying ${show.showId} in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`[NewsBuilder] All ${retries} attempts failed for ${show.showId}.`);
        return [];
      }
    }
  }
  
  return [];
}

async function harvestChannelData(channel: NetworkChannel): Promise<NetworkRundown> {
  const allSegments: BroadcastSegment[] = [];
  
  for (const show of channel.shows) {
    const showSegments = await harvestShowData(show, channel.network);
    allSegments.push(...showSegments);
    // Throttle 750ms between queries to respect Archive.org API constraints
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  // Sort by addedDate descending so we naturally interleave multiple shows
  allSegments.sort((a, b) => {
    const timeA = a.addedDate ? new Date(a.addedDate).getTime() : 0;
    const timeB = b.addedDate ? new Date(b.addedDate).getTime() : 0;
    return timeB - timeA;
  });

  const nowSec = Math.floor(Date.now() / 1000);
  let cumulativeStart = nowSec;
  
  for (const segment of allSegments) {
    segment.start = cumulativeStart;
    cumulativeStart += segment.duration;
  }

  return {
    channelId: channel.channelId,
    network: channel.network,
    segments: allSegments
  };
}

export async function generateDailyRundown() {
  console.log('[NewsBuilder] Starting daily Archive.org news harvest...');
  const outputPath = path.join(process.cwd(), 'public', 'data', 'daily-rundown.json');
  
  // Read existing file on disk for fallback merging
  let existingData: NetworkRundown[] = [];
  try {
    const fileContent = await fs.readFile(outputPath, 'utf-8');
    existingData = JSON.parse(fileContent);
  } catch {
    console.warn('[NewsBuilder] No existing daily-rundown.json found on disk to merge.');
  }

  const newRundowns: NetworkRundown[] = [];

  for (const channel of NEWS_NETWORKS) {
    const harvested = await harvestChannelData(channel);
    
    // Partial Failure Check: If 0 segments harvested, fallback to previous disk array for this channel
    if (harvested.segments.length === 0) {
      const previousChannel = existingData.find(r => r.channelId === channel.channelId);
      if (previousChannel && previousChannel.segments.length > 0) {
        console.warn(`[NewsBuilder] Preserving yesterday's data for channel "${channel.channelId}".`);
        newRundowns.push(previousChannel);
      } else {
        newRundowns.push(harvested);
      }
    } else {
      newRundowns.push(harvested);
    }
  }

  // Total Failure Guard: Abort if every channel has 0 segments
  if (newRundowns.every(r => r.segments.length === 0)) {
    console.error('[NewsBuilder] CRITICAL: All channel harvests failed. Aborting build.');
    process.exit(1);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(newRundowns, null, 2), 'utf-8');
  console.log(`[NewsBuilder] Daily rundown successfully written to ${outputPath}`);

  // Generate Audio Briefings JSON as per Nexus TV-O architecture
  const audioBriefingsPath = path.join(process.cwd(), 'public', 'data', 'audio_briefings', 'daily_digest.json');
  await fs.mkdir(path.dirname(audioBriefingsPath), { recursive: true });
  
  const audioDigest = newRundowns.map(r => ({
    channelId: r.channelId,
    network: r.network,
    audioSegments: r.segments.map(seg => {
      // Regex pipeline ONLY cleans presentation titles
      const cleanTitle = (seg.title || seg.identifier)
        .replace(/\[.*?\]|\(.*?\)/g, '')                  // Remove bracket noise
        .replace(/(1080p|720p|h264|x264|aac|mp3|mp4)/gi, '') // Remove media specs
        .replace(/[._]/g, ' ')                            // Clean underscores/dots
        .trim();

      return {
        id: seg.identifier,
        cleanTitle,
        // NEVER mutate, decode, or regex-replace this string
        rawUrl: `https://archive.org/download/${seg.identifier}/format=mp3`, // Or another audio format logic
        duration: seg.duration,
        start: seg.start
      };
    })
  }));
  await fs.writeFile(audioBriefingsPath, JSON.stringify(audioDigest, null, 2), 'utf-8');
  console.log(`[NewsBuilder] Audio digest successfully written to ${audioBriefingsPath}`);
}

// CLI execution check
if (process.argv[1]?.includes('news-builder')) {
  generateDailyRundown();
}

