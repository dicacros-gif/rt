CREATE INDEX IF NOT EXISTS `keywords_first_seen_idx`
ON `keywords` (`first_seen_at`);--> statement-breakpoint

INSERT OR IGNORE INTO `dismissed_keywords` (`portal`, `normalized_keyword`)
SELECT 'all', `normalized_keyword`
FROM `keywords`
WHERE `keyword` LIKE '%김시우%'
   OR `keyword` LIKE '%황희찬%'
   OR `keyword` LIKE '%준우승%'
   OR `keyword` LIKE '%챔피언십%'
   OR `keyword` LIKE '%개막전%'
   OR `keyword` LIKE '%스켈레톤%'
   OR `keyword` LIKE '%아이스하키%'
   OR `keyword` LIKE '%아이스 하키%'
   OR (`keyword` LIKE '%KT%' AND `keyword` LIKE '%키움%' AND `keyword` LIKE '%경기%');--> statement-breakpoint

DELETE FROM `keywords`
WHERE `normalized_keyword` IN (
  SELECT `normalized_keyword`
  FROM `dismissed_keywords`
  WHERE `portal` = 'all'
);--> statement-breakpoint

DELETE FROM `keywords`
WHERE `first_seen_at` < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days');--> statement-breakpoint

PRAGMA optimize;
