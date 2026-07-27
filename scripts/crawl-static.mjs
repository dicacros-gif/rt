import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve("data/trends.json");
const portalInfo = {
  daum: { name: "다음", description: "주요 뉴스 기반 누적 화제어", source: "다음" },
  google: { name: "구글", description: "대한민국 실시간 급상승 검색어", source: "Google Trends" },
  naver: { name: "크리에이터 어드바이저", description: "네이버 인기 유입 검색어 참고", source: "네이버 공개 인기 주제" },
  signal: { name: "Signal.bz", description: "실시간 검색어 TOP 10", source: "Signal.bz 공개 API" },
};

const decode = (value) => String(value ?? "")
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/<[^>]+>/g, "")
  .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/\\n|\\r|\\t/g, " ").replace(/\\"/g, "\"").replace(/\\\//g, "/")
  .replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

const comparisonKey = (value) => decode(value).normalize("NFKC")
  .toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");

const unique = (values) => {
  const seen = new Set();
  return values.map(decode).filter((value) => {
    const key = comparisonKey(value);
    if (!key || value.length < 2 || value.length > 100 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const searchLink = (portal, keyword) => {
  const base = portal === "naver" ? "https://search.naver.com/search.naver?query="
    : portal === "daum" ? "https://search.daum.net/search?q="
      : portal === "signal" ? "https://search.naver.com/search.naver?query="
        : "https://www.google.com/search?q=";
  return `${base}${encodeURIComponent(keyword)}`;
};

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendNow/1.0; +https://github.com/dicacros-gif/rt)" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const charset = response.headers.get("content-type")?.match(/charset=([^;]+)/i)?.[1]?.trim() ?? "utf-8";
  const encoding = /euc-?kr|ks_c_5601/i.test(charset) ? "euc-kr" : "utf-8";
  return new TextDecoder(encoding).decode(await response.arrayBuffer());
}

async function collectGoogle() {
  const xml = await fetchText("https://trends.google.com/trending/rss?geo=KR");
  const primary = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => decode(match[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
  const related = [...xml.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/gi)]
    .map((match) => decode(match[1]));
  return unique([...primary, ...related]).map((keyword) => ({ portal: "google", keyword }));
}

async function collectHeadlines(portal, url) {
  const html = await fetchText(url);
  const candidates = [
    ...[...html.matchAll(/<a[^>]+(?:class="[^"]*(?:ranking|rank|item|link_txt|tit|headline)[^"]*"|data-tiara-layer="[^"]*")[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => match[1]),
    ...[...html.matchAll(/"(?:title|headline|subject)"\s*:\s*"([^"]+)"/gi)]
      .map((match) => match[1]),
  ];
  return unique(candidates).map((keyword) => ({ portal, keyword }));
}

async function collectSignal() {
  const response = await fetch("https://api.signal.bz/news/realtime");
  if (!response.ok) throw new Error(`Signal returned ${response.status}`);
  const data = await response.json();
  return unique((data.top10 ?? []).slice(0, 10).map((item) => item.keyword ?? ""))
    .map((keyword) => ({ portal: "signal", keyword }));
}

async function collectAll() {
  const results = await Promise.allSettled([
    collectSignal(),
    collectHeadlines("naver", "https://news.naver.com/main/ranking/popularDay.naver"),
    collectGoogle(),
    collectHeadlines("daum", "https://www.daum.net/"),
  ]);
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return { updatedAt: null, portals: [] };
  }
}

const existing = await readExisting();
const collected = await collectAll();
const now = new Date().toISOString();
const existingItems = existing.portals?.flatMap((portal) => portal.items ?? []) ?? [];
const seen = new Set(existingItems.map((item) => comparisonKey(item.keyword)));
let nextId = existingItems.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
let inserted = 0;

const additions = new Map(Object.keys(portalInfo).map((id) => [id, []]));
for (const item of collected) {
  const key = comparisonKey(item.keyword);
  if (!key || seen.has(key)) continue;
  seen.add(key);
  additions.get(item.portal).push({
    id: nextId++,
    keyword: decode(item.keyword),
    link: searchLink(item.portal, decode(item.keyword)),
    firstSeenAt: now,
    lastSeenAt: now,
  });
  inserted += 1;
}

const oldPortals = new Map((existing.portals ?? []).map((portal) => [portal.id, portal]));
const portals = Object.entries(portalInfo).map(([id, info]) => {
  const items = [...(additions.get(id) ?? []), ...(oldPortals.get(id)?.items ?? [])];
  return {
    id,
    ...info,
    items: items.map((item, index) => ({ ...item, rank: index + 1 })),
  };
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ updatedAt: now, portals }, null, 2)}\n`, "utf8");
console.log(`Collected ${collected.length}, inserted ${inserted}, total ${portals.reduce((sum, portal) => sum + portal.items.length, 0)}`);
