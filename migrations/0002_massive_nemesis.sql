CREATE TABLE "telemetry_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"timestamp" bigint NOT NULL,
	"level" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"correlation_id" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "archive_holding_queue_ident_file_unique" ON "archive_holding_queue" USING btree ("identifier","filename");