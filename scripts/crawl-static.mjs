import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { extractCreatorAdvisorKeywords } from "../lib/creator-advisor.mjs";
import { extractDaumRealtimeKeywords } from "../lib/daum-trends.mjs";
import { isMatchupKeyword } from "../lib/keyword-filter.mjs";

const outputPath = resolve("data/trends.json");
const dataVersion = "realtime-rank-only-v4";
const portalInfo = {
  daum: { name: "다음", description: "다음 첫 화면 실시간 트렌드 순위", source: "다음 실시간 트렌드" },
  google: { name: "구글", description: "대한민국 실시간 급상승 검색어", source: "Google Trends 실시간 순위" },
  naver: { name: "크리에이터 어드바이저", description: "크리에이터 어드바이저 공개 순위", source: "크리에이터 어드바이저 공개 순위" },
  signal: { name: "Signal.bz", description: "실시간 검색어 TOP 10", source: "Signal.bz" },
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
    if (!key || value.length < 2 || value.length > 60 || value.includes("�")
      || /^https?:\/\//i.test(value) || isMatchupKeyword(value) || seen.has(key)) return false;
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
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const charset = response.headers.get("content-type")?.match(/charset=([^;]+)/i)?.[1]?.trim() ?? "utf-8";
  const encoding = /euc-?kr|ks_c_5601/i.test(charset) ? "euc-kr" : "utf-8";
  return new TextDecoder(encoding).decode(await response.arrayBuffer());
}

async function collectGoogle() {
  const page = await fetchText("https://trends.google.com/trending?geo=KR&hl=ko");
  let keywords = [...page.matchAll(/<div class="mZ3RIc">([\s\S]*?)<\/div>/gi)]
    .map((match) => decode(match[1]));
  if (!keywords.length) {
    const xml = await fetchText("https://trends.google.com/trending/rss?geo=KR");
    keywords = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .map((match) => decode(match[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
  }
  return unique(keywords).slice(0, 25).map((keyword) => ({ portal: "google", keyword }));
}

async function collectCreatorAdvisor() {
  const payload = await fetchText("https://adsensefarm.kr/realtime/naver.php");
  const keywords = extractCreatorAdvisorKeywords(payload);
  return unique(keywords).map((keyword) => ({ portal: "naver", keyword }));
}

async function collectSignal() {
  const response = await fetch("https://api.signal.bz/news/realtime", {
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Signal returned ${response.status}`);
  const data = await response.json();
  return unique((data.top10 ?? []).slice(0, 10).map((item) => item.keyword ?? ""))
    .map((keyword) => ({ portal: "signal", keyword }));
}

async function collectDaumRealtime() {
  const html = await fetchText("https://www.daum.net/");
  return unique(extractDaumRealtimeKeywords(html))
    .slice(0, 10)
    .map((keyword) => ({ portal: "daum", keyword }));
}

async function collectAll() {
  const results = await Promise.allSettled([
    collectDaumRealtime(),
    collectGoogle(),
    collectSignal(),
    collectCreatorAdvisor(),
  ]);
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

async function fetchNaverRelated(seed) {
  const url = new URL("https://ac.search.naver.com/nx/ac");
  Object.entries({
    q: seed, con: "0", frm: "nx", ans: "2", r_format: "json",
    r_enc: "UTF-8", r_unicode: "0", t_koreng: "1", run: "2",
    rev: "4", q_enc: "UTF-8", st: "100",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const data = JSON.parse(await fetchText(url.toString()));
  return (data.items ?? []).flatMap((group) =>
    Array.isArray(group) ? group.map((item) => Array.isArray(item) ? item[0] : "") : []
  );
}

async function fetchDaumRelated(seed) {
  const url = new URL("https://suggest.search.daum.net/sushi/opensearch/pc");
  url.searchParams.set("q", seed);
  url.searchParams.set("DA", "JU2");
  const data = JSON.parse(await fetchText(url.toString()));
  return Array.isArray(data[1]) ? data[1] : [];
}

async function fetchGoogleRelated(seed) {
  const url = new URL("https://suggestqueries.google.com/complete/search");
  url.searchParams.set("client", "firefox");
  url.searchParams.set("hl", "ko");
  url.searchParams.set("q", seed);
  const data = JSON.parse(await fetchText(url.toString()));
  return Array.isArray(data[1]) ? data[1] : [];
}

async function collectRelated(seed) {
  const responses = await Promise.allSettled([
    fetchNaverRelated(seed).then((items) => ["naver", items]),
    fetchDaumRelated(seed).then((items) => ["daum", items]),
    fetchGoogleRelated(seed).then((items) => ["google", items]),
  ]);
  const seedKey = comparisonKey(seed);
  const merged = new Map();
  for (const result of responses) {
    if (result.status !== "fulfilled") continue;
    const [source, values] = result.value;
    for (const keyword of unique(values)) {
      const key = comparisonKey(keyword);
      if (!key || key === seedKey) continue;
      const current = merged.get(key);
      if (current) {
        if (!current.sources.includes(source)) current.sources.push(source);
      } else {
        merged.set(key, { keyword, sources: [source] });
      }
    }
  }
  return [...merged.values()].slice(0, 30);
}

async function collectRelatedSet(seed) {
  const parts = decode(seed).split(/\s+/);
  const prefix = parts.length > 1 ? parts[0] : "";
  const [fullItems, rawPrefixItems] = await Promise.all([
    collectRelated(seed),
    prefix ? collectRelated(prefix) : Promise.resolve([]),
  ]);
  const seen = new Set([
    comparisonKey(seed),
    comparisonKey(prefix),
    ...fullItems.map((item) => comparisonKey(item.keyword)),
  ].filter(Boolean));
  const prefixItems = rawPrefixItems.filter((item) => {
    const key = comparisonKey(item.keyword);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { seed: decode(seed), prefix, fullItems, prefixItems };
}

async function mapLimit(values, limit, callback) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await callback(values[index], index);
    }
  }));
  return results;
}

async function readExisting() {
  try {
    const parsed = JSON.parse(await readFile(outputPath, "utf8"));
    if (!Array.isArray(parsed?.portals)) {
      return { dataVersion, updatedAt: null, portals: [], related: {} };
    }
    // 데이터 형식 버전이 바뀌어도 날짜·시간별 누적 기록은 유지한다.
    return {
      ...parsed,
      dataVersion,
      related: parsed.related && typeof parsed.related === "object" ? parsed.related : {},
    };
  } catch {
    return { dataVersion, updatedAt: null, portals: [], related: {} };
  }
}

const existing = await readExisting();
const collected = await collectAll();
const now = new Date().toISOString();
const removedItemIds = new Set();
const sanitizedPortals = (existing.portals ?? []).map((portal) => ({
  ...portal,
  items: (portal.items ?? []).filter((item) => {
    if (!isMatchupKeyword(item.keyword)) return true;
    removedItemIds.add(String(item.id));
    return false;
  }),
}));
const existingItems = sanitizedPortals.flatMap((portal) => portal.items ?? []);
const seen = new Set(existingItems.map((item) => comparisonKey(item.keyword)));
let nextId = existingItems.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
let inserted = 0;

const additions = new Map(Object.keys(portalInfo).map((id) => [id, []]));
const newItems = [];
for (const item of collected) {
  const key = comparisonKey(item.keyword);
  if (!key || seen.has(key)) continue;
  seen.add(key);
  const newItem = {
    id: nextId++,
    keyword: decode(item.keyword),
    link: searchLink(item.portal, decode(item.keyword)),
    firstSeenAt: now,
    lastSeenAt: now,
  };
  additions.get(item.portal).push(newItem);
  newItems.push(newItem);
  inserted += 1;
}

const oldPortals = new Map(sanitizedPortals.map((portal) => [portal.id, portal]));
const portals = Object.entries(portalInfo).map(([id, info]) => {
  const items = [...(additions.get(id) ?? []), ...(oldPortals.get(id)?.items ?? [])];
  return {
    id,
    ...info,
    items: items.map((item, index) => ({ ...item, rank: index + 1 })),
  };
});

const related = Object.fromEntries(
  Object.entries(existing.related ?? {}).filter(([id]) => !removedItemIds.has(id)),
);
const allItems = portals.flatMap((portal) => portal.items);
const relatedTargets = allItems.filter((item) => {
  const value = related[String(item.id)];
  return !value || Array.isArray(value)
    || !Array.isArray(value.fullItems) || !Array.isArray(value.prefixItems);
});
await mapLimit(relatedTargets, 4, async (item) => {
  related[String(item.id)] = await collectRelatedSet(item.keyword)
    .catch(() => ({ seed: item.keyword, prefix: "", fullItems: [], prefixItems: [] }));
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ dataVersion, updatedAt: now, portals, related }, null, 2)}\n`, "utf8");
console.log(`Collected ${collected.length}, inserted ${inserted}, total ${allItems.length}, related ${Object.keys(related).length}`);
