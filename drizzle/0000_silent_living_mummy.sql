CREATE TABLE `dismissed_keywords` (
	`portal` text NOT NULL,
	`normalized_keyword` text NOT NULL,
	`dismissed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dismissed_keywords_portal_normalized_idx` ON `dismissed_keywords` (`portal`,`normalized_keyword`);--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`portal` text NOT NULL,
	`normalized_keyword` text NOT NULL,
	`keyword` text NOT NULL,
	`link` text NOT NULL,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keywords_portal_normalized_idx` ON `keywords` (`portal`,`normalized_keyword`);--> statement-breakpoint
CREATE INDEX `keywords_portal_seen_idx` ON `keywords` (`portal`,`first_seen_at`);
