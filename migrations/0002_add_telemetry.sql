CREATE TABLE IF NOT EXISTS "telemetry_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"timestamp" bigint NOT NULL,
	"level" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"correlation_id" text
);
