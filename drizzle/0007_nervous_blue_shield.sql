CREATE INDEX `idx_category_subcategory` ON `listings` (`category`,`subcategory`);--> statement-breakpoint
CREATE INDEX `idx_province_city` ON `listings` (`province`,`city`);