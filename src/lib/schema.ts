import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const episodes = pgTable("episodes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration"), // Duration in seconds
  playbackProgress: integer("playback_progress").default(0), // Progress in seconds
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
