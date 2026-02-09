CREATE TABLE `sellers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`verified` integer DEFAULT false,
	`whatsapp` text,
	`phone` text,
	`profile_url` text,
	`listing_count` integer DEFAULT 0,
	`sample_listing_url` text,
	`first_seen_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sellers_name_unique` ON `sellers` (`name`);--> statement-breakpoint
CREATE INDEX `idx_seller_name` ON `sellers` (`name`);--> statement-breakpoint
CREATE INDEX `idx_seller_whatsapp` ON `sellers` (`whatsapp`);--> statement-breakpoint
ALTER TABLE `listings` ADD `seller_id` integer;