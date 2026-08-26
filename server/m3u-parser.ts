export interface M3UEpisode {
  season: number;
  episode: number;
  title: string;
  url: string;
  duration: number;
  status: "valid" | "warning" | "invalid" | "redirected";
  groupTitle?: string | null;
  tvgId?: string | null;
  tvgName?: string | null;
  tvgLogo?: string | null;
  objectPosition?: "top" | "center" | "bottom" | null;
  subtitleUrl?: string | null;
  isWebCompatible?: boolean;
  genreTags?: string | null;
  contentType?: string | null;
  allowedPlayers?: string[];
}

import { getFoxAffiliateMarketCode } from "./hls-scraper";
import { isNewsSource } from "../shared/news-registry";
import { sanitizeTitle } from "../src/lib/title-sanitizer";
import https from "https";

// ── Segment reconstruction ────────────────────────────────────────────────────
// Groups raw entries by (title + groupTitle). Within each group, walks entries
// in their original order and merges contiguous runs whose Archive.org start
// offsets are within 10 s of the previous entry's end offset (or non-Archive
// entries are treated as adjacent). The merged entry keeps the first URL and
// sums the durations.

function reconstructSegments(raw: M3UEpisode[]): M3UEpisode[] {
  if (raw.length === 0) return raw;

  type Keyed = M3UEpisode & { _origIndex: number };
  const keyed: Keyed[] = raw.map((ep, i) => ({ ...ep, _origIndex: i }));

  const DERIVE_SUFFIX_RE = /[_\-](archive|deriv|HiRes|hiRes|hires|hi_res|thumb|meta|files|xml)$/i;
  function normaliseSegmentKey(title: string): string {
    return title.replace(DERIVE_SUFFIX_RE, "");
  }

  const groups = new Map<string, Keyed[]>();
  for (const ep of keyed) {
    const key = `${normaliseSegmentKey(ep.title ?? "")}\0${ep.groupTitle ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ep);
  }

  const CONTIGUOUS_SLACK_S = 10;

  function getArchiveStart(url: string): number | null {
    const m = url.match(/[?&]start=(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function getArchiveEnd(url: string, duration: number): number | null {
    const m = url.match(/[?&]end=(\d+)/);
    if (m) return parseInt(m[1], 10);
    const start = getArchiveStart(url);
    if (start !== null && duration > 0) return start + duration;
    return null;
  }

  const merged = new Map<number, M3UEpisode>();

  for (const group of Array.from(groups.values())) {
    if (group.length === 1) {
      const { _origIndex, ...ep } = group[0];
      merged.set(_origIndex, ep);
      continue;
    }

    const runs: Keyed[][] = [];
    let currentRun: Keyed[] = [group[0]];

    for (let i = 1; i < group.length; i++) {
      const prev = currentRun[currentRun.length - 1];
      const curr = group[i];

      const prevEnd   = getArchiveEnd(prev.url, prev.duration);
      const currStart = getArchiveStart(curr.url);

      let contiguous: boolean;
      if (prevEnd !== null && currStart !== null) {
        contiguous = Math.abs(currStart - prevEnd) <= CONTIGUOUS_SLACK_S;
      } else {
        // Non-archive entries (missing ?start=/?end= params) are always
        // distinct episodes — never merge them even if adjacent.
        contiguous = false;
      }

      if (contiguous) {
        currentRun.push(curr);
      } else {
        runs.push(currentRun);
        currentRun = [curr];
      }
    }
    runs.push(currentRun);

    for (const run of runs) {
      const { _origIndex, ...headEp } = run[0];
      const totalDuration = run.reduce((sum, ep) => sum + (ep.duration ?? 0), 0);
      const mergedEp: M3UEpisode = { ...headEp, duration: totalDuration };
      merged.set(_origIndex, mergedEp);
    }
  }

  return raw
    .map((_, i) => merged.get(i))
    .filter((ep): ep is M3UEpisode => ep !== undefined);
}

// ── Content type classification ───────────────────────────────────────────────

// Strict News Rule: any item with a known duration of 1–300 seconds is always
// classified as "news" (Mini-News) regardless of source or title metadata.
// Zero-duration items are left as "movie" until duration is known.
function classifyContentType(ep: M3UEpisode): "news" | "movie" {
  const dur = ep.duration ?? 0;
  if (dur > 0 && dur <= 300) return "news";   // ≤ 5:00 → Mini-News
  if (isNewsSource(ep.url, ep.groupTitle, ep.tvgLogo)) return "news";
  return "movie";
}

function assignTemporaryGenreTag(ep: M3UEpisode): string | null {
  const tags = (ep as any).genreTags as string[] | undefined;
  if (Array.isArray(tags) && tags.length > 0) return null;
  const dur = ep.duration ?? 0;
  if (dur > 0 && dur < 15 * 60) return "Short";
  if (dur > 60 * 60) return "Feature";
  return null;
}

function assignKeywordGenreTag(ep: M3UEpisode): string | null {
  const title = `${ep.title ?? ""} ${ep.tvgName ?? ""}`.toLowerCase();
  if (title.includes("news") || title.includes("c-span") || title.includes("report")) return "News";
  if (title.includes("concert") || title.includes("live")) return "Music";
  return null;
}

function isSubtitleFile(url: string): boolean {
  return /\.(srt|vtt)(\?|$)/i.test(url);
}

function subtitleBaseName(url: string): string {
  return url
    .split(/[?#]/)[0]
    .split("/")
    .pop()
    ?.replace(/\.(srt|vtt)$/i, "") ?? "";
}

export class M3UParser {
  private seasonEpisodePatterns = [
    /S(\d{1,2})E(\d{1,3})\s*-\s*(.+)/i,
    /S(\d{1,2})E(\d{1,3})\s+(.+)/i,
    /Season\s*(\d+)\s*Episode\s*(\d+)\s*-\s*(.+)/i,
    /(\d+)x(\d{1,3})\s*-\s*(.+)/i,
  ];

  parseM3UContent(content: string): { episodes: M3UEpisode[]; errors: string[] } {
    const rawEpisodes: M3UEpisode[] = [];
    const errors: string[] = [];
    const lines = content.split('\n').map(line => line.trim());
    let fallbackCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('#EXTINF:')) {
        const nextLine = lines[i + 1];

        if (!nextLine || nextLine.startsWith('#')) {
          errors.push(`Missing URL for entry at line ${i + 1}`);
          continue;
        }

        try {
          const episode = this.parseExtInfLine(line, nextLine, fallbackCounter);
          if (episode) {
            rawEpisodes.push(episode);
            fallbackCounter++;
          } else {
            errors.push(`Could not parse episode info from: ${line}`);
          }
        } catch (error) {
          errors.push(`Error parsing line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        i++;
      }
    }

    const reconstructed = reconstructSegments(rawEpisodes);

    const subtitleBuckets = new Map<string, string>();
    for (const ep of reconstructed) {
      if (isSubtitleFile(ep.url)) subtitleBuckets.set(subtitleBaseName(ep.url).toLowerCase(), ep.url);
    }

    const episodes = reconstructed
      .filter((ep) => !isSubtitleFile(ep.url))
      .map(ep => {
        const subtitleUrl = subtitleBuckets.get(subtitleBaseName(ep.url).toLowerCase()) ?? (ep as any).subtitleUrl ?? null;
        return {
          ...ep,
          subtitleUrl,
          isWebCompatible: !/\.(mkv|wmv|avi)(\?|$)/i.test(ep.url),
          genreTags: assignKeywordGenreTag(ep) ?? assignTemporaryGenreTag(ep),
          contentType: classifyContentType(ep),
        };
      });

    return { episodes, errors };
  }

  private parseExtInfLine(extinfLine: string, urlLine: string, fallbackEpisode: number): M3UEpisode | null {
    const extinfMatch = extinfLine.match(/#EXTINF:\s*(-?\d+)\s*(?:[^,]*),\s*(.+)/);
    if (!extinfMatch) return null;

    const duration = parseInt(extinfMatch[1], 10) || 0;
    const rawTitlePart = extinfMatch[2].trim();
    const url = urlLine.trim();

    const hasCyrillic = /[^\x00-\x7F]/.test(rawTitlePart);
    const isJustNumber = /^\d+$/.test(rawTitlePart);
    const targetString = (hasCyrillic || isJustNumber) ? url : rawTitlePart;
    const titlePart = sanitizeTitle(targetString);

    const episodeInfo = this.parseEpisodeInfo(titlePart, fallbackEpisode);
    const status = this.determineStatus(url);
    const attributes = this.parseExtInfAttributes(extinfLine);

    let entryTitle = episodeInfo.title;
    if (attributes.tvgLogo && !/^\[.{2,4}\]/.test(entryTitle)) {
      const marketCode = getFoxAffiliateMarketCode(attributes.tvgLogo);
      if (marketCode) entryTitle = `${marketCode} ${entryTitle}`;
    }

    const raw: M3UEpisode = {
      season: episodeInfo.season,
      episode: episodeInfo.episode,
      title: entryTitle,
      duration: Math.max(0, duration),
      url,
      status,
      groupTitle: attributes.groupTitle || null,
      tvgId: attributes.tvgId || null,
      tvgName: attributes.tvgName || null,
      tvgLogo: attributes.tvgLogo || null,
      objectPosition: attributes.objectPosition ?? null,
    };

    return this.enrichArchiveOrgEntry(raw);
  }

  // ── Archive.org URL recognition ───────────────────────────────────────────

  private parseArchiveOrgUrl(url: string): {
    identifier: string;
    startSec: number;
    endSec: number;
    duration: number;
  } | null {
    // Redirect form:   https://archive.org/download/{id}/...mp4?start=N&end=M
    // CDN-direct form: https://ia902902.us.archive.org/3/items/{id}/...mp4?start=N&end=M
    const redirectMatch = url.match(/archive\.org\/download\/([^/]+)\//);
    const cdnMatch      = url.match(/ia\d+\.us\.archive\.org\/\d+\/items\/([^/]+)\//);
    const identifier    = redirectMatch?.[1] ?? cdnMatch?.[1] ?? null;
    if (!identifier) return null;

    const startMatch = url.match(/[?&]start=(\d+)/);
    const endMatch   = url.match(/[?&]end=(\d+)/);
    const startSec   = startMatch ? parseInt(startMatch[1], 10) : 0;
    const endSec     = endMatch   ? parseInt(endMatch[1],   10) : 0;
    const duration   = endSec > startSec ? endSec - startSec : 0;

    return { identifier, startSec, endSec, duration };
  }

  private enrichArchiveOrgEntry(episode: M3UEpisode): M3UEpisode {
    const parsed = this.parseArchiveOrgUrl(episode.url);
    if (!parsed) return episode;

    const { identifier, duration } = parsed;
    let ep = { ...episode };

    if (!ep.tvgId) ep.tvgId = identifier;
    // Always use Archive.org URL duration if available (from ?start=&?end=)
    // This overrides any EXTINF duration which may be segment-duration, not full video
    if (duration > 0) ep.duration = duration;
    if (!ep.tvgLogo || /_\d{6}\.jpg/.test(ep.tvgLogo)) {
      ep.tvgLogo = `https://archive.org/services/img/${identifier}`;
    }
    if (!ep.tvgName && ep.title) ep.tvgName = ep.title;

    return ep;
  }

  // Async method to fetch actual durations from Archive.org metadata
  async enrichMissingDurations(episodes: M3UEpisode[]): Promise<M3UEpisode[]> {
    const result = [...episodes];
    
    for (let i = 0; i < result.length; i++) {
      const ep = result[i];
      const parsed = this.parseArchiveOrgUrl(ep.url);
      
      // Only enrich Archive.org URLs, and only if duration is likely wrong (no cue params)
      // If URL has ?start=&?end= cue params, the duration was already set correctly
      if (!parsed) continue;
      
      const urlHasCueParams = /[?&](start|end)=\d+/.test(ep.url);
      if (urlHasCueParams) continue; // Duration is correct from cue params
      
      // For plain Archive.org URLs without cue params, fetch real duration from metadata
      const { identifier } = parsed;
      const fileMatch = ep.url.match(/\/items\/[^/]+\/(.+?)(?:\?|$)/);
      if (!fileMatch) continue;
      
      // Use https.get to fetch metadata with timeout
      const actualDuration = await new Promise<number | null>((resolve) => {
        const timeoutHandle = setTimeout(() => resolve(null), 5000);
        
        https.get(`https://archive.org/metadata/${identifier}`, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            clearTimeout(timeoutHandle);
            try {
              const metadata = JSON.parse(data) as any;
              if (metadata.files) {
                const fileName = decodeURIComponent(fileMatch[1]);
                const file = metadata.files.find((f: any) => 
                  f.name.includes(fileName) || f.name.endsWith(fileName.split('/').pop() || '')
                );
                if (file && file.length) {
                  const dur = Math.floor(parseFloat(file.length));
                  resolve(dur > 0 ? dur : null);
                } else {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            } catch (e) {
              resolve(null);
            }
          });
        }).on('error', () => {
          clearTimeout(timeoutHandle);
          resolve(null);
        });
      });
      
      if (actualDuration && actualDuration > 0) {
        result[i] = { ...ep, duration: actualDuration };
      }
    }
    
    return result;
  }

  // ── Attribute parsing ─────────────────────────────────────────────────────

  private parseExtInfAttributes(extinfLine: string): {
    groupTitle?: string;
    tvgId?: string;
    tvgName?: string;
    tvgLogo?: string;
    objectPosition?: "top" | "center" | "bottom";
  } {
    const attributes: {
      groupTitle?: string;
      tvgId?: string;
      tvgName?: string;
      tvgLogo?: string;
      objectPosition?: "top" | "center" | "bottom";
    } = {};

    const groupTitleMatch = extinfLine.match(/group-title="([^"]*)"/i);
    if (groupTitleMatch) attributes.groupTitle = groupTitleMatch[1];

    const tvgIdMatch = extinfLine.match(/tvg-id="([^"]*)"/i);
    if (tvgIdMatch) attributes.tvgId = tvgIdMatch[1];

    const tvgNameMatch = extinfLine.match(/tvg-name="([^"]*)"/i);
    if (tvgNameMatch) attributes.tvgName = tvgNameMatch[1];

    const tvgLogoMatch = extinfLine.match(/tvg-logo="([^"]*)"/i);
    if (tvgLogoMatch) attributes.tvgLogo = tvgLogoMatch[1];

    const tvgObjPosMatch = extinfLine.match(/tvg-object-position="([^"]*)"/i);
    if (tvgObjPosMatch) {
      const val = tvgObjPosMatch[1].toLowerCase();
      if (val === "top" || val === "center" || val === "bottom") {
        attributes.objectPosition = val as any;
      }
    }

    return attributes;
  }

  // ── Episode info parsing ──────────────────────────────────────────────────

  parseEpisodeInfo(titleString: string, fallbackEpisode: number = 1): { season: number; episode: number; title: string } {
    // Standard SxxExx and equivalent patterns
    for (const pattern of this.seasonEpisodePatterns) {
      const match = titleString.match(pattern);
      if (match) {
        const season  = parseInt(match[1], 10);
        const episode = parseInt(match[2], 10);
        const title   = match[3].trim();
        if (!isNaN(season) && !isNaN(episode) && title) {
          return { season, episode, title };
        }
      }
    }

    // TV news segment: "{Program} [{YYYY-MM-DD HH:MM}] HH:MM"
    // e.g. "Fox Friends Weekend [2026-03-14 12:00] 00:05"
    // Must be matched BEFORE the trailing-number fallback to prevent clock
    // digits being extracted as an episode number.
    const tvNewsSegMatch = titleString.match(
      /^(.+?)\s+\[(\d{4})-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s+\d{2}:\d{2}\s*$/
    );
    if (tvNewsSegMatch) {
      return {
        season:  parseInt(tvNewsSegMatch[2], 10),
        episode: fallbackEpisode,
        title:   tvNewsSegMatch[1].trim(),
      };
    }

    // TV news whole show: "{Program} [{YYYY-MM-DD HH:MM}]"
    // e.g. "MSNBC Live [2026-03-14 18:00]"
    const tvNewsShowMatch = titleString.match(
      /^(.+?)\s+\[(\d{4})-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*$/
    );
    if (tvNewsShowMatch) {
      return {
        season:  parseInt(tvNewsShowMatch[2], 10),
        episode: fallbackEpisode,
        title:   tvNewsShowMatch[1].trim(),
      };
    }

    const trailingParenMatch = titleString.match(/\((\d+)\)\s*$/);
    if (trailingParenMatch) {
      const epNum = parseInt(trailingParenMatch[1], 10);
      if (!isNaN(epNum)) {
        return { season: 1, episode: epNum, title: titleString };
      }
    }

    const trailingNumMatch = titleString.match(/\s(\d+)\s*$/);
    if (trailingNumMatch) {
      const epNum = parseInt(trailingNumMatch[1], 10);
      if (!isNaN(epNum) && epNum <= 9999) {
        return { season: 1, episode: epNum, title: titleString };
      }
    }

    return { season: 1, episode: fallbackEpisode, title: titleString };
  }

  private determineStatus(url: string): "valid" | "warning" | "invalid" {
    if (!url || url.length === 0) return "invalid";
    if (!url.startsWith('http://') && !url.startsWith('https://')) return "invalid";
    if (url.includes('example.com') || url.includes('placeholder')) return "warning";
    return "valid";
  }

  private extractDateFromId(idOrTitle: string): string | null {
    const match = idOrTitle.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const altMatch = idOrTitle.match(/(\d{4})(\d{2})(\d{2})/);
    if (altMatch && parseInt(altMatch[2]) >= 1 && parseInt(altMatch[2]) <= 12 && parseInt(altMatch[3]) >= 1 && parseInt(altMatch[3]) <= 31) {
      return `${altMatch[1]}-${altMatch[2]}-${altMatch[3]}`;
    }
    return null;
  }

  generateM3U(episodes: Array<{
    id?: string;
    season: number;
    episode: number;
    title: string;
    duration: number;
    url: string;
    params?: string;
    status: string;
    groupTitle?: string | null;
    tvgId?: string | null;
    tvgName?: string | null;
    tvgLogo?: string | null;
    description?: string | null;
    objectPosition?: string | null;
    contentType?: string | null;
  }>, title: string = "Playlist", includeInvalid: boolean = false, flatTitles: boolean = false, forceFullLength: boolean = false): string {
    const lines = ['#EXTM3U'];

    const sortedEpisodes = [...episodes].sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      if (a.episode !== b.episode) return a.episode - b.episode;
      const dateA = this.extractDateFromId(a.id || a.title);
      const dateB = this.extractDateFromId(b.id || b.title);
      if (dateA && dateB) return dateA.localeCompare(dateB);
      return 0;
    });

    // Track seen base URLs so archive.org broadcasts appear once (not once per segment)
    const seenUrls = new Set<string>();

    for (const episode of sortedEpisodes) {
      if (episode.status === 'valid' || episode.status === 'warning' || episode.status === 'pending' || includeInvalid) {
        let exportUrl = episode.url.trim();
        const isArchive = exportUrl.includes("archive.org/download/");

        if (isArchive) {
          // Strip query params — VLC fetches the full file
          exportUrl = exportUrl.replace(/\?.*$/, "");
          // One entry per broadcast (deduplicate by base URL)
          if (seenUrls.has(exportUrl)) continue;
          seenUrls.add(exportUrl);
        }

        const attributes: string[] = [];
        if (episode.tvgId)      attributes.push(`tvg-id="${episode.tvgId}"`);
        // tvg-name omitted — redundant and can confuse parsers
        if (episode.tvgLogo)    attributes.push(`tvg-logo="${episode.tvgLogo}"`);
        if (episode.groupTitle) attributes.push(`group-title="${episode.groupTitle}"`);

        const attrString = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';

        let extinfTitle: string;
        if (isArchive) {
          // Strip trailing segment timestamp (e.g. " 00:00", " 00:42") from title
          extinfTitle = episode.title.replace(/\s+\d{2}:\d{2}$/, '');
        } else if (flatTitles) {
          extinfTitle = episode.title;
        } else {
          const seasonStr  = episode.season.toString().padStart(2, '0');
          const episodeStr = episode.episode.toString().padStart(2, '0');
          extinfTitle = `${title} S${seasonStr}E${episodeStr} - ${episode.title}`;
        }

        // Archive.org entries use -1 (unknown/streaming length); others use actual duration
        const duration = isArchive ? -1 : episode.duration;
        lines.push(`#EXTINF:${duration}${attrString},${extinfTitle}`);
        lines.push(exportUrl);
      }
    }

    return lines.join('\r\n');
  }
}

export const m3uParser = new M3UParser();
