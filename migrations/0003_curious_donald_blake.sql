ALTER TABLE "episodes" ADD COLUMN "has_micro_previews" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "micro_sprite_config" jsonb;