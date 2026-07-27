CREATE TABLE `crawl_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_crawled_at` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_dismissed_keywords` (
	`portal` text NOT NULL,
	`normalized_keyword` text NOT NULL,
	`dismissed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_dismissed_keywords`("portal", "normalized_keyword", "dismissed_at") SELECT "portal", "normalized_keyword", "dismissed_at" FROM `dismissed_keywords`;--> statement-breakpoint
DROP TABLE `dismissed_keywords`;--> statement-breakpoint
ALTER TABLE `__new_dismissed_keywords` RENAME TO `dismissed_keywords`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `dismissed_keywords_portal_normalized_idx` ON `dismissed_keywords` (`portal`,`normalized_keyword`);--> statement-breakpoint
CREATE TABLE `__new_keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portal` text NOT NULL,
	`normalized_keyword` text NOT NULL,
	`keyword` text NOT NULL,
	`link` text NOT NULL,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_keywords`("id", "portal", "normalized_keyword", "keyword", "link", "first_seen_at", "last_seen_at") SELECT "id", "portal", "normalized_keyword", "keyword", "link", "first_seen_at", "last_seen_at" FROM `keywords`;--> statement-breakpoint
DROP TABLE `keywords`;--> statement-breakpoint
ALTER TABLE `__new_keywords` RENAME TO `keywords`;--> statement-breakpoint
CREATE UNIQUE INDEX `keywords_portal_normalized_idx` ON `keywords` (`portal`,`normalized_keyword`);--> statement-breakpoint
CREATE INDEX `keywords_portal_seen_idx` ON `keywords` (`portal`,`first_seen_at`);