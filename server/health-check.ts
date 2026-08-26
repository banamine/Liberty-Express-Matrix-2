import { getDb, ensureDbReady } from "./db";
import { episodes as episodesTable, appSettings } from "../shared/schema";
import { isNull, lt, or, eq } from "drizzle-orm";

export type HealthCheckInterval = "off" | "1h" | "6h" | "24h";

const HEALTH_CHECK_INTERVAL_KEY = "health_check_interval";

interface SchedulerState {
  lastRun: Date | null;
  nextRun: Date | null;
  inProgress: boolean;
  totalProbed: number;
  invalidCount: number;
  interval: HealthCheckInterval;
}

const INTERVAL_MS: Record<HealthCheckInterval, number | null> = {
  off:  null,
  "1h":  1 * 60 * 60 * 1_000,
  "6h":  6 * 60 * 60 * 1_000,
  "24h": 24 * 60 * 60 * 1_000,
};

const VALID_INTERVALS = new Set<HealthCheckInterval>(["off", "1h", "6h", "24h"]);

const state: SchedulerState = {
  lastRun: null,
  nextRun: null,
  inProgress: false,
  totalProbed: 0,
  invalidCount: 0,
  interval: "6h",
};

let timerHandle: ReturnType<typeof setTimeout> | null = null;
let timerIntervalMs: number | null = null;

const MEDIA_TYPE_RE = /^(video|audio|application\/(x-mpegurl|vnd\.apple\.mpegurl|octet-stream))/i;
const TIMEOUT_MS = 10_000;
const BATCH_SIZE = 5;
const MIN_BYTES = 1_048_576;

async function getEpisodesNeedingValidation(olderThanMs: number): Promise<typeof episodesTable.$inferSelect[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanMs);
  return db
    .select()
    .from(episodesTable)
    .where(
      or(
        isNull(episodesTable.validatedAt),
        lt(episodesTable.validatedAt, cutoff),
      )
    )
    .limit(500);
}

async function validateOne(episode: typeof episodesTable.$inferSelect): Promise<"valid" | "warning" | "invalid" | "redirected"> {
  const db = getDb();
  const validatedAt = new Date();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(episode.url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const finalUrl = response.url && response.url !== episode.url ? response.url : null;
    const wasRedirected = finalUrl !== null;
    const contentType = response.headers.get("content-type") || "";
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    const isMediaType = MEDIA_TYPE_RE.test(contentType);

    let status: "valid" | "warning" | "invalid" | "redirected";
    if (response.ok) {
      if (!isMediaType) {
        status = "warning";
      } else if (contentLength <= 0 || contentLength < MIN_BYTES) {
        status = "warning";
      } else if (wasRedirected) {
        status = "redirected";
      } else {
        status = "valid";
      }
    } else if (response.status === 403 || response.status === 401 || response.status === 429) {
      status = "warning";
    } else if (response.status >= 500) {
      status = "warning";
    } else {
      status = "invalid";
    }

    await db.update(episodesTable).set({
      status,
      validatedAt,
      resolvedUrl: finalUrl ?? null,
    }).where(eq(episodesTable.id, episode.id));
    return status;
  } catch {
    await db.update(episodesTable).set({ status: "invalid", validatedAt }).where(eq(episodesTable.id, episode.id));
    return "invalid";
  }
}

function armNextTick(ms: number): void {
  if (timerHandle !== null) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
  const nextAt = Date.now() + ms;
  state.nextRun = new Date(nextAt);
  timerIntervalMs = ms;
  timerHandle = setTimeout(async () => {
    timerHandle = null;
    await runHealthCheckPassInternal();
    if (timerIntervalMs !== null) {
      armNextTick(timerIntervalMs);
    }
  }, ms);
}

async function runHealthCheckPassInternal(): Promise<void> {
  if (state.inProgress) return;
  state.inProgress = true;
  await ensureDbReady();
  const intervalMs = state.interval === "off" ? 6 * 60 * 60 * 1_000 : (INTERVAL_MS[state.interval] ?? 6 * 60 * 60 * 1_000);
  try {
    console.log("[health-check] Starting incremental URL validation pass…");
    const toProbe = await getEpisodesNeedingValidation(intervalMs);
    console.log(`[health-check] Probing ${toProbe.length} episodes`);

    let totalProbed = 0;
    let invalidCount = 0;

    for (let i = 0; i < toProbe.length; i += BATCH_SIZE) {
      const batch = toProbe.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(validateOne));
      totalProbed += results.length;
      invalidCount += results.filter(r => r === "invalid").length;
    }

    state.lastRun = new Date();
    state.totalProbed = totalProbed;
    state.invalidCount = invalidCount;
    console.log(`[health-check] Pass complete — probed: ${totalProbed}, invalid: ${invalidCount}`);
  } catch (err) {
    console.error("[health-check] Pass failed:", err);
  } finally {
    state.inProgress = false;
  }
}

export async function runHealthCheckPass(): Promise<void> {
  if (state.inProgress) return;
  await runHealthCheckPassInternal();
  if (timerIntervalMs !== null) {
    armNextTick(timerIntervalMs);
  }
}

export function getHealthCheckStatus() {
  return {
    lastRun: state.lastRun?.toISOString() ?? null,
    nextRun: state.nextRun?.toISOString() ?? null,
    inProgress: state.inProgress,
    totalProbed: state.totalProbed,
    invalidCount: state.invalidCount,
    interval: state.interval,
  };
}

export async function loadIntervalFromDb(): Promise<HealthCheckInterval> {
  try {
    await ensureDbReady();
    const db = getDb();
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, HEALTH_CHECK_INTERVAL_KEY));
    if (row && VALID_INTERVALS.has(row.value as HealthCheckInterval)) {
      return row.value as HealthCheckInterval;
    }
  } catch (err) {
    console.warn("[health-check] Could not read interval from DB, using default:", err);
  }
  return "6h";
}

async function persistIntervalToDb(interval: HealthCheckInterval): Promise<void> {
  try {
    await ensureDbReady();
    const db = getDb();
    await db
      .insert(appSettings)
      .values({ key: HEALTH_CHECK_INTERVAL_KEY, value: interval })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: interval, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("[health-check] Could not persist interval to DB:", err);
  }
}

export async function setHealthCheckInterval(interval: HealthCheckInterval): Promise<void> {
  state.interval = interval;

  await persistIntervalToDb(interval);

  if (timerHandle !== null) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
  timerIntervalMs = null;
  state.nextRun = null;

  const ms = INTERVAL_MS[interval];
  if (ms === null) {
    console.log("[health-check] Scheduler disabled.");
    return;
  }

  armNextTick(ms);
  console.log(`[health-check] Scheduler set to ${interval} (every ${ms / 3_600_000}h)`);
}

export async function startHealthScheduler(): Promise<void> {
  const persisted = await loadIntervalFromDb();
  console.log(`[health-check] Loaded persisted interval: ${persisted}`);
  await setHealthCheckInterval(persisted);
}
