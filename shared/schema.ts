import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, bigint, index, uniqueIndex, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Canonical Content-Type allowlist ────────────────────────────────────────
export const CONTENT_TYPES = ["news", "movie", "series", "music", "radio", "kids", "short", "documentary", "sports", "promo"] as const;
export type ContentType = typeof CONTENT_TYPES[number];

// ── Preempt-type allowlist ───────────────────────────────────────────────────
export const PREEMPT_TYPES = ["persistent", "dispense", "promo", "emergency"] as const;
export type PreemptType = typeof PREEMPT_TYPES[number];

// ── Daypart allowlist ────────────────────────────────────────────────────────
export const DAYPARTS = ["Early Morning", "Morning", "Midday", "Afternoon", "Evening", "Prime Time", "Late Night", "Overnight", "Weekend", "Sunday Cinema"] as const;
export type Daypart = typeof DAYPARTS[number];

export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const matrixExtensionFields = {
  hasMicroPreviews: boolean("has_micro_previews").default(false),
  microSpriteConfig: jsonb("micro_sprite_config").$type<{
    url: string;
    cols: number;
    rows: number;
    frames: Array<{ minute_idx: number; col: number; row: number }>;
  }>()
};

export const episodes = pgTable("episodes", {
  id: varchar("id").primaryKey(),
  season: integer("season").notNull(),
  episode: integer("episode").notNull(),
  title: text("title").notNull(),
  duration: integer("duration").notNull().default(0),
  url: text("url").notNull(),
  status: text("status").notNull().default("valid"),
  groupTitle: text("group_title"),
  tvgId: text("tvg_id"),
  tvgName: text("tvg_name"),
  tvgLogo: text("tvg_logo"),
  thumbnailUrl: text("thumbnail_url"),
  sourceHost: text("source_host"),
  subtitleUrl: text("subtitle_url"),
  isWebCompatible: boolean("is_web_compatible").notNull().default(true),
  description: text("description"),
  importedAt: timestamp("imported_at").notNull().default(sql`now()`),
  validatedAt: timestamp("validated_at"),
  resolvedUrl: text("resolved_url"),
  contentType: text("content_type"),
  objectPosition: text("object_position"),
  airDate: text("air_date"),
  isLive: boolean("is_live").notNull().default(false),
  ytVideoId: text("yt_video_id"),
  iframeUrl: text("iframe_url"),
  expiresAt: timestamp("expires_at"),
  sourceType: text("source_type"),
  lastPlayedAt: timestamp("last_played_at"),
  /** Lower number = higher position in the 24-hour stream manifest */
  priority: integer("priority").notNull().default(0),
  /** When true, the episode is never split into 5-min segments even if it is news */
  mustPlayFull: boolean("must_play_full").notNull().default(false),
  /** When true, no automated process may overwrite thumbnailUrl — only explicit user drag/paste */
  thumbnailLocked: boolean("thumbnail_locked").notNull().default(false),
  // ── Clockers Engine fields (Phase 1 overhaul) ──────────────────────────────
  /** Free-form tags for search/filtering, stored as JSON string array */
  tags: jsonb("tags").$type<string[]>().default([]),
  /** Preferred broadcast dayparts, stored as JSON string array */
  preferredDayparts: jsonb("preferred_dayparts").$type<string[]>().default([]),
  /** Second-offsets where the scheduler must insert a break/news slot */
  cutPoints: jsonb("cut_points").$type<number[]>().default([]),
  /** Wall-clock resume position in seconds — set when episode is preempted */
  resumeOffset: integer("resume_offset").notNull().default(0),
  /** When true, this item may interrupt the currently playing episode */
  preempt: boolean("preempt").notNull().default(false),
  /** Preempt behaviour: persistent = resume displaced | dispense = skip | promo | emergency */
  preemptType: text("preempt_type"),
  /**
   * Which playout players may schedule this episode.
   * null / [] = compatible with all players (default).
   * ["player1"] = Player-1 (24h linear) only.
   * ["player2"] = Player-2 (AJ/VoD) only.
   * ["player1","player2"] = both (explicit).
   */
  allowedPlayers: jsonb("allowed_players").$type<string[]>(),
  ...matrixExtensionFields,
}, (table) => ({
  titleIdx:  index("episodes_title_idx").on(table.title),
  groupIdx:  index("episodes_group_idx").on(table.groupTitle),
  statusIdx: index("episodes_status_idx").on(table.status),
  urlUniqueIdx: uniqueIndex("episodes_url_unique_idx").on(table.url),
}));

export const insertEpisodeSchema = createInsertSchema(episodes).extend({
  id: z.string().optional(),
  duration: z.number().default(0),
  status: z.enum(["valid", "warning", "invalid", "redirected"]).default("valid"),
  groupTitle: z.string().nullable().optional(),
  tvgId: z.string().nullable().optional(),
  tvgName: z.string().nullable().optional(),
  tvgLogo: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  sourceHost: z.string().nullable().optional(),
  subtitleUrl: z.string().nullable().optional(),
  isWebCompatible: z.boolean().default(true).optional(),
  description: z.string().nullable().optional(),
  validatedAt: z.date().nullable().optional(),
  resolvedUrl: z.string().nullable().optional(),
  contentType: z.enum(CONTENT_TYPES).nullable().optional(),
  objectPosition: z.enum(["top", "center", "bottom"]).nullable().optional(),
  airDate: z.string().nullable().optional(),
  isLive: z.boolean().optional().default(false),
  ytVideoId: z.string().nullable().optional(),
  iframeUrl: z.string().nullable().optional(),
  expiresAt: z.date().nullable().optional(),
  sourceType: z.enum(["archive", "youtube", "hls"]).nullable().optional(),
  lastPlayedAt: z.date().nullable().optional(),
  priority: z.number().int().default(0).optional(),
  mustPlayFull: z.boolean().default(false).optional(),
  thumbnailLocked: z.boolean().default(false).optional(),
  tags: z.array(z.string()).default([]).optional(),
  preferredDayparts: z.array(z.string()).default([]).optional(),
  cutPoints: z.array(z.number().int().nonnegative()).default([]).optional(),
  resumeOffset: z.number().int().nonnegative().default(0).optional(),
  preempt: z.boolean().default(false).optional(),
  preemptType: z.enum(PREEMPT_TYPES).nullable().optional(),
  allowedPlayers: z.array(z.enum(["player1", "player2"])).nullable().optional(),
  hasMicroPreviews: z.boolean().default(false).optional(),
  microSpriteConfig: z.object({
    url: z.string(),
    cols: z.number(),
    rows: z.number(),
    frames: z.array(z.object({ minute_idx: z.number(), col: z.number(), row: z.number() })),
  }).optional(),
});

export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;
export type Episode = typeof episodes.$inferSelect;

export const localVaults = pgTable("local_vaults", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  label: text("label").notNull(),
  lastScanned: timestamp("last_scanned"),
  status: text("status").notNull().default("active"),
});

export const insertLocalVaultSchema = createInsertSchema(localVaults);
export type InsertLocalVault = z.infer<typeof insertLocalVaultSchema>;
export type LocalVault = typeof localVaults.$inferSelect;

export const archiveHoldingQueue = pgTable("archive_holding_queue", {
  id: serial("id").primaryKey(),
  identifier: varchar("identifier").notNull(),
  filename: varchar("filename").default(""),
  thumbnailUrl: text("thumbnail_url"),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"),
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  format: varchar("format"),
  retryAt: timestamp("retry_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  ready: boolean("ready").notNull().default(false),
  pendingEpisodeJson: text("pending_episode_json"),
}, (table) => ({
  identIdx: uniqueIndex("archive_holding_queue_ident_unique").on(table.identifier),
}));

export const insertArchiveHoldingQueueSchema = createInsertSchema(archiveHoldingQueue).extend({
  identifier: z.string().min(1),
  filename: z.string().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  status: z.enum(["pending", "deriving", "ready", "failed_permanent"]).default("pending"),

  reason: z.string().nullable().optional(),
  retryCount: z.number().int().nonnegative().default(0),
  lastError: z.string().nullable().optional(),
  fileSizeBytes: z.number().int().nonnegative().default(0),
  format: z.string().nullable().optional(),
  retryAt: z.date().nullable().optional(),
  ready: z.boolean().default(false),
  pendingEpisodeJson: z.string().nullable().optional(),
});

export type InsertArchiveHoldingQueue = z.infer<typeof insertArchiveHoldingQueueSchema>;
export type ArchiveHoldingQueue = typeof archiveHoldingQueue.$inferSelect;

// ── Playlist Slots — 4-slot FIFO broadcast buffer ───────────────────────────
// Each slot stores a full playlist snapshot (with optional ghost-stripped news
// entries). Slots are numbered 1–4; saving to a full slot overwrites it and
// the server records the new savedAt timestamp automatically.
export const playlistSlots = pgTable("playlist_slots", {
  slotId:        integer("slot_id").primaryKey(),          // 1 – 4
  savedAt:       timestamp("saved_at").notNull().default(sql`now()`),
  episodesJson:  text("episodes_json").notNull(),          // JSON-serialised Episode[]
  movieCount:    integer("movie_count").notNull().default(0),
  newsCount:     integer("news_count").notNull().default(0),
  /** JSON array of { groupTitle?, tvgId?, duration } harvested from stripped news entries */
  newsSourceList: text("news_source_list"),
  /** true when news URLs were set to '' (ghost slots) during save */
  strippedNews:  boolean("stripped_news").notNull().default(false),
});

export const insertPlaylistSlotSchema = createInsertSchema(playlistSlots);
export type InsertPlaylistSlot = z.infer<typeof insertPlaylistSlotSchema>;
export type PlaylistSlot = typeof playlistSlots.$inferSelect;

export interface SlotMeta {
  slotId: number;
  savedAt: string | null;
  movieCount: number;
  newsCount: number;
  strippedNews: boolean;
}

// ── AJ Episode Analytics ─────────────────────────────────────────────────────
// Persists AJ pool episode identity across server restarts for cross-session
// analytics (playCount, lastAired).  Upserted on every pool refresh; incremented
// by POST /api/aj-pool/aired/:episodeId when LP2 starts or resumes a segment.
export const ajEpisodes = pgTable("aj_episodes", {
  id:        serial("id").primaryKey(),
  episodeId: text("episode_id").notNull(),
  filename:  text("filename").notNull(),
  modMs:     bigint("mod_ms", { mode: "number" }).notNull().default(0),
  lastAired: timestamp("last_aired"),
  playCount: integer("play_count").notNull().default(0),
}, (table) => ({
  episodeIdIdx: uniqueIndex("aj_episodes_episode_id_idx").on(table.episodeId),
  filenameIdx:  index("aj_episodes_filename_idx").on(table.filename),
}));

export const insertAjEpisodeSchema = createInsertSchema(ajEpisodes);
export type InsertAjEpisode = z.infer<typeof insertAjEpisodeSchema>;
export type AjEpisodeRow    = typeof ajEpisodes.$inferSelect;

// ── News Break Audit Log ─────────────────────────────────────────────────────
// Persistent, DB-backed record of every news break that fires in any player.
// Survives server restarts. Pruned to configurable retention window (default 90d).
export const NEWS_BREAK_TYPES = ["scheduled_00", "scheduled_30", "scheduled", "manual", "force_inject"] as const;
export type NewsBreakType = typeof NEWS_BREAK_TYPES[number];

export const newsBreakLog = pgTable("news_break_log", {
  id:        serial("id").primaryKey(),
  firedAt:   timestamp("fired_at").notNull().default(sql`now()`),
  breakType: text("break_type").notNull().default("manual"),   // NewsBreakType
  playerId:  text("player_id"),                                 // e.g. "lp2", "tv"
  feedUrl:   text("feed_url"),                                  // HLS URL that played
  payload:   jsonb("payload").$type<Record<string, unknown>>(), // full request summary
}, (table) => ({
  firedAtIdx: index("news_break_log_fired_at_idx").on(table.firedAt),
  typeIdx:    index("news_break_log_type_idx").on(table.breakType),
}));

export const insertNewsBreakLogSchema = createInsertSchema(newsBreakLog);
export type InsertNewsBreakLog = z.infer<typeof insertNewsBreakLogSchema>;
export type NewsBreakLogEntry  = typeof newsBreakLog.$inferSelect;

export interface TimeSeriesEntry {
  id: string;
  url: string;
  title: string;
  timestamp: string; // ISO format
  status: "ARCHIVED" | "PLAYED_YESTERDAY" | "PLAYED_LAST_HOUR" | "PLAYING_NOW" | "UPCOMING_NEXT" | "QUEUED_FUTURE";
  duration?: number;
  metadata?: any;
}

export const archiveTranscripts = pgTable("archive_transcripts", {
  id: serial("id").primaryKey(),
  broadcastId: varchar("broadcast_id").notNull(),
  startTime: real("start_time").notNull(),
  endTime: real("end_time").notNull(),
  textPayload: text("text_payload").notNull(),
}, (table) => ({
  broadcastIdIdx: index("archive_transcripts_broadcast_id_idx").on(table.broadcastId),
}));

export const insertArchiveTranscriptSchema = createInsertSchema(archiveTranscripts);
export type InsertArchiveTranscript = z.infer<typeof insertArchiveTranscriptSchema>;
export type ArchiveTranscript = typeof archiveTranscripts.$inferSelect;

export const currentRundown = pgTable("current_rundown", {
  id: serial("id").primaryKey(),
  network: text("network").notNull().unique(),
  broadcastIds: jsonb("broadcast_ids").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});



// ── Telemetry Events (Persistent 24-hour log) ────────────────────────────────
export const telemetryEvents = pgTable("telemetry_events", {
  id: varchar("id").primaryKey(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  level: text("level").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>(),
  correlationId: text("correlation_id"),
});

export const insertTelemetryEventSchema = createInsertSchema(telemetryEvents);
export type InsertTelemetryEvent = z.infer<typeof insertTelemetryEventSchema>;
export type TelemetryEventRow = typeof telemetryEvents.$inferSelect;
