CREATE TABLE `crawl_errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`crawl_run_id` integer,
	`url` text NOT NULL,
	`error_type` text NOT NULL,
	`status_code` integer,
	`message` text,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crawl_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`category` text,
	`subcategory` text,
	`region_slug` text,
	`pages_processed` integer DEFAULT 0,
	`listings_found` integer DEFAULT 0,
	`listings_new` integer DEFAULT 0,
	`listings_updated` integer DEFAULT 0,
	`details_crawled` integer DEFAULT 0,
	`errors` integer DEFAULT 0,
	`duration_secs` integer
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ad_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_ad_id_unique` ON `favorites` (`ad_id`);--> statement-breakpoint
CREATE INDEX `idx_fav_ad_id` ON `favorites` (`ad_id`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ad_id` text NOT NULL,
	`slug` text,
	`url` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text NOT NULL,
	`housing_type` text,
	`title` text,
	`description` text,
	`price` real,
	`currency` text DEFAULT 'USD',
	`old_price` real,
	`price_per_sqm_construction` real,
	`price_per_sqm_land` real,
	`province` text,
	`city` text,
	`location` text,
	`address` text,
	`region_slug` text,
	`latitude` real,
	`longitude` real,
	`bedrooms` integer,
	`bathrooms` real,
	`parking` integer,
	`built_area_sqm` real,
	`land_area_sqm` real,
	`total_sqm` real,
	`year_built` integer,
	`levels` integer,
	`floor_number` integer,
	`floor_type` text,
	`ceiling_height` real,
	`maintenance_cost` real,
	`title_status` text,
	`images` text,
	`image_count` integer DEFAULT 0,
	`has_video` integer,
	`has_vr` integer,
	`seller_name` text,
	`seller_type` text,
	`seller_verified` integer,
	`feature_level` text,
	`discount_pct` real,
	`favorites_count` integer,
	`amenities` text,
	`published_at` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`removed_at` text,
	`updated_at` text NOT NULL,
	`detail_crawled` integer DEFAULT false,
	`crawl_version` integer DEFAULT 1,
	`raw_json_ld` text,
	`raw_loopa_data` text,
	`raw_retail_rocket` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_ad_id_unique` ON `listings` (`ad_id`);--> statement-breakpoint
CREATE INDEX `idx_category` ON `listings` (`category`);--> statement-breakpoint
CREATE INDEX `idx_subcategory` ON `listings` (`subcategory`);--> statement-breakpoint
CREATE INDEX `idx_price` ON `listings` (`price`);--> statement-breakpoint
CREATE INDEX `idx_bedrooms` ON `listings` (`bedrooms`);--> statement-breakpoint
CREATE INDEX `idx_location` ON `listings` (`location`);--> statement-breakpoint
CREATE INDEX `idx_province` ON `listings` (`province`);--> statement-breakpoint
CREATE INDEX `idx_city` ON `listings` (`city`);--> statement-breakpoint
CREATE INDEX `idx_last_seen` ON `listings` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `idx_detail_crawled` ON `listings` (`detail_crawled`);--> statement-breakpoint
CREATE INDEX `idx_built_area` ON `listings` (`built_area_sqm`);--> statement-breakpoint
CREATE INDEX `idx_land_area` ON `listings` (`land_area_sqm`);--> statement-breakpoint
CREATE INDEX `idx_year_built` ON `listings` (`year_built`);--> statement-breakpoint
CREATE INDEX `idx_category_location` ON `listings` (`category`,`location`);--> statement-breakpoint
CREATE INDEX `idx_category_price` ON `listings` (`category`,`price`);--> statement-breakpoint
CREATE TABLE `pipeline_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ad_id` text NOT NULL,
	`stage` text DEFAULT 'discovered' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`moved_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pipeline_items_ad_id_unique` ON `pipeline_items` (`ad_id`);--> statement-breakpoint
CREATE INDEX `idx_pipe_ad_id` ON `pipeline_items` (`ad_id`);--> statement-breakpoint
CREATE INDEX `idx_pipe_stage` ON `pipeline_items` (`stage`);--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ad_id` text NOT NULL,
	`price` real NOT NULL,
	`currency` text DEFAULT 'USD',
	`source` text,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ph_ad_id` ON `price_history` (`ad_id`);--> statement-breakpoint
CREATE INDEX `idx_ph_recorded_at` ON `price_history` (`recorded_at`);--> statement-breakpoint
CREATE TABLE `property_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ad_id` text NOT NULL,
	`type` text DEFAULT 'note' NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notes_ad_id` ON `property_notes` (`ad_id`);--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`filters` text NOT NULL,
	`last_checked_at` text,
	`new_match_count` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
