CREATE TABLE "aj_episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"filename" text NOT NULL,
	"mod_ms" bigint DEFAULT 0 NOT NULL,
	"last_aired" timestamp,
	"play_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archive_holding_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"identifier" varchar NOT NULL,
	"filename" varchar DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"file_size_bytes" integer DEFAULT 0 NOT NULL,
	"retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"pending_episode_json" text
);
--> statement-breakpoint
CREATE TABLE "archive_transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" varchar NOT NULL,
	"start_time" real NOT NULL,
	"end_time" real NOT NULL,
	"text_payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "current_rundown" (
	"id" serial PRIMARY KEY NOT NULL,
	"network" text NOT NULL,
	"broadcast_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "current_rundown_network_unique" UNIQUE("network")
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"episode" integer NOT NULL,
	"title" text NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'valid' NOT NULL,
	"group_title" text,
	"tvg_id" text,
	"tvg_name" text,
	"tvg_logo" text,
	"thumbnail_url" text,
	"source_host" text,
	"subtitle_url" text,
	"is_web_compatible" boolean DEFAULT true NOT NULL,
	"description" text,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"validated_at" timestamp,
	"resolved_url" text,
	"content_type" text,
	"object_position" text,
	"air_date" text,
	"is_live" boolean DEFAULT false NOT NULL,
	"yt_video_id" text,
	"iframe_url" text,
	"expires_at" timestamp,
	"source_type" text,
	"last_played_at" timestamp,
	"priority" integer DEFAULT 0 NOT NULL,
	"must_play_full" boolean DEFAULT false NOT NULL,
	"thumbnail_locked" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"preferred_dayparts" jsonb DEFAULT '[]'::jsonb,
	"cut_points" jsonb DEFAULT '[]'::jsonb,
	"resume_offset" integer DEFAULT 0 NOT NULL,
	"preempt" boolean DEFAULT false NOT NULL,
	"preempt_type" text,
	"allowed_players" jsonb
);
--> statement-breakpoint
CREATE TABLE "local_vaults" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"label" text NOT NULL,
	"last_scanned" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "local_vaults_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "news_break_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"fired_at" timestamp DEFAULT now() NOT NULL,
	"break_type" text DEFAULT 'manual' NOT NULL,
	"player_id" text,
	"feed_url" text,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "playlist_slots" (
	"slot_id" integer PRIMARY KEY NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	"episodes_json" text NOT NULL,
	"movie_count" integer DEFAULT 0 NOT NULL,
	"news_count" integer DEFAULT 0 NOT NULL,
	"news_source_list" text,
	"stripped_news" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "aj_episodes_episode_id_idx" ON "aj_episodes" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "aj_episodes_filename_idx" ON "aj_episodes" USING btree ("filename");--> statement-breakpoint
CREATE UNIQUE INDEX "archive_holding_queue_ident_file_unique" ON "archive_holding_queue" USING btree ("identifier","filename");--> statement-breakpoint
CREATE INDEX "archive_transcripts_broadcast_id_idx" ON "archive_transcripts" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "episodes_title_idx" ON "episodes" USING btree ("title");--> statement-breakpoint
CREATE INDEX "episodes_group_idx" ON "episodes" USING btree ("group_title");--> statement-breakpoint
CREATE INDEX "episodes_status_idx" ON "episodes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_url_unique_idx" ON "episodes" USING btree ("url");--> statement-breakpoint
CREATE INDEX "news_break_log_fired_at_idx" ON "news_break_log" USING btree ("fired_at");--> statement-breakpoint
CREATE INDEX "news_break_log_type_idx" ON "news_break_log" USING btree ("break_type");