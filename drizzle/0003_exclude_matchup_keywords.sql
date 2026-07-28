INSERT OR IGNORE INTO `dismissed_keywords` (`portal`, `normalized_keyword`)
SELECT 'all', `normalized_keyword`
FROM `keywords`
WHERE `keyword` LIKE '% vs %' COLLATE NOCASE
   OR `keyword` LIKE '% vs. %' COLLATE NOCASE
   OR `keyword` LIKE '% versus %' COLLATE NOCASE
   OR `keyword` LIKE '% 대 %';--> statement-breakpoint

DELETE FROM `keywords`
WHERE `keyword` LIKE '% vs %' COLLATE NOCASE
   OR `keyword` LIKE '% vs. %' COLLATE NOCASE
   OR `keyword` LIKE '% versus %' COLLATE NOCASE
   OR `keyword` LIKE '% 대 %';
