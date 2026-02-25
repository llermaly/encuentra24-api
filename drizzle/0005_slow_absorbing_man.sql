CREATE INDEX `idx_published_at` ON `listings` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_first_seen_at` ON `listings` (`first_seen_at`);--> statement-breakpoint
CREATE INDEX `idx_removed_at` ON `listings` (`removed_at`);