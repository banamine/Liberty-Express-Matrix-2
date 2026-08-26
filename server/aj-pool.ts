/**
 * aj-pool.ts — Alex Jones Network broadcast pool (v3)
 *
 * Primary source : https://rss.alexjones.media/AJNHourlyVideo.html
 *   → full-hour M4V files at https://ajn.archives.pub/hourly-m4v/
 *   → date-stamped filenames: YYYYMMDD_Day_Show-HrN.m4v
 *   → each M4V URL is HEAD-probed; on failure falls back to HD MP4
 *
 * HD MP4 fallback: https://rss.alexjones.media/hourly-mp4-HD.html
 *   → full-hour MP4s at https://ajn.archives.pub/hourly-mp4/HD/
 *   → short stable names: Show-Day-HrN.mp4 — matched to M4V by slot key
 *
 * Date-window filtering (applied to M4V listing):
 *   1. Rolling 7-day window (168 h) using date embedded in filename
 *   2. All M4V items, regardless of age — ascending fallback
 *   3. HD MP4 fallback when M4V listing is empty
 *   4. Legacy segments feed (opt-in via AJ_LEGACY_FALLBACK=true)
 *   5. STATIC_HD_FILENAMES hardcoded list → final guard
 *
 * AjFile fields: url = videoUrl (primary); fallbackUrl = HD MP4; sourceFormat = "m4v" | "mp4-fallback"
 * Cursor shape: { filename, modMs, fileIdx?, offsetSec } — identity-first
 */

import * as cheerio from "cheerio";
import { readFileSync, writeFileSync } from "fs";
import { writeTimeSeriesEntry, computeStatus } from './time-series';
import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { getDb, ensureDbReady } from "./db";
import { ajEpisodes } from "../shared/schema";

// ── Feed configuration ────────────────────────────────────────────────────────

const HD_BASE_URL          = "https://ajn.archives.pub/hourly-mp4/HD/";
const HD_RSS_PAGE          = "https://rss.alexjones.media/hourly-mp4-HD.html";
const HD_RSS_PAGE_FALLBACK = "https://rss.alexjones.media/AJNHourlyVideo.html";

// M4V primary source — date-stamped full-hour M4V files
const M4V_BASE_URL = "https://ajn.archives.pub/hourly-m4v/";
const M4V_RSS_PAGE = "https://rss.alexjones.media/AJNHourlyVideo.html";

const LEGACY_BASE_URL = "https://ajn.archives.pub/affils/mp4-segs/";
const LEGACY_RSS_PAGE = "https://rss.alexjones.media/mp4-segs.html";

// Toggle legacy segments feed as a fallback without re-deploying.
const ENABLE_LEGACY_FALLBACK = process.env.AJ_LEGACY_FALLBACK === "true";

const PROBE_BYTES         = 262_144;              // 256 KB — enough for mvhd in most MP4s
const REFRESH_MS          = 4 * 60 * 60 * 1_000; // 4 h periodic refresh
const DURATION_CACHE_PATH = ".local/aj-durations.json";

/** Alex-Mon-Hr{1..4} + WarRoom-Mon-Hr{1..3} = 7 Monday slots in the static pool.
 *  The test suite enforces this value against STATIC_HD_FILENAMES as a hard failure
 *  to catch accidental lineup mismatches without a deliberate constant update. */
export const MONDAY_EXPECTED_FILES = 7;

/** Case-insensitive filename comparison — deterministic across platforms and
 *  resilient to casing differences in the source listing. */
const fnCmp = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: "accent" });

/** Day-of-week broadcast order (Mon = 0 … Sun = 6).
 *  Files are overwritten weekly so the filename day-token is the ground truth
 *  regardless of when the file was uploaded. */
const DAY_ORDER: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** Show priority within a day (Alex Jones airs first, then War Room, etc.). */
const SHOW_ORDER: Record<string, number> = {
  Alex: 0, WarRoom: 1, TNT: 2, Sortor: 3,
};

/** Return a stable sort key [dayOfWeek, showPriority, hourNumber] for an
 *  HD filename so that the natural broadcast-week order is maintained.
 *  Mon·Alex·Hr1 → [0, 0, 1] … Sun·Sortor·Hr1 → [6, 3, 1]. */
function broadcastSortKey(filename: string): [number, number, number] {
  // HD format: {Show}-{Day}-Hr{N}.mp4
  const m = filename.match(/^(\w+)-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-Hr(\d+)\.mp4$/i);
  if (m) {
    const day  = DAY_ORDER[m[2]]  ?? 99;
    const show = SHOW_ORDER[m[1]] ?? 50;
    const hr   = parseInt(m[3], 10);
    return [day, show, hr];
  }
  // Fallback for legacy / unknown filenames — sort after all HD entries.
  return [99, 99, 99];
}

/** Sort key for M4V date-stamped filenames: YYYYMMDD_Day_Show-HrN.m4v */
function broadcastSortKeyM4v(filename: string): [number, number, number] {
  const m = filename.match(/^\d{8}_(\w+)_(\w+)-Hr(\d+)\.m4v$/i);
  if (m) {
    const day  = DAY_ORDER[m[1]]  ?? 99;
    const show = SHOW_ORDER[m[2]] ?? 50;
    const hr   = parseInt(m[3], 10);
    return [day, show, hr];
  }
  return [99, 99, 99];
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AjFile {
  index:           number;
  filename:        string;
  /** Primary playback URL — m4v when sourceFormat="m4v", HD MP4 otherwise. Alias of videoUrl. */
  url:             string;
  /** Explicit primary playback URL (m4v preferred). Identical to url. */
  videoUrl:        string;
  /** HD MP4 fallback URL — always mp4 regardless of sourceFormat. */
  fallbackUrl:     string;
  /** "m4v" when the live m4v URL was reachable; "mp4-fallback" otherwise. */
  sourceFormat:    "m4v" | "mp4-fallback";
  title:           string;
  durationSec:     number;     // from mvhd probe, or filename estimate
  creationTimeSec: number;     // Unix seconds (0 if probe failed)
  modMs:           number;     // listing mod timestamp (ms epoch); 0 if unavailable
  probedAt:        number | null; // epoch ms when probe ran, null = estimate-only
  /** Show identifier extracted from filename, e.g. "Alex", "WarRoom", "TNT". */
  showKey:         string;
  /** True when this is the first hour (Hr1) of a show — segment-1 marker. */
  isFirstHour:     boolean;
  /** Stable content identity: "aj-" + md5(filename+modMs).slice(0,16).
   *  Survives pool refreshes; used by LP2 endNews() same-episode resume. */
  episodeId:       string;
}

/**
 * Identity-first position marker for the AJ broadcast cursor.
 * `filename` + `modMs` form the stable identity of the current file.
 * `fileIdx` is an optional positional convenience; it may drift after a
 * pool reorder — `setAjCursor` always re-resolves by filename first,
 * falling back to fileIdx only when the filename is absent or not found.
 */
export interface AjCursor {
  filename:  string;   // identity key — filename of the current AJ file
  modMs:     number;   // listing mod date of that file (ms epoch); 0 if unknown
  fileIdx?:  number;   // optional positional index (may drift after pool refresh)
  offsetSec: number;   // playback position within the file (seconds)
}

/** Internal: raw entry from listing page before probing. */
interface AjRawEntry {
  filename: string;
  url:      string;
  modMs:    number; // 0 if listing date not parsed
}

// ── Static fallback lists ─────────────────────────────────────────────────────

// HD full-hour files (Mon–Fri, primary shows): used when all live feeds fail.
// Exported so the test suite can enforce MONDAY_EXPECTED_FILES against it.
export const STATIC_HD_FILENAMES: readonly string[] = [
  "Alex-Mon-Hr1.mp4", "Alex-Mon-Hr2.mp4", "Alex-Mon-Hr3.mp4", "Alex-Mon-Hr4.mp4",
  "Alex-Tue-Hr1.mp4", "Alex-Tue-Hr2.mp4", "Alex-Tue-Hr3.mp4", "Alex-Tue-Hr4.mp4",
  "Alex-Wed-Hr1.mp4", "Alex-Wed-Hr2.mp4", "Alex-Wed-Hr3.mp4", "Alex-Wed-Hr4.mp4",
  "Alex-Thu-Hr1.mp4", "Alex-Thu-Hr2.mp4", "Alex-Thu-Hr3.mp4", "Alex-Thu-Hr4.mp4",
  "Alex-Fri-Hr1.mp4", "Alex-Fri-Hr2.mp4", "Alex-Fri-Hr3.mp4", "Alex-Fri-Hr4.mp4",
  "WarRoom-Mon-Hr1.mp4", "WarRoom-Mon-Hr2.mp4", "WarRoom-Mon-Hr3.mp4",
  "WarRoom-Tue-Hr1.mp4", "WarRoom-Tue-Hr2.mp4", "WarRoom-Tue-Hr3.mp4",
  "WarRoom-Wed-Hr1.mp4", "WarRoom-Wed-Hr2.mp4", "WarRoom-Wed-Hr3.mp4",
  "WarRoom-Thu-Hr1.mp4", "WarRoom-Thu-Hr2.mp4", "WarRoom-Thu-Hr3.mp4",
  "WarRoom-Fri-Hr1.mp4", "WarRoom-Fri-Hr2.mp4", "WarRoom-Fri-Hr3.mp4",
];

// ── Title / duration helpers ──────────────────────────────────────────────────

const SHOW_NAMES: Record<string, string> = {
  Alex:    "Alex Jones Show",
  WarRoom: "War Room",
  TNT:     "TNT Radio",
  Sortor:  "Sortor",
};

const DAY_NAMES: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday",
  Thu: "Thursday", Fri: "Friday", Sun: "Sunday",
};

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/**
 * Extract the show key from a filename for grouping purposes.
 * M4V format:    20260602_Tue_WarRoom-Hr3.m4v → "WarRoom"
 * HD format:     Alex-Fri-Hr1.mp4             → "Alex"
 * Legacy format: Mon-Alex-Hr1-Seg2.mp4        → "Alex"
 * Unknown:       returns filename stem
 */
function extractShowKey(filename: string): string {
  // M4V date-stamped: YYYYMMDD_Day_Show-HrN.m4v
  const m4v = filename.match(/^\d{8}_\w+_(\w+)-Hr\d/i);
  if (m4v) return m4v[1];
  const hd  = filename.match(/^(\w+)-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-Hr\d/i);
  if (hd) return hd[1];
  const leg = filename.match(/^\w+-(\w+)-Hr\d/i);
  if (leg) return leg[1];
  return filename.replace(/\.(mp4|m4v)$/i, "");
}

/** True when the filename is the first hour (Hr1) of a show — segment-1 marker. */
function extractIsFirstHour(filename: string): boolean {
  return /Hr1\.(mp4|m4v)$/i.test(filename);
}

/** Stable content identity derived from filename + modMs.
 *  Survives pool refreshes — the same file at the same modMs always gets the
 *  same episodeId regardless of pool index drift after a re-upload cycle. */
function makeEpisodeId(filename: string, modMs: number): string {
  return "aj-" + createHash("md5").update(filename + String(modMs)).digest("hex").slice(0, 16);
}

/** Day-slot key for ordinal anchoring (HD mp4), e.g. "tue_warroom_h3".
 *  Used to supplement the 7-day rolling window with static-pool fill-ins
 *  when a slot is absent due to re-upload timing. */
function slotKey(filename: string): string {
  const m = filename.match(/^(\w+)-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-Hr(\d+)\.mp4$/i);
  if (m) return `${m[2].toLowerCase()}_${m[1].toLowerCase()}_h${m[3]}`;
  return filename.toLowerCase().replace(/\.mp4$/i, "");
}

/** Day-slot key for M4V date-stamped filenames, e.g. "tue_warroom_h3".
 *  Matches the same key format as slotKey() so m4v↔mp4 cross-matching works. */
function slotKeyM4v(filename: string): string {
  // Format: YYYYMMDD_Day_Show-HrN.m4v (e.g. 20260602_Tue_WarRoom-Hr3.m4v)
  const m = filename.match(/^\d{8}_(\w+)_(\w+)-Hr(\d+)\.m4v$/i);
  if (m) return `${m[1].toLowerCase()}_${m[2].toLowerCase()}_h${m[3]}`;
  return filename.toLowerCase().replace(/\.m4v$/i, "");
}

/** Extract a Unix ms timestamp from a date-stamped M4V filename (YYYYMMDD prefix).
 *  Returns 0 when the pattern is not found or the date is invalid. */
function parseMvhDateFromFilename(filename: string): number {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})_/);
  if (!m) return 0;
  const d = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

const MONTH_ABBR: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

/** Build a display title from an M4V, HD, or legacy segment filename. */
function makeTitle(filename: string): string {
  // M4V date-stamped format: YYYYMMDD_Day_Show-HrN.m4v (e.g. 20260602_Tue_WarRoom-Hr3.m4v)
  const m4v = filename.match(/^(\d{4})(\d{2})(\d{2})_(\w+)_(\w+)-Hr(\d+)\.m4v$/i);
  if (m4v) {
    const show  = SHOW_NAMES[m4v[5]] ?? m4v[5];
    const day   = DAY_NAMES[m4v[4]] ?? m4v[4];
    const month = MONTH_ABBR[m4v[2]] ?? m4v[2];
    return `${m4v[1]}-${month}-${m4v[3]}, ${day} · ${show} · Hour ${m4v[6]}`;
  }
  // HD format: {Show}-{Day}-Hr{N}.mp4  (e.g. Alex-Fri-Hr1.mp4)
  const hd = filename.match(/^(\w+)-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-Hr(\d+)\.mp4$/i);
  if (hd) {
    const show = SHOW_NAMES[hd[1]] ?? hd[1];
    const day  = DAY_NAMES[hd[2]] ?? hd[2];
    return `${show} · ${day} · Hour ${hd[3]}`;
  }
  // Legacy segment format: {Day}-{Show}-Hr{N}-Seg{N}.mp4
  const leg = filename.match(/^(\w+)-(\w+)-Hr(\d+)-Seg(\d+)\.mp4$/i);
  if (leg) {
    const show = SHOW_NAMES[leg[2]] ?? leg[2];
    return `${show} · Hr ${leg[3]} · Seg ${leg[4]}`;
  }
  return filename.replace(/\.(mp4|m4v)$/i, "");
}

/** Estimate duration when Range probe is unavailable. */
function estimateDuration(filename: string): number {
  // Legacy segment files: Seg1 ≈ 300 s, Seg2/3 ≈ 1440 s
  if (/Seg\d+/i.test(filename)) return /Seg1/i.test(filename) ? 300 : 1_440;
  // HD full-hour files ≈ 3600 s
  return 3_600;
}

/** Parse a directory-listing date token into a Unix ms timestamp.
 *  Format: "Apr 24 12:01" — year is inferred (current year, or previous
 *  if the resulting date would be more than one day in the future). */
function parseListingDate(mon: string, day: string, hhmm: string): number {
  const m = MONTH_MAP[mon] ?? 0;
  const d = parseInt(day, 10);
  const [hh = 0, mm = 0] = hhmm.split(":").map(Number);
  const year = new Date().getFullYear();
  let dt = new Date(Date.UTC(year, m, d, hh, mm, 0, 0));
  if (dt.getTime() > Date.now() + 86_400_000) {
    dt = new Date(Date.UTC(year - 1, m, d, hh, mm, 0, 0));
  }
  return dt.getTime();
}

// ── Listing page parsers ──────────────────────────────────────────────────────

/** Parse the HD directory listing HTML into raw entries with mod dates.
 *  The listing uses &nbsp; between fields:
 *    [&nbsp;{size}&nbsp;{Mon}&nbsp;{DD}&nbsp;{HH:MM}]&nbsp;&nbsp;<a href="url">
 */
function parseHdListing(html: string): AjRawEntry[] {
  const norm = html.replace(/&nbsp;/g, " ");
  // Match: [size  Mon  DD  HH:MM]...href="url.mp4"
  // Note: use .*? (not [^<]*?) so the match crosses the intervening <a tag.
  const re = /\[\s*\d+\s+(\w+)\s+(\d+)\s+([\d:]+)\].*?href="([^"]+\.mp4)"/gi;
  const entries: AjRawEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    const [, mon, day, hhmm, url] = m;
    const filename = url.split("/").pop() ?? "";
    if (!filename) continue;
    entries.push({ filename, url, modMs: parseListingDate(mon, day, hhmm) });
  }
  return entries;
}

/** Fetch the M4V listing from AJNHourlyVideo.html — date-stamped .m4v filenames.
 *  Scans anchor hrefs first; falls back to a regex text scan. Returns [] on failure. */
async function fetchM4vEntries(): Promise<AjRawEntry[]> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(M4V_RSS_PAGE, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $    = cheerio.load(html);
    const filenames = new Set<string>();
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") ?? "";
      const m    = href.match(/([^/\\]+\.m4v)$/i);
      if (m) filenames.add(m[1]);
    });
    // Fallback: text scan for YYYYMMDD_Day_Show-HrN.m4v patterns
    if (filenames.size === 0) {
      const text = $.root().text();
      const re   = /\b(\d{8}_\w+_\w+-Hr\d+\.m4v)\b/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) filenames.add(match[1]);
    }
    if (filenames.size === 0) throw new Error("no .m4v entries found in listing");
    const entries = [...filenames].map(fn => ({
      filename: fn,
      url:      `${M4V_BASE_URL}${fn}`,
      modMs:    0, // date will be extracted from filename by parseMvhDateFromFilename()
    }));
    console.log(`[AJPool] M4V listing: ${entries.length} file(s) from ${M4V_RSS_PAGE}`);
    return entries;
  } catch (e) {
    clearTimeout(tid);
    console.warn(`[AJPool] M4V listing fetch failed (${(e as Error).message})`);
    return [];
  }
}

/** Lightweight HEAD probe to check if an M4V URL is reachable.
 *  Returns true on HTTP 2xx/206; false on network error or 4xx/5xx. */
async function probeM4vHead(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(tid);
    return res.ok || res.status === 206;
  } catch {
    clearTimeout(tid);
    return false;
  }
}

/** Fetch a single HD listing URL and return parsed entries (or [] on failure). */
async function fetchHdPage(url: string): Promise<AjRawEntry[]> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html    = await res.text();
    const entries = parseHdListing(html);
    if (entries.length === 0) throw new Error("no HD MP4 entries found in listing");
    return entries;
  } catch (e) {
    clearTimeout(tid);
    console.warn(`[AJPool] HD RSS fetch failed for ${url} (${(e as Error).message})`);
    return [];
  }
}

/** Fetch the HD listing page with automatic fallback to the legacy URL. */
async function fetchHdEntries(): Promise<AjRawEntry[]> {
  const primary = await fetchHdPage(HD_RSS_PAGE);
  if (primary.length > 0) return primary;
  console.warn(`[AJPool] Primary RSS page returned 0 entries — trying fallback URL.`);
  return fetchHdPage(HD_RSS_PAGE_FALLBACK);
}

/** Fetch the legacy segments listing (cheerio anchor scan). */
async function fetchLegacyEntries(): Promise<AjRawEntry[]> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(LEGACY_RSS_PAGE, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $    = cheerio.load(html);
    const filenames = new Set<string>();
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") ?? "";
      const m    = href.match(/([^/\\]+\.mp4)$/i);
      if (m) filenames.add(m[1]);
    });
    if (filenames.size === 0) {
      const text = $.root().text();
      const re   = /\b(\w+-\w+-Hr\d+-Seg\d+\.mp4)\b/gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) filenames.add(match[1]);
    }
    if (filenames.size === 0) throw new Error("no filenames found in legacy listing");
    return [...filenames].map(fn => ({
      filename: fn,
      url:      `${LEGACY_BASE_URL}${fn}`,
      modMs:    0,
    }));
  } catch (e) {
    clearTimeout(tid);
    console.warn(`[AJPool] Legacy RSS fetch failed (${(e as Error).message})`);
    return [];
  }
}

// ── Date-window selection ─────────────────────────────────────────────────────

/** Apply the rolling 7-day window selection and return final raw entries.
 *  Primary: files whose listing date is within the last 168 h (7 days), sorted
 *  ascending by modMs so index 0 is always the oldest hour (the natural broadcast
 *  start of the window — e.g. Monday Hr1 when the window opens on Monday).
 *  Fallback: all HD entries sorted ascending when the 7-day window is empty.
 *  Legacy / static guards follow when all live feeds fail. */
async function selectEntries(): Promise<AjRawEntry[]> {
  const hdEntries = await fetchHdEntries();
  const now       = Date.now();
  const SEVEN_DAYS_MS = 7 * 86_400_000; // 168 h strict expiry

  if (hdEntries.length > 0) {
    // ── Undated-entry audit — once per refresh cycle ──────────────────────────
    const undated = hdEntries.filter(e => e.modMs === 0);
    if (undated.length > 0) {
      const pct   = undated.length / hdEntries.length;
      const names = undated.map(e => e.filename).join(", ");
      if (pct >= 0.20) {
        console.warn(
          `[AJPool] ALERT: ${Math.round(pct * 100)}% of entries missing listing dates` +
          ` — possible feed format change (${undated.length}/${hdEntries.length}): ${names}`,
        );
      } else {
        console.log(
          `[AJPool] ${undated.length}/${hdEntries.length} file(s) have no listing date: ${names}`,
        );
      }
    }

    const dated = hdEntries.filter(e => e.modMs > 0);

    // Broadcast-week comparator: sorts by [dayOfWeek, showPriority, hourNumber]
    // extracted from the filename so Monday is always index 0 regardless of
    // upload timestamp.  Files are overwritten weekly — the filename day-token
    // is the authoritative broadcast-day marker.
    const bcastCmp = (a: AjRawEntry, b: AjRawEntry): number => {
      const [ad, as_, ah] = broadcastSortKey(a.filename);
      const [bd, bs_, bh] = broadcastSortKey(b.filename);
      return (bd - ad) || (bs_ - as_) || (bh - ah) || fnCmp(b.filename, a.filename);
    };

    // Window 1 — rolling 7-day window (strict 168 h expiry)
    // Sorted by broadcast-week position: Mon·Alex·Hr1 first, Sun·Sortor·HrN last.
    const w7 = dated.filter(e => now - e.modMs < SEVEN_DAYS_MS);
    if (w7.length > 0) {
      // Ordinal slot anchoring: fill gaps left by re-upload timing.
      // Any static-pool slot that is missing from the dated window is supplemented
      // with the static-pool file so the schedule never collapses to a partial week.
      const w7SlotKeys = new Set(w7.map(e => slotKey(e.filename)));
      const fillIns = STATIC_HD_FILENAMES
        .filter(fn => !w7SlotKeys.has(slotKey(fn)))
        .map(fn => ({ filename: fn, url: `${HD_BASE_URL}${fn}`, modMs: 0 }));
      if (fillIns.length > 0) {
        console.log(`[AJPool] Ordinal anchoring: ${w7.length} dated + ${fillIns.length} static fill-in slot(s): ${fillIns.map(f => f.filename).join(", ")}`);
      }
      const anchored = [...w7, ...fillIns];
      console.log(`[AJPool] 7-day rolling window: ${anchored.length} file(s) (${w7.length} dated, ${fillIns.length} fill-in, broadcast-week order)`);
      return anchored.sort(bcastCmp);
    }

    // Window 2 — all HD entries (7-day window empty, e.g. beyond weekend gap)
    // Same broadcast-week sort for consistency.
    console.log(`[AJPool] 7-day window empty — using all ${hdEntries.length} HD file(s) as fallback (broadcast-week order)`);
    return hdEntries.sort(bcastCmp);
  }

  // Window 4 — legacy segments feed (opt-in); no dates → sort by filename only
  if (ENABLE_LEGACY_FALLBACK) {
    console.log("[AJPool] Trying legacy segments feed as fallback…");
    const legacy = await fetchLegacyEntries();
    if (legacy.length > 0) return legacy.sort((a, b) => fnCmp(a.filename, b.filename));
  }

  // Window 5 — hardcoded static HD list; order is intentional, leave unchanged
  console.warn("[AJPool] All live feeds failed — using static HD fallback list");
  return STATIC_HD_FILENAMES.map(fn => ({
    filename: fn,
    url:      `${HD_BASE_URL}${fn}`,
    modMs:    0,
  }));
}

// ── MP4 mvhd box parsing ───────────────────────────────────────────────────────
// MP4 epoch is 1904-01-01 00:00:00 UTC.  Unix epoch is 1970-01-01.
// Offset between the two epochs in seconds:
const MP4_EPOCH_OFFSET_S = 2_082_844_800;

function parseMvhd(buf: Buffer): { durationSec: number; creationTimeSec: number } | null {
  for (let i = 0; i <= buf.length - 8; i++) {
    if (
      buf[i + 4] === 0x6d && // 'm'
      buf[i + 5] === 0x76 && // 'v'
      buf[i + 6] === 0x68 && // 'h'
      buf[i + 7] === 0x64    // 'd'
    ) {
      const version = buf[i + 8];
      if (version === 1) {
        if (i + 40 > buf.length) return null;
        const ctHigh  = buf.readUInt32BE(i + 12);
        const ctLow   = buf.readUInt32BE(i + 16);
        const creationMp4 = ctHigh * 4_294_967_296 + ctLow;
        const timescale   = buf.readUInt32BE(i + 28);
        const durHigh     = buf.readUInt32BE(i + 32);
        const durLow      = buf.readUInt32BE(i + 36);
        const durTicks    = durHigh * 4_294_967_296 + durLow;
        if (timescale === 0) return null;
        return {
          durationSec:     durTicks / timescale,
          creationTimeSec: creationMp4 > MP4_EPOCH_OFFSET_S ? creationMp4 - MP4_EPOCH_OFFSET_S : 0,
        };
      } else {
        if (i + 28 > buf.length) return null;
        const creationMp4 = buf.readUInt32BE(i + 12);
        const timescale   = buf.readUInt32BE(i + 20);
        const durTicks    = buf.readUInt32BE(i + 24);
        if (timescale === 0) return null;
        return {
          durationSec:     durTicks / timescale,
          creationTimeSec: creationMp4 > MP4_EPOCH_OFFSET_S ? creationMp4 - MP4_EPOCH_OFFSET_S : 0,
        };
      }
    }
  }
  return null;
}

async function probeFile(url: string): Promise<{ durationSec: number; creationTimeSec: number }> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
      signal:  ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok && res.status !== 206 && res.status !== 200) {
      throw new Error(`HTTP ${res.status}`);
    }
    // Stream-read with a hard byte cap so we never OOM if the server ignores
    // the Range header and streams back a full multi-gigabyte MP4.
    // arrayBuffer() would block until the entire response is buffered — fatal
    // when the body is several GB × 4 concurrent probes.
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let totalRead = 0;
    while (totalRead < PROBE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const slice = totalRead + value.length > PROBE_BYTES
          ? value.subarray(0, PROBE_BYTES - totalRead)
          : value;
        chunks.push(slice);
        totalRead += slice.length;
      }
    }
    // Cancel the body stream — drops the TCP connection so we don't leave a
    // dangling download of a 4 GB file open in the background.
    reader.cancel().catch(() => {});
    const arr    = Buffer.concat(chunks);
    const parsed = parseMvhd(arr);
    if (!parsed) throw new Error("mvhd not found in first 256 KB");
    return parsed;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

// ── M4V hit-rate tracking (for getAjStatus()) ─────────────────────────────────
let _lastM4vHitCount  = 0;
let _lastM4vTotalCount = 0;

// ── Refresh pipeline ──────────────────────────────────────────────────────────

async function refreshPool(): Promise<void> {
  console.log("[AJPool] Refreshing — M4V primary source + HD MP4 fallback…");

  const CONCURRENCY = 4;

  // ── 1. Fetch M4V listing (primary source: AJNHourlyVideo.html) ───────────────
  const m4vRaw = await fetchM4vEntries();

  // rawEntries carries the fully-resolved URLs plus sourceFormat
  type ResolvedEntry = {
    filename:     string;
    url:          string; // = videoUrl (backward compat)
    videoUrl:     string;
    fallbackUrl:  string;
    sourceFormat: "m4v" | "mp4-fallback";
    modMs:        number;
  };
  let rawEntries: ResolvedEntry[];

  if (m4vRaw.length > 0) {
    // ── 2. Fetch HD MP4 listing for slot-based fallback matching ─────────────
    const hdRaw = await fetchHdEntries();
    const mp4SlotMap = new Map<string, string>();
    for (const e of hdRaw) {
      mp4SlotMap.set(slotKey(e.filename), e.url);
    }

    // ── 3. Extract dates from M4V filenames + apply 7-day window ─────────────
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 86_400_000;
    const m4vWithDates = m4vRaw.map(e => ({
      ...e,
      modMs: parseMvhDateFromFilename(e.filename),
    }));
    const m4vDated = m4vWithDates.filter(e => e.modMs > 0);
    const m4vW7    = m4vDated.filter(e => now - e.modMs < SEVEN_DAYS_MS);
    const m4vWindow = m4vW7.length > 0 ? m4vW7 : m4vWithDates;

    const bcastM4vCmp = (a: AjRawEntry, b: AjRawEntry): number => {
      const [ad, as_, ah] = broadcastSortKeyM4v(a.filename);
      const [bd, bs_, bh] = broadcastSortKeyM4v(b.filename);
      return (bd - ad) || (bs_ - as_) || (bh - ah) || fnCmp(b.filename, a.filename);
    };
    const m4vSorted = [...m4vWindow].sort(bcastM4vCmp);
    console.log(`[AJPool] M4V window: ${m4vSorted.length} file(s) (${m4vW7.length} in 7-day window)`);

    // ── 4. HEAD probe each M4V URL to check availability (parallel) ──────────
    const m4vAlive: boolean[] = new Array(m4vSorted.length).fill(false);
    for (let i = 0; i < m4vSorted.length; i += CONCURRENCY) {
      const batch = m4vSorted.slice(i, i + CONCURRENCY);
      const probeResults = await Promise.all(batch.map(e => probeM4vHead(e.url)));
      probeResults.forEach((alive, bIdx) => { m4vAlive[i + bIdx] = alive; });
    }
    _lastM4vHitCount   = m4vAlive.filter(Boolean).length;
    _lastM4vTotalCount = m4vSorted.length;
    console.log(`[AJPool] M4V HEAD probe: ${_lastM4vHitCount}/${_lastM4vTotalCount} alive`);

    // ── 5. Build resolved entries: videoUrl + fallbackUrl + sourceFormat ──────
    rawEntries = m4vSorted.map((e, idx) => {
      const alive       = m4vAlive[idx];
      const sk          = slotKeyM4v(e.filename);
      const mp4Url      = mp4SlotMap.get(sk) ?? "";
      const videoUrl    = alive ? e.url : (mp4Url || e.url);
      const fallbackUrl = mp4Url || e.url;
      const sourceFormat: "m4v" | "mp4-fallback" = alive ? "m4v" : "mp4-fallback";
      return { filename: e.filename, url: videoUrl, videoUrl, fallbackUrl, sourceFormat, modMs: e.modMs };
    });
  } else {
    // ── Fallback: M4V listing empty — use existing HD MP4 selection logic ─────
    console.warn("[AJPool] M4V listing empty — falling back to HD MP4 source");
    const hdSelected = await selectEntries();
    _lastM4vHitCount   = 0;
    _lastM4vTotalCount = hdSelected.length;
    rawEntries = hdSelected.map(e => ({
      ...e,
      videoUrl:     e.url,
      fallbackUrl:  e.url,
      sourceFormat: "mp4-fallback" as const,
    }));
  }

  // ── 6. Range probe for duration + creationTimeSec (parallel, CONCURRENCY=4) ─
  const results: AjFile[] = new Array(rawEntries.length);

  for (let i = 0; i < rawEntries.length; i += CONCURRENCY) {
    const batch = rawEntries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (entry, bIdx) => {
        const idx  = i + bIdx;
        // Seed creationTimeSec from listing date if available
        let creationTimeSec = entry.modMs > 0 ? Math.round(entry.modMs / 1_000) : 0;
        let probedAt: number | null = null;
        let durationSec: number;

        if (_durationCache[entry.filename] != null) {
          // Player-reported duration — most accurate, skip Range probe
          durationSec = _durationCache[entry.filename];
          probedAt    = Date.now();
        } else {
          durationSec = estimateDuration(entry.filename);
          try {
            const p     = await probeFile(entry.videoUrl);
            durationSec = Math.round(p.durationSec);
            // Prefer mvhd creation time; fall back to listing date
            creationTimeSec = p.creationTimeSec > 0
              ? Math.round(p.creationTimeSec)
              : creationTimeSec;
            probedAt    = Date.now();
          } catch (e) {
            const msg = (e as Error).message ?? "";
            if (/^HTTP 4/.test(msg)) {
              // Explicit 4xx from CDN — file has rolled off; drop it from pool
              results[idx] = null as any; // filtered by .filter(Boolean) below
              console.log(`[AJPool] Dead URL excluded (${msg}): ${entry.filename}`);
              return;
            }
            // Network error or mvhd parse failure — keep with estimated duration
          }
        }
        results[idx] = {
          index:        idx,
          filename:     entry.filename,
          url:          entry.videoUrl,
          videoUrl:     entry.videoUrl,
          fallbackUrl:  entry.fallbackUrl,
          sourceFormat: entry.sourceFormat,
          title:        makeTitle(entry.filename),
          durationSec,
          creationTimeSec,
          modMs:        entry.modMs,
          probedAt,
          showKey:      extractShowKey(entry.filename),
          isFirstHour:  extractIsFirstHour(entry.filename),
          episodeId:    makeEpisodeId(entry.filename, entry.modMs),
        };
      })
    );
  }

  const fresh = results.filter(Boolean);
  if (fresh.length > 0) {
    _files = fresh;
    
    // Action B: Write parsed data arrays to disk via time-series JSON archives
    try {
      const now = new Date(); // local server time
      for (const f of _files) {
        const entryDate = new Date(f.creationTimeSec ? f.creationTimeSec * 1000 : now.getTime());
        // Avoid timezone math incorrectly dropping broadcasts; don't filter out by offset
        const status = computeStatus(entryDate, now);
        
        writeTimeSeriesEntry({
          id: f.episodeId,
          url: f.videoUrl,
          title: f.title,
          timestamp: entryDate.toISOString(),
          status: status,
          duration: f.durationSec || 0
        });
      }
      console.log(`[AJPool] Wrote ${_files.length} entries to time-series JSON archives.`);
    } catch (e: any) {
      console.error(`[AJPool] Failed to write time-series archive: ${e.message}`);
    }
  } else if (_files.length === 0) {
    // First-ever refresh failed and pool is still empty — deploy static guard so
    // consumers never receive an empty array indefinitely.
    _files = buildStaticPool();
    console.warn("[AJPool] First refresh failed — temporary static HD pool deployed until next refresh.");
  } else {
    console.warn("[AJPool] Refresh produced 0 files — retaining previous live pool.");
  }
  lastRefreshedAt = Date.now();

  // ── DB upsert — persist episode identity for cross-session analytics ────────
  // Fire-and-forget so the pool refresh never stalls waiting for DB round-trips.
  // onConflictDoUpdate(episodeId): update modMs+filename if the file was re-uploaded.
  (async () => {
    try {
      await ensureDbReady();
      const db = getDb();
      const rows = _files.map(f => ({
        episodeId: f.episodeId,
        filename:  f.filename,
        modMs:     f.modMs,
      }));
      if (rows.length === 0) return;
      await db.insert(ajEpisodes)
        .values(rows)
        .onConflictDoUpdate({
          target: ajEpisodes.episodeId,
          set: {
            filename: sql`excluded.filename`,
            modMs:    sql`excluded.mod_ms`,
          },
        });
      console.log(`[AJPool] DB sync — upserted ${rows.length} episode(s) into aj_episodes.`);
    } catch (e) {
      console.warn("[AJPool] DB upsert failed (non-fatal):", (e as Error).message);
    }
  })();

  // Re-anchor cursor identity after pool refresh — filename is stable; index may have shifted.
  if (ajCursor.filename) {
    const resolved = _files.findIndex(f => f.filename === ajCursor.filename);
    if (resolved >= 0) {
      if (resolved !== ajCursor.fileIdx) {
        console.log(
          `[AJPool] Cursor re-anchored: "${ajCursor.filename}" → idx ${resolved}` +
          ` (was ${ajCursor.fileIdx ?? "?"})`,
        );
        ajCursor = { ...ajCursor, fileIdx: resolved };
      }
    } else {
      // Saved filename is no longer in the pool (e.g. Monday file rolled off).
      // Reset to a clean state so the next client load starts fresh via the
      // creation-time anchor rather than being trapped in a stale-filename loop.
      console.log(
        `[AJPool] Cursor filename "${ajCursor.filename}" not in refreshed pool — resetting cursor.`,
      );
      ajCursor = { filename: "", modMs: 0, fileIdx: 0, offsetSec: 0 };
    }
  }

  const probed   = _files.filter(f => f.probedAt !== null).length;
  const m4vInfo  = `${_lastM4vHitCount}/${_lastM4vTotalCount} m4v alive`;
  const legacyFlag = ENABLE_LEGACY_FALLBACK ? " (legacy fallback enabled)" : "";
  console.log(
    `[AJPool] Refreshed — ${_files.length} file(s), ` +
    `${probed} probed via Range, ${_files.length - probed} estimated. ` +
    `${m4vInfo}${legacyFlag}.`
  );
}

// ── Duration cache (player-reported, persisted to disk) ───────────────────────

let _durationCache: Record<string, number> = {};

function loadDurationCache(): void {
  try {
    const raw = readFileSync(DURATION_CACHE_PATH, "utf8");
    _durationCache = JSON.parse(raw);
    const n = Object.keys(_durationCache).length;
    if (n > 0) console.log(`[AJPool] Duration cache loaded — ${n} player-reported entries.`);
  } catch {
    _durationCache = {};
  }
}

function saveDurationCache(): void {
  try {
    writeFileSync(DURATION_CACHE_PATH, JSON.stringify(_durationCache, null, 2));
  } catch (e) {
    console.warn("[AJPool] Failed to save duration cache:", e);
  }
}

/** Called by the server route when LP2 reports a real duration after loadedmetadata. */
export function reportDuration(filename: string, durationSec: number): void {
  if (!filename || !(durationSec > 0) || !isFinite(durationSec)) return;
  const rounded = Math.round(durationSec);
  _durationCache[filename] = rounded;
  saveDurationCache();
  const file = _files.find(f => f.filename === filename);
  if (file) {
    file.durationSec = rounded;
    file.probedAt    = Date.now();
    console.log(`[AJPool] Player-reported duration: ${filename} = ${rounded}s (cached).`);
  }
}

// ── In-memory state ───────────────────────────────────────────────────────────

let ajBroadcastEnabled = false;

function buildStaticPool(): AjFile[] {
  return STATIC_HD_FILENAMES.map((filename, index) => {
    const url = `${HD_BASE_URL}${filename}`;
    return {
      index,
      filename,
      url,
      videoUrl:        url,
      fallbackUrl:     url,
      sourceFormat:    "mp4-fallback" as const,
      title:           makeTitle(filename),
      durationSec:     estimateDuration(filename),
      creationTimeSec: 0,
      modMs:           0,
      probedAt:        null,
      showKey:         extractShowKey(filename),
      isFirstHour:     extractIsFirstHour(filename),
      episodeId:       makeEpisodeId(filename, 0),
    };
  });
}

let _files: AjFile[]          = [];
let lastRefreshedAt: number | null = null;
// Cursor initialized empty — refreshPool() will seed identity on first successful load.
let ajCursor: AjCursor = {
  filename:  _files[0]?.filename ?? "",
  modMs:     0,
  fileIdx:   0,
  offsetSec: 0,
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getAjFiles(): AjFile[] { return _files; }
export function getAjPool():  AjFile[] { return _files; } // alias for route compatibility

export function isAjBroadcastEnabled(): boolean   { return ajBroadcastEnabled; }
export function setAjBroadcastEnabled(v: boolean) { ajBroadcastEnabled = v; }

export function getAjCursor(): AjCursor { return { ...ajCursor }; }

export function setAjCursor(c: AjCursor): void {
  const max = Math.max(0, _files.length - 1);
  // Identity-first: locate by filename when provided and found in the pool.
  // Falls back to fileIdx (optional convenience) when filename is absent or not matched.
  let idx = c.fileIdx ?? 0;
  let foundInPool = false;
  if (c.filename) {
    const byName = _files.findIndex(f => f.filename === c.filename);
    if (byName >= 0) {
      idx = byName;
      foundInPool = true;
    }
    // else: filename not in current pool — file may have rolled off; use fileIdx as best-effort
    // Do NOT replace the incoming filename with whatever file sits at idx=0.
  }
  idx = Math.max(0, Math.min(Math.round(idx), max));
  const resolved = _files[idx]; // always a valid pool entry for metadata/fallback
  // Filename resolution:
  //   • c.filename present AND found   → use pool entry's filename (canonical)
  //   • c.filename present AND missing → PRESERVE incoming identity; the file may
  //     have rolled off the pool and will return on the next 4-hour refresh.
  //     Clobbering it with resolved.filename would corrupt the cursor permanently.
  //   • c.filename absent / empty      → nothing to preserve; use pool entry.
  const preserveIdentity = !!c.filename && !foundInPool;
  ajCursor = {
    filename:  preserveIdentity ? c.filename             : (resolved?.filename ?? c.filename ?? ""),
    modMs:     preserveIdentity ? (c.modMs ?? 0)         : (resolved?.modMs    ?? c.modMs    ?? 0),
    fileIdx:   idx,
    offsetSec: Math.max(0, c.offsetSec),
  };
}

export function advanceAjCursor(): AjCursor {
  const len     = _files.length;
  if (len === 0) return { ...ajCursor }; // empty pool — preserve current position
  const nextIdx = (((ajCursor.fileIdx ?? 0) + 1) % len);
  const next    = _files[nextIdx];
  ajCursor = {
    filename:  next?.filename ?? "",
    modMs:     next?.modMs    ?? 0,
    fileIdx:   nextIdx,
    offsetSec: 0,
  };
  return { ...ajCursor };
}

export function getAjStatus() {
  const m4vHitRate = _lastM4vTotalCount > 0
    ? Math.round((_lastM4vHitCount / _lastM4vTotalCount) * 100)
    : null;
  return {
    enabled:         ajBroadcastEnabled,
    cursor:          { ...ajCursor },
    files:           _files,
    lastRefreshedAt: lastRefreshedAt,
    currentFile:     _files[ajCursor.fileIdx ?? 0] ?? null,
    legacyFallback:  ENABLE_LEGACY_FALLBACK,
    m4vHitRate,
    m4vHits:         _lastM4vHitCount,
    m4vTotal:        _lastM4vTotalCount,
  };
}

export async function refreshAjPool(): Promise<void> {
  await refreshPool();
}

let _refreshTimer: ReturnType<typeof setInterval> | null = null;

export function startAjPool(): void {
  if (_refreshTimer) return; // idempotent
  loadDurationCache();
  refreshPool().catch(e => console.warn("[AJPool] Initial refresh error:", e));
  _refreshTimer = setInterval(
    () => refreshPool().catch(e => console.warn("[AJPool] Periodic refresh error:", e)),
    REFRESH_MS
  );
}
