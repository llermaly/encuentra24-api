CREATE TABLE IF NOT EXISTS "crawl_errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"crawl_run_id" integer,
	"url" text NOT NULL,
	"error_type" text NOT NULL,
	"status_code" integer,
	"message" text,
	"occurred_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crawl_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'incremental',
	"started_at" text NOT NULL,
	"finished_at" text,
	"status" text NOT NULL,
	"category" text,
	"subcategory" text,
	"region_slug" text,
	"pages_processed" integer DEFAULT 0,
	"listings_found" integer DEFAULT 0,
	"listings_new" integer DEFAULT 0,
	"listings_updated" integer DEFAULT 0,
	"details_crawled" integer DEFAULT 0,
	"errors" integer DEFAULT 0,
	"duration_secs" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crawl_seen_listings" (
	"crawl_run_id" integer NOT NULL,
	"ad_id" text NOT NULL,
	"seen_at" text NOT NULL,
	CONSTRAINT "crawl_seen_listings_pkey" PRIMARY KEY("crawl_run_id","ad_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_id" text NOT NULL,
	"slug" text,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"housing_type" text,
	"title" text,
	"description" text,
	"price" double precision,
	"currency" text DEFAULT 'USD',
	"old_price" double precision,
	"price_per_sqm_construction" double precision,
	"price_per_sqm_land" double precision,
	"province" text,
	"city" text,
	"location" text,
	"address" text,
	"region_slug" text,
	"latitude" double precision,
	"longitude" double precision,
	"bedrooms" integer,
	"bathrooms" double precision,
	"parking" integer,
	"built_area_sqm" double precision,
	"land_area_sqm" double precision,
	"total_sqm" double precision,
	"year_built" integer,
	"levels" integer,
	"floor_number" integer,
	"floor_type" text,
	"ceiling_height" double precision,
	"maintenance_cost" double precision,
	"title_status" text,
	"images" jsonb,
	"image_count" integer DEFAULT 0,
	"has_video" boolean,
	"has_vr" boolean,
	"seller_id" integer,
	"seller_name" text,
	"agent_name" text,
	"seller_type" text,
	"seller_verified" boolean,
	"feature_level" text,
	"discount_pct" double precision,
	"favorites_count" integer,
	"amenities" jsonb,
	"published_at" text,
	"first_seen_at" text NOT NULL,
	"last_seen_at" text NOT NULL,
	"removed_at" text,
	"updated_at" text NOT NULL,
	"removal_checked_at" text,
	"detail_crawled" boolean DEFAULT false,
	"crawl_version" integer DEFAULT 1,
	"raw_json_ld" text,
	"raw_loopa_data" text,
	"raw_retail_rocket" text,
	CONSTRAINT "listings_ad_id_unique" UNIQUE("ad_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_id" text NOT NULL,
	"price" double precision NOT NULL,
	"currency" text DEFAULT 'USD',
	"source" text,
	"recorded_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sellers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"verified" boolean DEFAULT false,
	"whatsapp" text,
	"phone" text,
	"profile_url" text,
	"listing_count" integer DEFAULT 0,
	"sample_listing_url" text,
	"first_seen_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "sellers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csl_ad_id" ON "crawl_seen_listings" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_csl_seen_at" ON "crawl_seen_listings" USING btree ("seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category" ON "listings" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subcategory" ON "listings" USING btree ("subcategory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price" ON "listings" USING btree ("price");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bedrooms" ON "listings" USING btree ("bedrooms");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_location" ON "listings" USING btree ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_province" ON "listings" USING btree ("province");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_city" ON "listings" USING btree ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_last_seen" ON "listings" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_detail_crawled" ON "listings" USING btree ("detail_crawled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_built_area" ON "listings" USING btree ("built_area_sqm");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_land_area" ON "listings" USING btree ("land_area_sqm");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_year_built" ON "listings" USING btree ("year_built");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category_subcategory" ON "listings" USING btree ("category","subcategory");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category_location" ON "listings" USING btree ("category","location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category_price" ON "listings" USING btree ("category","price");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_province_city" ON "listings" USING btree ("province","city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_published_at" ON "listings" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_first_seen_at" ON "listings" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_removed_at" ON "listings" USING btree ("removed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category_published" ON "listings" USING btree ("category","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subcategory_published" ON "listings" USING btree ("subcategory","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ph_ad_id" ON "price_history" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ph_recorded_at" ON "price_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_seller_name" ON "sellers" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_seller_whatsapp" ON "sellers" USING btree ("whatsapp");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listings_search_text_trgm"
ON "listings"
USING gin ((
  coalesce("title", '') || ' ' ||
  coalesce("description", '') || ' ' ||
  coalesce("location", '')
) gin_trgm_ops);
