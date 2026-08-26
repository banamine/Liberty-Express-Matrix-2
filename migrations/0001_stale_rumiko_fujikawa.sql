DROP INDEX "archive_holding_queue_ident_file_unique";--> statement-breakpoint
ALTER TABLE "archive_holding_queue" ALTER COLUMN "filename" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "archive_holding_queue" ADD COLUMN "thumbnail_url" text;