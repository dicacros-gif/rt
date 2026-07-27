import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const keywords = sqliteTable("keywords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  portal: text("portal").notNull(),
  normalizedKeyword: text("normalized_keyword").notNull(),
  keyword: text("keyword").notNull(),
  link: text("link").notNull(),
  firstSeenAt: text("first_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("keywords_portal_normalized_idx").on(table.portal, table.normalizedKeyword),
  index("keywords_portal_seen_idx").on(table.portal, table.firstSeenAt),
]);

export const dismissedKeywords = sqliteTable("dismissed_keywords", {
  portal: text("portal").notNull(),
  normalizedKeyword: text("normalized_keyword").notNull(),
  dismissedAt: text("dismissed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("dismissed_keywords_portal_normalized_idx").on(table.portal, table.normalizedKeyword),
]);
