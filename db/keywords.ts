import { env } from "cloudflare:workers";
import { collectAllTrends, normalizeKeyword, type CollectedItem, type PortalId } from "../lib/trend-sources";
import { isBlockedKeyword } from "../lib/keyword-filter.mjs";

type KeywordRow = {
  id: number;
  portal: PortalId;
  keyword: string;
  link: string;
  first_seen_at: string;
  last_seen_at: string;
};

const keywordSourceVersion = "realtime-rank-only-v4";
const keywordFilterVersion = "exclude-sensitive-sports-quiz-v3";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portal TEXT NOT NULL,
    normalized_keyword TEXT NOT NULL,
    keyword TEXT NOT NULL,
    link TEXT NOT NULL,
    first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portal, normalized_keyword)
  )`,
  `CREATE TABLE IF NOT EXISTS dismissed_keywords (
    portal TEXT NOT NULL,
    normalized_keyword TEXT NOT NULL,
    dismissed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(portal, normalized_keyword)
  )`,
  `CREATE TABLE IF NOT EXISTS crawl_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_crawled_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS keywords_portal_seen_idx ON keywords(portal, first_seen_at DESC)",
];

export async function ensureSchema(db: D1Database = env.DB) {
  await db.batch(schemaStatements.map((sql) => db.prepare(sql)));
}

async function ensureKeywordSourceVersion(db: D1Database) {
  const current = await db.prepare(
    "SELECT value FROM app_meta WHERE key = 'keyword_source_version'",
  ).first<{ value: string }>();
  if (current?.value === keywordSourceVersion) return false;

  // 수집 방식이 바뀌어도 기존 누적 기록은 보존한다.
  await db.prepare(
    `INSERT INTO app_meta (key, value) VALUES ('keyword_source_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).bind(keywordSourceVersion).run();
  return true;
}

async function purgeBlockedKeywords(db: D1Database) {
  const current = await db.prepare(
    "SELECT value FROM app_meta WHERE key = 'keyword_filter_version'",
  ).first<{ value: string }>();
  if (current?.value === keywordFilterVersion) return 0;

  const rows = await db.prepare(
    "SELECT id, normalized_keyword, keyword FROM keywords",
  ).all<{ id: number; normalized_keyword: string; keyword: string }>();
  const blocked = rows.results.filter((row) => isBlockedKeyword(row.keyword));
  const statements = blocked.flatMap((row) => [
    db.prepare(
      "INSERT OR IGNORE INTO dismissed_keywords (portal, normalized_keyword) VALUES ('all', ?)",
    ).bind(row.normalized_keyword),
    db.prepare("DELETE FROM keywords WHERE id = ?").bind(row.id),
  ]);
  statements.push(
    db.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('keyword_filter_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(keywordFilterVersion),
  );
  await db.batch(statements);
  return blocked.length;
}

export async function crawlAndStore(db: D1Database = env.DB) {
  await ensureSchema(db);
  await ensureKeywordSourceVersion(db);
  await purgeBlockedKeywords(db);
  const collected = await collectAllTrends();
  const now = new Date().toISOString();
  if (!collected.length) {
    await db.prepare(
      "INSERT INTO crawl_state (id, last_crawled_at) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET last_crawled_at = excluded.last_crawled_at",
    ).bind(now).run();
    return { collected: 0, inserted: 0 };
  }

  const statements = [...collected].reverse().map((item) => {
    const normalized = normalizeKeyword(item.keyword);
    return db.prepare(
      `INSERT INTO keywords (portal, normalized_keyword, keyword, link, first_seen_at, last_seen_at)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM dismissed_keywords WHERE normalized_keyword = ?
       )
       AND NOT EXISTS (
         SELECT 1 FROM keywords WHERE normalized_keyword = ?
       )
       ON CONFLICT(portal, normalized_keyword) DO UPDATE SET last_seen_at = excluded.last_seen_at, link = excluded.link`,
    ).bind(item.portal, normalized, item.keyword, item.link, now, now, normalized, normalized);
  });
  const results = await db.batch(statements);
  await db.prepare(
    "INSERT INTO crawl_state (id, last_crawled_at) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET last_crawled_at = excluded.last_crawled_at",
  ).bind(now).run();
  return { collected: collected.length, inserted: results.filter((result) => result.meta.changes > 0).length };
}

export async function crawlIfDue(db: D1Database = env.DB, intervalMs = 55 * 60 * 1000) {
  await ensureSchema(db);
  const reset = await ensureKeywordSourceVersion(db);
  await purgeBlockedKeywords(db);
  const state = await db.prepare(
    "SELECT last_crawled_at FROM crawl_state WHERE id = 1",
  ).first<{ last_crawled_at: string }>();
  const lastCrawled = state?.last_crawled_at ? new Date(state.last_crawled_at).getTime() : 0;
  if (!reset && Number.isFinite(lastCrawled) && Date.now() - lastCrawled < intervalMs) {
    return { collected: 0, inserted: 0, skipped: true };
  }
  return { ...await crawlAndStore(db), skipped: false };
}

export async function listKeywords(db: D1Database = env.DB) {
  await ensureSchema(db);
  await ensureKeywordSourceVersion(db);
  await purgeBlockedKeywords(db);
  const result = await db.prepare(
    `SELECT id, portal, keyword, link, first_seen_at, last_seen_at
     FROM keywords
     ORDER BY first_seen_at DESC, id DESC`,
  ).all<KeywordRow>();

  const grouped = new Map<PortalId, KeywordRow[]>([
    ["signal", []], ["naver", []], ["google", []], ["daum", []],
  ]);
  const seen = new Set<string>();
  for (const row of result.results) {
    const normalized = normalizeKeyword(row.keyword);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const rows = grouped.get(row.portal);
    if (rows) rows.push(row);
  }
  return grouped;
}

export async function dismissKeyword(id: number, db: D1Database = env.DB) {
  await ensureSchema(db);
  const row = await db.prepare(
    "SELECT normalized_keyword FROM keywords WHERE id = ?",
  ).bind(id).first<{ normalized_keyword: string }>();
  if (!row) return;
  await db.batch([
    db.prepare(
      "INSERT OR IGNORE INTO dismissed_keywords (portal, normalized_keyword) VALUES ('all', ?)",
    ).bind(row.normalized_keyword),
    db.prepare(
      "DELETE FROM keywords WHERE normalized_keyword = ?",
    ).bind(row.normalized_keyword),
  ]);
}

export function toCollectedItem(row: KeywordRow): CollectedItem {
  return { portal: row.portal, keyword: row.keyword, link: row.link };
}
