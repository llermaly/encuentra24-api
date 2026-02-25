CREATE INDEX `idx_category_published` ON `listings` (`category`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_subcategory_published` ON `listings` (`subcategory`,`published_at`);