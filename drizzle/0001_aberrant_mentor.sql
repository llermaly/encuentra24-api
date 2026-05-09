CREATE TABLE IF NOT EXISTS "favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ad_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"digest_run_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"cadence" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"created_at" text NOT NULL,
	"sent_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_digest_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"digest_run_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" integer,
	"ad_id" text NOT NULL,
	"event_at" text NOT NULL,
	"captured_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_digest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"schedule_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"sent_at" text,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "notification_digest_runs" ADD COLUMN IF NOT EXISTS "schedule_key" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"destination" text NOT NULL,
	"label" text,
	"daily_enabled" boolean DEFAULT true NOT NULL,
	"weekly_enabled" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ad_id" text NOT NULL,
	"stage" text DEFAULT 'discovered' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"moved_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ad_id" text NOT NULL,
	"type" text DEFAULT 'note' NOT NULL,
	"content" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"filters" text NOT NULL,
	"last_checked_at" text,
	"new_match_count" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_fav_user_ad" ON "favorites" USING btree ("user_id","ad_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fav_user_id" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_deliveries_user" ON "notification_deliveries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_deliveries_run" ON "notification_deliveries" USING btree ("digest_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_notification_deliveries_unique_recipient" ON "notification_deliveries" USING btree ("digest_run_id","recipient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_digest_items_run_id" ON "notification_digest_items" USING btree ("digest_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_digest_items_user_event" ON "notification_digest_items" USING btree ("user_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_digest_items_unique_event" ON "notification_digest_items" USING btree ("user_id","event_type","ad_id","event_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_digest_runs_user_kind_status" ON "notification_digest_runs" USING btree ("user_id","kind","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_digest_runs_user_kind_schedule" ON "notification_digest_runs" USING btree ("user_id","kind","schedule_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_digest_runs_created_at" ON "notification_digest_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_recipients_user" ON "notification_recipients" USING btree ("user_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_notification_recipients_unique_destination" ON "notification_recipients" USING btree ("user_id","channel","destination");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pipe_user_ad" ON "pipeline_items" USING btree ("user_id","ad_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pipe_user_id" ON "pipeline_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pipe_stage" ON "pipeline_items" USING btree ("stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notes_user_ad" ON "property_notes" USING btree ("user_id","ad_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notes_user_id" ON "property_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ss_user_id" ON "saved_searches" USING btree ("user_id");
