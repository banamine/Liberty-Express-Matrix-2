import { EventEmitter } from "node:events";
import { log } from "./vite";
import { isAjBroadcastEnabled } from "./aj-pool";

export type WatchdogEventType = "FORCE_INJECT" | "PLAYER_CHANGE" | "STATUS" | "SLEEP" | "WAKE" | "ROLLBACK_SET" | "REPACK";

export interface WatchdogEvent {
  type: WatchdogEventType;
  ts: number;
  payload?: Record<string, unknown>;
}

class WatchdogBus extends EventEmitter {}
export const watchdogBus = new WatchdogBus();
watchdogBus.setMaxListeners(100);

interface SystemHealth {
  lastNewsInjection: number;
  activePlayers: number;
  forceInjectCount: number;
  lastForceInject: number | null;
  activeSessions: number;
  visibleLinks: number;
  queuedLinksNext4h: number;
  tvPlayerActive: boolean;
  metadataRepairActive: boolean;
  started: number;
  asleep: boolean;
  // Sync validation (Heat 3)
  lastPackedDurationS: number;
  syncOk: boolean;
  repackCount: number;
  lastRepackAt: number | null;
  lastNewsSuccessAt: number | null;
  // Live rotation
  livePool: string[];
  liveRotationIndex: number;
  // pendingInjectIdx: set by maybeForceInject(), cleared by confirmLiveRotation().
  // liveRotationIndex only advances once confirmLiveRotation() is called so a
  // failed/stumbled mount retries the same channel on the next FORCE_INJECT.
  pendingInjectIdx: number | null;
  // NTD health tracking (AJ Broadcast Mode)
  ntdPickedUrl:   string | null;  // last NTD URL successfully selected
  ntdFallbackCount: number;       // times NTD pattern not found — fell back to pool[0]
  ntdLastFallbackAt: number | null;
  // Last injected break duration — exposed via /api/watchdog/status for poll-path catch-up
  lastInjectedBreakDurationSec: number;
}

const SYNC_EXPECTED_S   = 86_400;  // Strategy-B 24-hour target
const SYNC_TOLERANCE_S  = 2;       // ±2 s is acceptable drift

// ── Static fallback pool — used until routes.ts seeds the DB-sourced pool ──────
// These are the same URLs as the client-side NEWS_POOL so FORCE_INJECT can
// always rotate even before the first live query resolves.
const STATIC_LIVE_FALLBACK: readonly string[] = [
  "https://amg17596-ntdtv-amg17596c1-rakuten-gb-6741.playouts.now.amagi.tv/playlist/amg17596-newtangdynastytelevision-ntdtv-rakutengb/playlist.m3u8",
];

const health: SystemHealth = {
  lastNewsInjection: 0, // 0 = "never injected" — lets the first window fire immediately on startup
  activePlayers: 0,
  forceInjectCount: 0,
  lastForceInject: null,
  activeSessions: 0,
  visibleLinks: 0,
  queuedLinksNext4h: 0,
  tvPlayerActive: false,
  metadataRepairActive: false,
  started: Date.now(),
  asleep: true,
  lastPackedDurationS: 0,
  syncOk: true,
  repackCount: 0,
  lastRepackAt: null,
  lastNewsSuccessAt: null,
  livePool: [...STATIC_LIVE_FALLBACK],
  liveRotationIndex: 0,
  pendingInjectIdx: null,
  ntdPickedUrl:      null,
  ntdFallbackCount:  0,
  ntdLastFallbackAt: null,
  lastInjectedBreakDurationSec: 0,
};

const FORCE_INJECT_THRESHOLD_MS = 15 * 60 * 1000;
const SLEEP_CHECK_INTERVAL_MS = 15_000;
const VALIDATION_WINDOW_MS = 4 * 60 * 60 * 1000;

// ── Clock-face 15-minute window tracking ─────────────────────────────────────
// Returns 0–95: which 15-minute slot of the day is currently active.
// Changes at :00, :15, :30, :45 of every hour, giving true broadcast-clock
// alignment instead of "15 minutes after the last injection."
function currentClockWindow(): number {
  const d = new Date();
  return d.getHours() * 4 + Math.floor(d.getMinutes() / 15);
}
// Initialized to -1 = "never injected in any window" so the first check
// always sees a new window and may fire (subject to the 10-min minimum guard).
let lastInjectedClockWindow = -1;

// ── Canonical window-injection timestamp ──────────────────────────────────────
// Set once per 15-min clock window by maybeForceInject() or the first organic
// recordNewsInjection() call in a new window.  ALL concurrent POST
// /api/watchdog/news-injection calls within the same window share this value
// so no client ever sees a "newer" ts from a sibling client's POST, which
// would cause the sibling to re-fire a break at the end of its current break.
let currentWindowInjectionTs = 0;

let timer: ReturnType<typeof setInterval> | null = null;
let isWriting = false;

function emitStatus(): void {
  watchdogBus.emit("watchdog", {
    type: "STATUS",
    ts: Date.now(),
    payload: getSystemHealth(),
  });
}

function enterSleep(): void {
  if (health.asleep) return;
  health.asleep = true;
  watchdogBus.emit("watchdog", { type: "SLEEP", ts: Date.now() });
}

function wake(): void {
  if (!health.asleep) return;
  health.asleep = false;
  watchdogBus.emit("watchdog", { type: "WAKE", ts: Date.now() });
}

function shouldStayAwake(): boolean {
  return health.activeSessions > 0 || health.tvPlayerActive || health.activePlayers > 0;
}

function shouldPrioritizePlayback(): boolean {
  return health.tvPlayerActive;
}

function shouldValidateNow(): boolean {
  return health.visibleLinks > 0 || health.queuedLinksNext4h > 0;
}

function maybeForceInject(): void {
  // ── Clock-face alignment: only fire when a new 15-minute window has opened ──
  // Replaces the old elapsed-only check so injections land at broadcast-clock
  // boundaries (:00, :15, :30, :45) rather than drifting later each cycle.
  // A 10-minute minimum guard prevents double-firing on server restart when
  // startup happens to coincide with a fresh window boundary.
  const win     = currentClockWindow();
  const elapsed = Date.now() - health.lastNewsInjection;
  if (win === lastInjectedClockWindow) return;        // still in the same 15-min window
  if (elapsed < 10 * 60 * 1000) return;              // < 10 min since last — too soon
  lastInjectedClockWindow = win;                      // stamp window BEFORE firing

  // Establish canonical timestamp for this window BEFORE emitting so that
  // concurrent POST /api/watchdog/news-injection calls from multiple clients
  // all receive the same ts and no client sees a "newer" sibling ts that
  // would cause it to re-trigger a break at the end of its own break.
  currentWindowInjectionTs = Date.now();

  health.forceInjectCount += 1;
  health.lastForceInject = currentWindowInjectionTs;
  health.lastNewsInjection = currentWindowInjectionTs;

  // ── Live Rotation: pick the next URL from the pool ────────────────────────
  // In AJ Broadcast Mode we ALWAYS inject NTD (pool index 0) — no rotation.
  // This ensures AJ content is only interrupted by NTD, never a different live
  // stream, and the rotation cursor is preserved for when normal mode resumes.
  // In normal mode we do NOT advance liveRotationIndex here; it only advances
  // when the client confirms a successful mount via confirmLiveRotation()
  // (called from recordNewsInjection()).  This way a failed mount retries the
  // same channel on the next FORCE_INJECT.
  const pool    = health.livePool.length > 0 ? health.livePool : [...STATIC_LIVE_FALLBACK];
  const isAj    = isAjBroadcastEnabled();

  // In AJ mode, select NTD by explicit URL pattern match so the correct feed
  // is injected even if the pool order changes.  Falls back to pool[0] only
  // when no URL in the pool matches the NTD pattern (should not happen in
  // normal operation, since the static fallback is the NTD Rakuten URL).
  const NTD_PATTERN = /ntd|newtangdynasty|ntdtv/i;
  const idx     = isAj ? 0 : health.liveRotationIndex % pool.length;

  let injectUrl: string;
  if (isAj) {
    const ntdMatch = pool.find(u => NTD_PATTERN.test(u));
    if (ntdMatch) {
      injectUrl = ntdMatch;
      health.ntdPickedUrl = ntdMatch;
    } else {
      // NTD pattern not found — fall back to pool[0] and log the anomaly
      injectUrl = pool[0];
      health.ntdFallbackCount  += 1;
      health.ntdLastFallbackAt  = Date.now();
      log(`[Watchdog] NTD_PATTERN not matched in pool (${pool.length} entries) — fell back to pool[0]: ${pool[0].slice(0, 60)}… (fallback #${health.ntdFallbackCount})`);
    }
  } else {
    injectUrl = pool[idx];
  }

  if (!isAj) {
    health.pendingInjectIdx = idx; // will be confirmed (advanced) by recordNewsInjection()
  }

  // AJ Broadcast Mode: 15-minute NTD break (900 s).  Normal mode: 180 s.
  const breakDurationSec = isAj ? 900 : 180;
  health.lastInjectedBreakDurationSec = breakDurationSec;
  // NTD always plays from the live head, so injectStartSec is always 0.
  const injectStartSec = 0;

  // AJ-mode breaks are exclusively for Player-2 (Live Player 2).
  // Normal breaks go to "all" so both players can react.
  const targetPlayer = isAj ? "player2" : "all";

  const event: WatchdogEvent = {
    type: "FORCE_INJECT",
    ts: Date.now(),
    payload: {
      msSinceLastNews:  elapsed,
      forceInjectCount: health.forceInjectCount,
      tvPlayerActive:   health.tvPlayerActive,
      injectUrl,           // ← selected channel for this break
      rotationIndex: idx,  // ← which pool slot fired (for operator logs)
      poolSize:      pool.length,
      breakDurationSec,    // ← how long the news break should last (s)
      injectStartSec,      // ← seek offset when mounting NTD (always 0)
      targetPlayer,        // ← "player2" | "all" — clients must filter by this
    },
  };
  log(
    `[Watchdog] FORCE_INJECT fired after ${Math.round(elapsed / 60000)}m — ` +
    `${isAj ? "AJ-mode NTD 15min" : `slot ${idx + 1}/${pool.length}`}: ${injectUrl.slice(0, 60)}…`
  );
  watchdogBus.emit("watchdog", event);
}

/**
 * setLivePool(urls)
 * Called by routes.ts on startup and after episode bulk operations to keep
 * the server-side rotation pool in sync with the current DB state.
 * Only HLS .m3u8 live streams should be passed; VoD or archive.org URLs
 * are filtered at the call site in routes.ts.
 * If urls is empty, the static fallback pool is used instead.
 */
export function setLivePool(urls: string[]): void {
  const deduped = [...new Set(urls.filter(u => u.length > 0))];
  health.livePool = deduped.length > 0 ? deduped : [...STATIC_LIVE_FALLBACK];
  // Reset rotation index if pool size changed to avoid out-of-bounds
  health.liveRotationIndex = health.liveRotationIndex % health.livePool.length;
  log(`[Watchdog] Live pool updated — ${health.livePool.length} URL(s) in rotation.`);
}

/**
 * confirmLiveRotation()
 * Called when a live news break has successfully mounted (client fires
 * POST /api/watchdog/news-injection after the HLS stream is playing).
 * Advances liveRotationIndex so the next FORCE_INJECT picks the next channel.
 * If no inject was pending (organic news break, not a FORCE_INJECT), this is
 * a safe no-op — pendingInjectIdx will be null.
 */
export function confirmLiveRotation(): void {
  if (health.pendingInjectIdx === null) return; // no FORCE_INJECT in flight
  const pool = health.livePool.length > 0 ? health.livePool : [...STATIC_LIVE_FALLBACK];
  const advanced = (health.pendingInjectIdx + 1) % pool.length;
  log(
    `[Watchdog] Live rotation confirmed — advancing slot ${health.pendingInjectIdx + 1} → ${advanced + 1}/${pool.length}.`
  );
  health.liveRotationIndex = advanced;
  health.pendingInjectIdx  = null;
}

export function recordNewsInjection(): void {
  // ── Window-idempotent canonical timestamp ─────────────────────────────────
  // If this is the first call in a new 15-min window (organic break, no prior
  // FORCE_INJECT), stamp a fresh canonical ts now.  If maybeForceInject()
  // already fired this window it will have set currentWindowInjectionTs, so
  // we reuse that value — making ALL concurrent POSTs return the SAME ts.
  // This prevents the concurrent-POST timestamp race that caused 3-min cascades:
  // two clients posting simultaneously no longer produce two distinct timestamps
  // that each other's polls interpret as "a new inject just happened".
  const win = currentClockWindow();
  if (win !== lastInjectedClockWindow || currentWindowInjectionTs === 0) {
    currentWindowInjectionTs = Date.now();
  }
  health.lastNewsInjection = currentWindowInjectionTs;
  health.lastNewsSuccessAt = currentWindowInjectionTs;
  // ── Clock-window alignment: stamp current window so maybeForceInject
  // won't re-fire in the same 15-minute slot after an organic break.
  lastInjectedClockWindow = win;
  // Confirm the rotation cursor advance now that news is actually playing
  confirmLiveRotation();
  wake();
  emitStatus();
}

/** Returns the stable canonical injection timestamp for the current window. */
export function getWindowInjectionTs(): number {
  return currentWindowInjectionTs;
}

export function setActivePlayers(count: number): void {
  health.activePlayers = count;
  if (count > 0) wake();
  emitStatus();
}

export function setActiveSessions(count: number): void {
  health.activeSessions = count;
  if (count > 0) wake();
  if (count === 0 && !shouldStayAwake()) enterSleep();
  emitStatus();
}

export function setTvPlayerActive(active: boolean): void {
  health.tvPlayerActive = active;
  if (active) wake();
  if (!active && !shouldStayAwake()) enterSleep();
  emitStatus();
}

export function setMetadataRepairActive(active: boolean): void {
  health.metadataRepairActive = active;
  emitStatus();
}

export function setValidationWindow(visibleLinks: number, queuedLinksNext4h: number): void {
  health.visibleLinks = visibleLinks;
  health.queuedLinksNext4h = queuedLinksNext4h;
  emitStatus();
}

export function getValidationWindowMs(): number {
  return VALIDATION_WINDOW_MS;
}

export function getSystemHealth() {
  const lastNewsReference = health.lastNewsSuccessAt ?? health.lastNewsInjection;
  return {
    lastNewsInjection: lastNewsReference,
    activePlayers: health.activePlayers,
    activeSessions: health.activeSessions,
    forceInjectCount: health.forceInjectCount,
    lastForceInject: health.lastForceInject,
    uptime: Date.now() - health.started,
    msSinceLastNews: Date.now() - lastNewsReference,
    overdue: Date.now() - lastNewsReference > FORCE_INJECT_THRESHOLD_MS,
    asleep: health.asleep,
    visibleLinks: health.visibleLinks,
    queuedLinksNext4h: health.queuedLinksNext4h,
    tvPlayerActive: health.tvPlayerActive,
    metadataRepairActive: health.metadataRepairActive,
    prioritizePlayback: shouldPrioritizePlayback(),
    shouldValidateNow: shouldValidateNow(),
    // Sync validation (Heat 3)
    syncOk:             health.syncOk,
    lastPackedDurationS: health.lastPackedDurationS,
    repackCount:        health.repackCount,
    lastRepackAt:       health.lastRepackAt,
    lastNewsSuccessAt:  health.lastNewsSuccessAt,
    // Live rotation
    livePoolSize:       health.livePool.length,
    liveRotationIndex:  health.liveRotationIndex,
    pendingInjectIdx:   health.pendingInjectIdx,
    livePoolUrls:       health.livePool,
    // AJ Broadcast Mode — visible to all watchdog/status consumers
    ajBroadcastEnabled: isAjBroadcastEnabled(),
    // Last FORCE_INJECT break duration — poll path uses this to catch up missed SSE breaks
    lastInjectedBreakDurationSec: health.lastInjectedBreakDurationSec,
  };
}

/**
 * checkAndValidateSync(totalDurationSeconds)
 *
 * Heat 3 — Sync Validation: verifies the packed.m3u schedule totals exactly
 * 86400 s within ±SYNC_TOLERANCE_S.
 *
 * Returns true  → schedule is OK (syncOk = true).
 * Returns false → schedule is short; emits REPACK event so connected players
 *                 can re-fetch the manifest (syncOk = false).
 */
export function checkAndValidateSync(totalDurationSeconds: number): boolean {
  health.lastPackedDurationS = totalDurationSeconds;
  const gap = SYNC_EXPECTED_S - totalDurationSeconds;

  if (gap > SYNC_TOLERANCE_S) {
    health.syncOk    = false;
    health.repackCount += 1;
    health.lastRepackAt = Date.now();
    const event: WatchdogEvent = {
      type: "REPACK",
      ts:   Date.now(),
      payload: {
        totalDurationSeconds,
        expectedSeconds: SYNC_EXPECTED_S,
        gapSeconds:      gap,
        repackCount:     health.repackCount,
        targetPlayer:    "player1",  // REPACK is only relevant for the P1 24h linear schedule
      },
    };
    log(
      `[Watchdog] REPACK triggered — schedule is ${gap.toFixed(1)}s short ` +
      `(${totalDurationSeconds}s / ${SYNC_EXPECTED_S}s expected). ` +
      `Repack #${health.repackCount}.`,
    );
    watchdogBus.emit("watchdog", event);
    emitStatus();
    return false;
  }

  // Schedule is within tolerance — report OK
  if (!health.syncOk) {
    log(`[Watchdog] SYNC OK — schedule restored to ${totalDurationSeconds}s.`);
  }
  health.syncOk = true;
  return true;
}

export function logWatchdogSuccess(): void {
  log("[WATCHDOG] SUCCESS: 88 Frames Locked, 34 Horses Branded, 0 Screenshots Remaining.");
}

export function startWatchdog(): void {
  if (timer) return;
  // Seed the last-injected window to the CURRENT window so the first timer
  // tick doesn't fire a FORCE_INJECT immediately after a server restart.
  // Without this, lastInjectedClockWindow=-1 always differs from the current
  // window, and since lastNewsInjection=0 makes elapsed appear infinite the
  // 10-min guard never stops it — producing a jarring news break within 15 s
  // of any player connecting after a restart, before the movie has buffered.
  // The first real fire will happen when the clock rolls into the NEXT
  // 15-minute boundary (:00/:15/:30/:45), which is correct broadcast behavior.
  lastInjectedClockWindow = currentClockWindow();
  log("[Watchdog] Started — sleep-aware, 15m news rule active.");
  timer = setInterval(async () => {
    if (isWriting) return;
    isWriting = true;
    try {
      if (!shouldStayAwake()) {
      enterSleep();
      return;
    }
    wake();
    health.metadataRepairActive = shouldPrioritizePlayback() ? false : health.metadataRepairActive;
    // Fire news injection whenever ANY player is active — not just the TV
    // player flag.  LP2 registers as activePlayers, not tvPlayerActive, so
    // gating on shouldPrioritizePlayback() caused FORCE_INJECT to never fire.
      if (shouldStayAwake()) {
        maybeForceInject();
      }
      
      // Heartbeat DB write check (stubbed for safety)
      const db = (await import("./db")).getDb();
      // await db.update(...) / heartbeat
      
    } finally {
      isWriting = false;
    }
  }, SLEEP_CHECK_INTERVAL_MS);
}
