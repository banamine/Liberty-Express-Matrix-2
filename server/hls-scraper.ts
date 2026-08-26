import * as cheerio from "cheerio";
import * as vm from "node:vm";

export interface ScrapedVideo {
  pageUrl: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  videoUrlFull: string;
  videoType: "hls" | "mp4" | "brightcove" | "jwplayer" | "theplatform" | "kaltura" | "embed" | "unknown";
  provider?: string;
  error?: string;
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const MAX_BODY = 3 * 1024 * 1024;

function assertPublicUrl(raw: string): void {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Invalid URL"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Protocol not allowed");
  const h = u.hostname;
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$)/i.test(h))
    throw new Error("Private/local addresses not allowed");
}

const dedupeKey = (u: string): string => {
  try {
    const p = new URL(u);
    return (p.hostname + p.pathname).toLowerCase();
  } catch {
    return u.toLowerCase();
  }
};

async function fetchHtml(url: string): Promise<string | null> {
  assertPublicUrl(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      total += value.length;
      chunks.push(value);
      if (total >= MAX_BODY) {
        reader.cancel().catch(() => {});
        break;
      }
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string): Promise<string | null> {
  assertPublicUrl(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function parseRssFeedLinks(xml: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const links: string[] = [];
  const DW_ARTICLE_RE = /\/en\/[^"'\s]+\/(?:a|video)-\d+/;
  $("item").each((_, el) => {
    const linkText = $("link", el).text().trim();
    const guid = $("guid", el).text().trim();
    const candidate = (linkText || guid).split("?")[0];
    if (candidate.includes("dw.com") && DW_ARTICLE_RE.test(candidate)) {
      links.push(candidate);
    }
  });
  return links;
}

async function fetchJson(url: string, timeoutMs = 5000): Promise<unknown> {
  assertPublicUrl(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, Accept: "application/json, application/xml, */*" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("xml")) return { _xml: await res.text() };
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function walkJson(obj: unknown, keys: string[], depth = 0): string | null {
  if (depth > 10 || obj === null || obj === undefined) return null;
  if (typeof obj === "string") {
    for (const k of keys) {
      if (obj.includes(k)) return obj;
    }
    return null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = walkJson(item, keys, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (keys.some(kk => k.toLowerCase().includes(kk)) && typeof v === "string") {
        if (v.includes(".m3u8") || v.includes(".mp4") || v.includes(".webm")) return v;
      }
      const r = walkJson(v, keys, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function isVideoUrl(u: string): boolean {
  return /\.(m3u8|mp4|webm|mpd)(\?|$)/i.test(u);
}

function classifyUrl(u: string): "hls" | "mp4" | "unknown" {
  if (/\.m3u8/i.test(u)) return "hls";
  if (/\.mp4/i.test(u)) return "mp4";
  return "unknown";
}

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractMetadata($: cheerio.CheerioAPI, pageUrl: string) {
  const getMeta = (prop: string) =>
    $(`meta[property="${prop}"]`).attr("content") ||
    $(`meta[name="${prop}"]`).attr("content") || "";

  let title =
    getMeta("og:title") ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "";
  title = title.replace(/\s*[-|–]\s*(Fox News|CNN|MSNBC|NBC|ABC|CBS)\s*$/i, "").trim();

  const description =
    (getMeta("og:description") ||
    getMeta("description") ||
    $("p").first().text().trim() ||
    "").slice(0, 200);

  const thumbnail =
    getMeta("og:image") ||
    getMeta("twitter:image") ||
    $("img[data-src]").first().attr("data-src") ||
    (() => {
      let best = "";
      $("img[src]").each((_, el) => {
        const src = $(el).attr("src") || "";
        const w = parseInt($(el).attr("width") || "0", 10);
        if (w > 100 && !best) best = src;
      });
      return best;
    })() ||
    "";

  return { title, description, thumbnail };
}

async function resolveJwPlayerId(mediaId: string): Promise<string | null> {
  try {
    const data = await fetchJson(`https://cdn.jwplayer.com/v2/media/${mediaId}`) as any;
    const sources = data?.playlist?.[0]?.sources ?? [];
    const hlsSources = sources.filter((s: any) =>
      s.type === "application/vnd.apple.mpegurl" || (s.file || s.src || "").includes(".m3u8")
    );
    hlsSources.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
    const best = hlsSources[0];
    return best?.file || best?.src || null;
  } catch {
    return null;
  }
}

async function resolveThePlatform(tpPath: string): Promise<string | null> {
  try {
    const smilUrl = `https://link.theplatform.com/s/${tpPath}?format=SMIL&formats=m3u8`;
    const data = await fetchJson(smilUrl) as any;
    if (data?._xml) {
      const m = (data._xml as string).match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/);
      if (m) return m[0];
    }
    return null;
  } catch {
    return null;
  }
}

function runJsSandbox(scripts: string[], pageUrl: string): string[] {
  const discovered: string[] = [];
  const m3u8Regex = /https?:\/\/[^\s"']+\.m3u8[^\s"']*/g;

  const fakeResponse = () => ({
    ok: true,
    json: async () => ({}),
    text: async () => "",
    headers: { get: () => null },
  });

  const sandbox = {
    window: {} as any,
    document: {
      createElement: () => ({}),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    navigator: { userAgent: HEADERS["User-Agent"] },
    location: { href: pageUrl, origin: new URL(pageUrl).origin },
    console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
    setTimeout: () => 0,
    clearTimeout: () => {},
    fetch: async (url: string) => {
      if (url) discovered.push(typeof url === "string" ? url : String(url));
      return fakeResponse();
    },
    XMLHttpRequest: class {
      open(_: string, url: string) {
        if (url) discovered.push(typeof url === "string" ? url : String(url));
      }
      send() {}
      setRequestHeader() {}
      addEventListener() {}
    },
    encodeURIComponent,
    decodeURIComponent,
    JSON,
    Math,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    undefined,
    null: null,
  };
  (sandbox.window as any) = sandbox;

  const ctx = vm.createContext(sandbox);
  let ran = 0;
  for (const script of scripts) {
    if (ran >= 5) break;
    if (script.length < 50 || script.length > 200_000) continue;
    const hasPlayerHint = /jwplayer|brightcove|videojs|player|m3u8|stream|manifest/i.test(script);
    if (!hasPlayerHint) continue;
    try {
      vm.runInContext(script, ctx, { timeout: 1000 });
      ran++;
    } catch {
    }
  }

  const windowStr = JSON.stringify(sandbox.window).replace(/\\u/g, "u");
  const allMatches = windowStr.match(m3u8Regex) ?? [];
  discovered.push(...allMatches);

  return discovered
    .filter(u => {
      if (!u) return false;
      try { new URL(u.startsWith("/") ? `${new URL(pageUrl).origin}${u}` : u); return true; }
      catch { return false; }
    })
    .map(u => u.startsWith("/") ? `${new URL(pageUrl).origin}${u}` : u);
}

const ANVATO_KEY = "anvack=tkx_1e5546f0c28eb0e9cbbf04e0a02a2b65d067c05f";

async function resolveAnvatoManifest(segmentId: string): Promise<string | null> {
  const endpoints = [
    `https://tkx.mp.lura.live/rest/v2/mcp/video/${segmentId}?${ANVATO_KEY}&anvtrt=web&rtyp=fp`,
    `https://tkx.mp.lura.live/rest/v2/mcp/video/${segmentId}?${ANVATO_KEY}`,
  ];
  for (const ep of endpoints) {
    try {
      const data = await fetchJson(ep, 8000) as any;
      const published = data?.published_urls ?? data?.response?.published_urls ?? [];
      const hlsEntry = (Array.isArray(published) ? published : []).find((p: any) =>
        (p?.embed_url || p?.url || "").includes(".m3u8")
      );
      if (hlsEntry) return hlsEntry.embed_url || hlsEntry.url;
      const walked = walkJson(data, ["m3u8", "hlsurl", "streamurl", "manifesturl", "embed_url"]);
      if (walked && walked.includes(".m3u8")) return walked;
    } catch { }
  }
  return null;
}

export const BITRATE_FLOOR = 4_000_000;
export const RESOLUTION_FLOOR_HEIGHT = 720;

/**
 * Matches Fox affiliate logo/thumbnail URLs from foxtv.com or foxlocal.com CDN paths
 * and captures the affiliate callsign or channel slug (e.g. fox2, ktvu, fox5, wnyw, fox11).
 * Also matches affiliate subdomains like fox2detroit.foxtv.com.
 */
export const FOX_AFFILIATE_LOGO_RE = /(?:(?:foxtv|foxlocal)\.com\/.*?\/(fox\d+|ktvu|wnyw|kttv|wjbk|kdfw|waga|wsvn|wdaf|kriv|kstu|knaz|kasw|kbcw|ksmo|kmsp|wftc|wdcw|wjzy|kswb|kdvr|wfxt)(?:[-_./]|$)|(fox\d+|ktvu|wnyw|kttv|wjbk|kdfw|waga|wsvn|wdaf|kriv|kstu|knaz|kasw|kbcw|ksmo|kmsp|wftc|wdcw|wjzy|kswb|kdvr|wfxt)(?:[a-z]*)\.(?:foxtv|foxlocal)\.com)/i;

const FOX_CALLSIGN_TO_MARKET: Record<string, string> = {
  fox2:    "DET",
  fox5:    "NY",
  fox8:    "CLE",
  fox11:   "LA",
  fox13:   "SEA",
  fox25:   "BOS",
  fox26:   "HOU",
  fox28:   "COL",
  fox29:   "PHL",
  fox31:   "DEN",
  fox32:   "CHI",
  fox35:   "ORL",
  fox36:   "ORL",
  fox38:   "ATL",
  fox40:   "SAC",
  fox43:   "HAR",
  fox44:   "SAC",
  fox45:   "BAL",
  fox46:   "CLT",
  fox47:   "SJ",
  fox56:   "LEX",
  fox61:   "HAR",
  ktvu:    "SF",
  wnyw:    "NY",
  kttv:    "LA",
  wjbk:    "DET",
  kdfw:    "DAL",
  waga:    "ATL",
  wsvn:    "MIA",
  wdaf:    "KC",
  kriv:    "HOU",
  kstu:    "SLC",
  knaz:    "FLG",
  kasw:    "PHX",
  kbcw:    "SF",
  ksmo:    "KC",
  kmsp:    "MSP",
  wftc:    "MSP",
  wdcw:    "DC",
  wjzy:    "CLT",
  kswb:    "SD",
  kdvr:    "DEN",
  wfxt:    "BOS",
};

/**
 * Given a Fox affiliate logo URL or page URL, return the market code prefix string
 * (e.g. "[SF]") or null if the URL does not match a known affiliate.
 * Checks both path-based logo URLs (foxtv.com/…/fox2/…) and subdomain-based
 * page URLs (fox2detroit.foxtv.com).
 */
export function getFoxAffiliateMarketCode(logoUrl: string): string | null {
  if (!logoUrl) return null;
  const m = FOX_AFFILIATE_LOGO_RE.exec(logoUrl);
  if (!m) return null;
  // m[1] = path-based callsign, m[2] = subdomain-based callsign
  const rawCallsign = (m[1] || m[2] || "").toLowerCase().replace(/[-_]/g, "");
  const market = FOX_CALLSIGN_TO_MARKET[rawCallsign];
  return market ? `[${market}]` : null;
}

/**
 * Parses an HLS master playlist and returns the variant URL with the highest
 * bandwidth that meets the bitrate floor (≥4 Mbps) AND resolution floor (≥720p).
 *
 * Returns null if:
 *  - The URL is not a master playlist (no EXT-X-STREAM-INF tags), OR
 *  - No variant meets both the bitrate and resolution floors.
 *
 * Callers should treat a null return as "stream does not meet quality threshold"
 * and reject the stream rather than falling back to the master URL.
 */
export async function selectBestHlsVariant(masterUrl: string): Promise<string | null> {
  try {
    assertPublicUrl(masterUrl);
    const text = await fetchText(masterUrl);
    if (!text || !text.includes("#EXT-X-STREAM-INF")) return null;
    const lines = text.split("\n");
    let bestBandwidth = 0;
    let bestUrl: string | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
      const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
      if (!bwMatch) continue;
      const bw = parseInt(bwMatch[1], 10);
      if (bw < BITRATE_FLOOR) continue;
      const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
      if (resMatch) {
        const h = parseInt(resMatch[1], 10);
        if (h < RESOLUTION_FLOOR_HEIGHT) continue;
      }
      const nextLine = lines[i + 1]?.trim();
      if (!nextLine || nextLine.startsWith("#")) continue;
      if (bw > bestBandwidth) {
        bestBandwidth = bw;
        try {
          bestUrl = new URL(nextLine, masterUrl).toString();
        } catch {
          bestUrl = nextLine;
        }
      }
    }
    return bestUrl;
  } catch {
    return null;
  }
}

/**
 * Returns true if the given HLS master playlist has at least one variant that
 * meets neither the bitrate nor resolution floor — meaning the master should be
 * rejected outright rather than stored.
 * Returns false if the URL is not a master playlist (it may be a media playlist
 * or a direct variant, in which case we let it pass through).
 */
export async function hlsMasterFailsQualityFloor(masterUrl: string): Promise<boolean> {
  try {
    assertPublicUrl(masterUrl);
    const text = await fetchText(masterUrl);
    if (!text || !text.includes("#EXT-X-STREAM-INF")) return false;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
      const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
      if (!bwMatch) continue;
      const bw = parseInt(bwMatch[1], 10);
      if (bw < BITRATE_FLOOR) continue;
      const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
      if (resMatch) {
        const h = parseInt(resMatch[1], 10);
        if (h < RESOLUTION_FLOOR_HEIGHT) continue;
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function scrapePageForVideo(url: string): Promise<ScrapedVideo> {
  const blank = (error?: string): ScrapedVideo => ({
    pageUrl: url,
    title: "",
    description: "",
    thumbnail: "",
    videoUrl: "",
    videoUrlFull: "",
    videoType: "unknown",
    error,
  });

  let html: string | null;
  try {
    html = await fetchHtml(url);
  } catch (e: any) {
    return blank(e.message ?? "Fetch failed");
  }
  if (!html) return blank("Non-HTML response");

  const $ = cheerio.load(html);
  const { title, description, thumbnail } = extractMetadata($, url);
  const base = new URL(url).origin;

  const makeResult = (
    rawUrl: string,
    vtype: ScrapedVideo["videoType"],
    provider?: string,
  ): ScrapedVideo => {
    let resultTitle = title;
    if (!/^\[.{2,4}\]/.test(resultTitle)) {
      // Derive market code from the logo/thumbnail URL (foxtv.com/foxlocal.com CDN paths)
      // or fall back to checking the page URL itself for foxtv.com affiliate pages
      const logoCandidate = thumbnail || url;
      const marketCode = getFoxAffiliateMarketCode(logoCandidate) ?? getFoxAffiliateMarketCode(url);
      if (marketCode) resultTitle = `${marketCode} ${resultTitle}`;
    }
    return {
      pageUrl: url,
      title: resultTitle,
      description,
      thumbnail,
      videoUrl: dedupeKey(rawUrl),
      videoUrlFull: rawUrl,
      videoType: vtype,
      provider,
    };
  };

  const allScriptText = $("script:not([src])").map((_, el) => $(el).html() || "").get().join("\n");

  // ── Anvato/Orion pre-pass: detect foxtv.com / foxweather.com affiliate pages ─
  const isFoxTvPage = /(?:^|\.)foxtv\.com$|(?:^|\.)foxweather\.com$/i.test(new URL(url).hostname);
  if (isFoxTvPage) {
    console.log(`[SCRAPER] Anvato pre-pass: scanning ${url}`);

    // Try data-livestream-anvato-id attribute
    const anvatoId =
      $("[data-livestream-anvato-id]").attr("data-livestream-anvato-id") ||
      $("[data-anvato-id]").attr("data-anvato-id") ||
      $("[data-video-anvato-id]").attr("data-video-anvato-id") ||
      (() => {
        const m = html.match(/data-livestream-anvato-id=["']([^"']+)["']/);
        return m?.[1] ?? null;
      })() ||
      (() => {
        const m = html.match(/(?:"anvatoId"|"segmentId"|"anvato_id"|segmentid)\s*[=:]\s*["']([^"']+)["']/i);
        return m?.[1] ?? null;
      })();

    if (anvatoId) {
      console.log(`[SCRAPER] Anvato pre-pass: found segmentId=${anvatoId}, resolving manifest`);
      const m3u8 = await resolveAnvatoManifest(anvatoId);
      if (m3u8) {
        console.log(`[SCRAPER] Anvato pre-pass: resolved HLS manifest, selecting best variant`);
        const best = await selectBestHlsVariant(m3u8);
        if (best) {
          console.log(`[SCRAPER] Anvato pre-pass: best variant meets quality floor`);
          return makeResult(best, "hls", "anvato");
        }
        const isMaster = await hlsMasterFailsQualityFloor(m3u8);
        if (isMaster) {
          console.log(`[SCRAPER] Anvato pre-pass: master manifest — all variants below quality floor, stream rejected`);
          return blank(`Stream rejected: no variant meets quality floor (≥${BITRATE_FLOOR / 1_000_000}Mbps / ≥${RESOLUTION_FLOOR_HEIGHT}p)`);
        }
        console.log(`[SCRAPER] Anvato pre-pass: non-master (direct variant), accepting as-is`);
        return makeResult(m3u8, "hls", "anvato");
      }
    }

    // Fallback: look for lura.live / anvato manifest URLs in scripts or HTML directly
    const luraRe = /https?:\/\/(?:tkx\.mp\.lura\.live|[\w.-]+\.anvato\.net)\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    const luraMatches = [...new Set(html.match(luraRe) ?? [])];
    if (luraMatches.length > 0) {
      const rawManifest = luraMatches[0];
      console.log(`[SCRAPER] Anvato pre-pass: found lura.live manifest directly`);
      const best = await selectBestHlsVariant(rawManifest);
      if (best) {
        console.log(`[SCRAPER] Anvato pre-pass: lura.live variant meets quality floor`);
        return makeResult(best, "hls", "anvato");
      }
      const isMaster = await hlsMasterFailsQualityFloor(rawManifest);
      if (isMaster) {
        console.log(`[SCRAPER] Anvato pre-pass: lura.live master all variants below quality floor, rejected`);
        return blank(`Stream rejected: lura.live manifest below quality floor (≥${BITRATE_FLOOR / 1_000_000}Mbps / ≥${RESOLUTION_FLOOR_HEIGHT}p)`);
      }
      console.log(`[SCRAPER] Anvato pre-pass: lura.live non-master variant, accepting`);
      return makeResult(rawManifest, "hls", "anvato");
    }

    // Look for Orion manifest pattern
    const orionRe = /https?:\/\/[^\s"'<>]*orion[^\s"'<>]*\.m3u8[^\s"'<>]*/gi;
    const orionMatches = [...new Set(html.match(orionRe) ?? [])];
    if (orionMatches.length > 0) {
      const rawManifest = orionMatches[0];
      console.log(`[SCRAPER] Anvato pre-pass: found Orion manifest`);
      const best = await selectBestHlsVariant(rawManifest);
      if (best) {
        console.log(`[SCRAPER] Anvato pre-pass: Orion variant meets quality floor`);
        return makeResult(best, "hls", "anvato");
      }
      const isMaster = await hlsMasterFailsQualityFloor(rawManifest);
      if (isMaster) {
        console.log(`[SCRAPER] Anvato pre-pass: Orion master all variants below quality floor, rejected`);
        return blank(`Stream rejected: Orion manifest below quality floor (≥${BITRATE_FLOOR / 1_000_000}Mbps / ≥${RESOLUTION_FLOOR_HEIGHT}p)`);
      }
      console.log(`[SCRAPER] Anvato pre-pass: Orion non-master variant, accepting`);
      return makeResult(rawManifest, "hls", "anvato");
    }

    console.log(`[SCRAPER] Anvato pre-pass: no manifest found, falling through`);
  }

  // ── DW pre-pass: regex extract HLS URLs directly from raw HTML ──────────────
  const isDwPage = /\.dw\.com$/i.test(new URL(url).hostname);
  if (isDwPage) {
    const DW_HLS_RE = /https:\/\/(?:hlsvod\.dw\.com|dwamdstream[\w-]+\.akamaized\.net)\/[^\s"'<>\\]+master\.m3u8/gi;
    const dwMatches = [...new Set(html.match(DW_HLS_RE) ?? [])];
    if (dwMatches.length > 0) {
      console.log(`[SCRAPER] DW pre-pass found ${dwMatches.length} stream(s) at ${url}`);
      return makeResult(dwMatches[0], "hls", "DW");
    }
    console.log(`[SCRAPER] DW pre-pass: no direct HLS found, falling through to generic passes`);
  }

  console.log(`[SCRAPER] PASS1 scanning ${url}`);

  const pass1Sources: string[] = [];
  $("video[src], source[src]").each((_, el) => {
    const src = $(el).attr("src") || "";
    const type = $(el).attr("type") || "";
    if (isVideoUrl(src) || type.includes("mpegURL") || type.includes("mpegurl")) {
      pass1Sources.push(resolveUrl(url, src));
    }
  });
  const ogVideo = $('meta[property="og:video"]').attr("content") || "";
  if (ogVideo && isVideoUrl(ogVideo)) pass1Sources.push(ogVideo);

  if (pass1Sources.length > 0) {
    const best = pass1Sources[0];
    const vtype = classifyUrl(best);
    console.log(`[SCRAPER] PASS1 found ${vtype} at ${best}`);
    return makeResult(best, vtype === "unknown" ? "hls" : vtype);
  }

  console.log(`[SCRAPER] PASS2 script parsing ${url}`);

  const ldJsonScripts = $('script[type="application/ld+json"]').map((_, el) => $(el).html() || "").get();
  for (const raw of ldJsonScripts) {
    try {
      const obj = JSON.parse(raw);
      const found = walkJson(obj, ["contenturl", "embedurl", "hlsurl", "manifesturl", "streamurl", "src"]);
      if (found && isVideoUrl(found)) {
        const vtype = classifyUrl(found);
        console.log(`[SCRAPER] PASS2 ld+json found ${vtype}`);
        return makeResult(found, vtype === "unknown" ? "hls" : vtype);
      }
    } catch { }
  }

  const nextDataEl = $("#__NEXT_DATA__").html() || "";
  const nuxtDataEl = $("#__NUXT_DATA__").html() || $("script[id='__NUXT_DATA__']").html() || "";
  for (const raw of [nextDataEl, nuxtDataEl].filter(Boolean)) {
    try {
      const obj = JSON.parse(raw);
      const found = walkJson(obj, ["src", "contenturl", "hlsurl", "manifesturl", "streamurl"]);
      if (found && isVideoUrl(found)) {
        const vtype = classifyUrl(found);
        console.log(`[SCRAPER] PASS2 __NEXT_DATA__ found ${vtype}`);
        return makeResult(found, vtype === "unknown" ? "hls" : vtype);
      }
    } catch { }
  }

  const scriptPatterns = [
    /sources"\s*:\s*\[\{[^}]*"src"\s*:\s*"([^"]+)/,
    /["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)/,
    /["']manifest["']\s*:\s*["']([^"']+\.m3u8[^"']*)/,
    /https?:\/\/[^"'\s]+\.m3u8(?:\?[^"'\s]*)?/,
  ];

  for (const pat of scriptPatterns) {
    const m = allScriptText.match(pat);
    if (m) {
      const raw = m[1] || m[0];
      if (raw && isVideoUrl(raw)) {
        console.log(`[SCRAPER] PASS2 script pattern found hls`);
        return makeResult(raw, "hls");
      }
    }
  }

  const apolloMatch = allScriptText.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]{0,50000}\});/);
  if (apolloMatch) {
    try {
      const obj = JSON.parse(apolloMatch[1]);
      const found = walkJson(obj, ["src", "hlsurl", "streamurl", "manifesturl"]);
      if (found && isVideoUrl(found)) {
        console.log(`[SCRAPER] PASS2 apollo found hls`);
        return makeResult(found, "hls");
      }
    } catch { }
  }

  console.log(`[SCRAPER] PASS3 provider detection ${url}`);

  const bcEl = $("[data-video-id]");
  if (bcEl.length > 0) {
    const videoId = bcEl.attr("data-video-id") || "";
    const accountId = bcEl.attr("data-account") || "694940094001";
    const embedUrl = `https://players.brightcove.net/${accountId}/default_default/index.html?videoId=${videoId}`;
    console.log(`[SCRAPER] PASS3 brightcove detected videoId=${videoId}`);
    return makeResult(embedUrl, "brightcove", "brightcove");
  }

  if (allScriptText.includes("jwplayer(")) {
    const idPatterns = [
      /jwplayer\([^)]*\)\.setup\(\{[^}]*playlist\s*:\s*"[^"]*\/([a-zA-Z0-9_-]{6,})/,
      /playlist\s*:\s*"https?:\/\/cdn\.jwplayer\.com\/v2\/media\/([a-zA-Z0-9_-]+)/,
      /"mediaid"\s*:\s*"([a-zA-Z0-9_-]{6,})"/,
    ];
    for (const pat of idPatterns) {
      const m = allScriptText.match(pat);
      if (m?.[1]) {
        console.log(`[SCRAPER] PASS3 jwplayer detected mediaId=${m[1]}, resolving via API`);
        const m3u8 = await resolveJwPlayerId(m[1]);
        if (m3u8) {
          console.log(`[SCRAPER] PASS4 jwplayer resolved to hls`);
          return makeResult(m3u8, "hls", "jwplayer");
        }
        const embedUrl = `https://cdn.jwplayer.com/players/${m[1]}-default.js`;
        return makeResult(embedUrl, "jwplayer", "jwplayer");
      }
    }
  }

  const tpSrc = $('script[src*="theplatform.com"], iframe[src*="theplatform.com"]').attr("src") || "";
  if (tpSrc || allScriptText.includes("theplatform.com")) {
    const tpMatch = (tpSrc || allScriptText).match(/theplatform\.com\/[a-zA-Z0-9_/]+\/([a-zA-Z0-9_/-]+)/);
    if (tpMatch) {
      console.log(`[SCRAPER] PASS3 theplatform detected, resolving SMIL`);
      const m3u8 = await resolveThePlatform(tpMatch[1]);
      if (m3u8) {
        console.log(`[SCRAPER] PASS4 theplatform resolved to hls`);
        return makeResult(m3u8, "hls", "theplatform");
      }
    }
    const tpEmbed = $('iframe[src*="theplatform.com"]').attr("src") || "";
    if (tpEmbed) return makeResult(tpEmbed, "theplatform", "theplatform");
  }

  if (allScriptText.includes("kaltura") || $("[id*='kdp'], [class*='kaltura']").length > 0) {
    const kalturaEmbed = $('iframe[src*="kaltura"]').attr("src") ||
      $('script[src*="kaltura"]').attr("src") || "";
    if (kalturaEmbed) {
      console.log(`[SCRAPER] PASS3 kaltura detected`);
      return makeResult(kalturaEmbed, "kaltura", "kaltura");
    }
  }

  console.log(`[SCRAPER] PASS5 endpoint scanning ${url}`);

  const endpointPat = /["'](\/api\/[^"']*(?:video|stream|player|media)[^"']*)/gi;
  const endpoints: string[] = [];
  let epm: RegExpExecArray | null;
  while ((epm = endpointPat.exec(allScriptText)) !== null) {
    const p = epm[1];
    if (
      !p.includes("analytics") &&
      !p.includes("metrics") &&
      !p.includes("/ads") &&
      !p.includes("track") &&
      endpoints.length < 3
    ) {
      endpoints.push(p);
    }
  }

  for (const ep of endpoints) {
    try {
      const epUrl = `${base}${ep}`;
      const data = await fetchJson(epUrl, 5000) as any;
      const found = walkJson(data, ["streamurl", "hlsurl", "src", "manifesturl", "videourl"]);
      if (found && isVideoUrl(found)) {
        const vtype = classifyUrl(found);
        console.log(`[SCRAPER] PASS5 endpoint ${ep} found ${vtype}`);
        return makeResult(found, vtype === "unknown" ? "hls" : vtype);
      }
    } catch { }
  }

  console.log(`[SCRAPER] PASS6 iframe recursion ${url}`);

  const iframes = $("iframe[src]").map((_, el) => $(el).attr("src") || "").get();
  for (const iframeSrc of iframes) {
    if (!iframeSrc) continue;
    const resolved = resolveUrl(url, iframeSrc);
    try {
      const ih = resolved.toLowerCase();
      const isPlayerIframe =
        /video\.|player\.|embed\.|brightcove\.|jwplayer\./.test(ih) ||
        /\/(v|embed|player)\//.test(new URL(resolved).pathname);
      if (!isPlayerIframe) continue;

      assertPublicUrl(resolved);
      const iHtml = await fetchHtml(resolved);
      if (!iHtml) continue;
      const $i = cheerio.load(iHtml);
      const iScriptText = $i("script:not([src])").map((_, el) => $i(el).html() || "").get().join("\n");

      $i("video[src], source[src]").each((_, el) => {
        const src = $i(el).attr("src") || "";
        if (isVideoUrl(src)) {
          throw { _found: resolveUrl(resolved, src), _type: classifyUrl(src) };
        }
      });

      for (const pat of scriptPatterns) {
        const m = iScriptText.match(pat);
        if (m) {
          const raw = m[1] || m[0];
          if (raw && isVideoUrl(raw)) {
            console.log(`[SCRAPER] PASS6 iframe found hls`);
            return makeResult(raw, "hls");
          }
        }
      }
    } catch (e: any) {
      if (e?._found) {
        console.log(`[SCRAPER] PASS6 iframe video tag found`);
        return makeResult(e._found, e._type === "unknown" ? "hls" : e._type);
      }
    }
  }

  console.log(`[SCRAPER] PASS7 JS sandbox ${url}`);

  const inlineScripts = $("script:not([src])").map((_, el) => $(el).html() || "").get();
  const externalScriptSrcs = $("script[src]").map((_, el) => $(el).attr("src") || "").get()
    .filter(s => /player|video|jw|brightcove|embed/i.test(s))
    .slice(0, 3);

  const externalScripts: string[] = [];
  for (const src of externalScriptSrcs) {
    try {
      const resolved = resolveUrl(url, src);
      assertPublicUrl(resolved);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(resolved, { headers: HEADERS, signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const text = await res.text();
        if (text.length < 500_000) externalScripts.push(text);
      }
    } catch { }
  }

  const sandboxDiscovered = runJsSandbox([...inlineScripts, ...externalScripts], url);
  const m3u8Urls = sandboxDiscovered.filter(u => u.includes(".m3u8"));
  if (m3u8Urls.length > 0) {
    console.log(`[SCRAPER] PASS7 sandbox found ${m3u8Urls.length} m3u8 URLs`);
    return makeResult(m3u8Urls[0], "hls");
  }

  const fetchedUrls = sandboxDiscovered.filter(u => !u.includes(".m3u8")).slice(0, 3);
  for (const fetchUrl of fetchedUrls) {
    try {
      const data = await fetchJson(fetchUrl, 5000) as any;
      const found = walkJson(data, ["streamurl", "hlsurl", "src", "manifesturl"]);
      if (found && isVideoUrl(found)) {
        const vtype = classifyUrl(found);
        console.log(`[SCRAPER] PASS7 sandbox fetched endpoint found ${vtype}`);
        return makeResult(found, vtype === "unknown" ? "hls" : vtype);
      }
    } catch { }
  }

  console.log(`[SCRAPER] no stream found for ${url}`);
  return {
    pageUrl: url,
    title,
    description,
    thumbnail,
    videoUrl: "",
    videoUrlFull: "",
    videoType: "unknown",
  };
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function scrapeHls(startUrl: string, depth: number): Promise<ScrapedVideo[]> {
  assertPublicUrl(startUrl);

  const safeDepth = Math.min(Math.max(1, depth), 3);
  const results: ScrapedVideo[] = [];
  const seenVideoUrls = new Set<string>();
  const seenPageUrls = new Set<string>();

  const globalCtrl = new AbortController();
  const globalTimeout = setTimeout(() => globalCtrl.abort(), 30_000);

  const addResult = (v: ScrapedVideo) => {
    if (v.videoUrlFull && !v.error) {
      const key = dedupeKey(v.videoUrlFull);
      if (seenVideoUrls.has(key)) return;
      seenVideoUrls.add(key);
    }
    results.push(v);
  };

  try {
    const pagesToVisit: string[] = [startUrl];
    let firstPage = true;

    while (pagesToVisit.length > 0 && !globalCtrl.signal.aborted) {
      if (seenPageUrls.size >= 50) break;

      const pageUrl = pagesToVisit.shift()!;
      if (seenPageUrls.has(pageUrl)) continue;
      seenPageUrls.add(pageUrl);

      if (!firstPage) await delay(1000);
      firstPage = false;

      console.log(`[SCRAPER] crawl page ${seenPageUrls.size}: ${pageUrl}`);

      // ── DW RSS feed interception ─────────────────────────────────────────────
      const pageHostname = (() => { try { return new URL(pageUrl).hostname; } catch { return ""; } })();
      if (pageHostname === "rss.dw.com") {
        console.log(`[SCRAPER] DW RSS: fetching feed ${pageUrl}`);
        const xml = await fetchText(pageUrl);
        if (xml) {
          const articleLinks = parseRssFeedLinks(xml).slice(0, 20);
          console.log(`[SCRAPER] DW RSS: found ${articleLinks.length} article links`);
          for (const link of articleLinks) {
            if (!seenPageUrls.has(link) && !pagesToVisit.includes(link)) {
              pagesToVisit.push(link);
            }
          }
        }
        continue; // RSS feed itself has no video — skip scrapePageForVideo
      }

      let html: string | null = null;
      let video: ScrapedVideo;

      try {
        video = await scrapePageForVideo(pageUrl);
        html = null;
      } catch (e: any) {
        addResult({
          pageUrl,
          title: pageUrl,
          description: "",
          thumbnail: "",
          videoUrl: "",
          videoUrlFull: "",
          videoType: "unknown",
          error: e.message ?? "Scrape failed",
        });
        continue;
      }

      addResult(video);

      if (safeDepth >= 2 && !globalCtrl.signal.aborted) {
        try {
          const fetched = await fetchHtml(pageUrl);
          if (fetched) {
            const $ = cheerio.load(fetched);
            const origin = new URL(pageUrl).origin;
            const videoPathPat = /\/(video|videos|watch|episode|clip|media|shows|news)\//i;
            $("a[href]").each((_, el) => {
              if (pagesToVisit.length >= 50) return false;
              const href = $(el).attr("href") || "";
              try {
                const abs = new URL(href, pageUrl).toString();
                if (
                  abs.startsWith(origin) &&
                  videoPathPat.test(new URL(abs).pathname) &&
                  !seenPageUrls.has(abs) &&
                  !pagesToVisit.includes(abs)
                ) {
                  pagesToVisit.push(abs);
                }
              } catch { }
            });
          }
        } catch { }
      }
    }
  } finally {
    clearTimeout(globalTimeout);
  }

  console.log(`[SCRAPER] crawl complete: ${results.length} results from ${seenPageUrls.size} pages`);
  return results;
}
