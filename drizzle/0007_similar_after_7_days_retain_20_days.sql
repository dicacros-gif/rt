DELETE FROM `keywords`
WHERE `first_seen_at` < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-20 days');--> statement-breakpoint

DELETE FROM `app_meta`
WHERE `key` = 'aged_keyword_cleanup';--> statement-breakpoint

PRAGMA optimize;
