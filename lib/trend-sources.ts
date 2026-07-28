import { isMatchupKeyword } from "./keyword-filter.mjs";

export type PortalId = "naver" | "google" | "daum" | "signal";
export type CollectedItem = { portal: PortalId; keyword: string; link: string };

const decode = (value: string) => value
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/<[^>]+>/g, "")
  .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/\\n|\\r|\\t/g, " ").replace(/\\"/g, '"').replace(/\\\//g, "/")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

const unique = (values: string[]) =>
  [...new Set(values.map(decode).filter((value) =>
    value.length > 1
    && value.length <= 60
    && !value.includes("�")
    && !/^https?:\/\//i.test(value)
    && !isMatchupKeyword(value)
  ))];

const searchLink = (portal: PortalId, keyword: string) => {
  const base = portal === "naver" ? "https://search.naver.com/search.naver?query="
    : portal === "daum" ? "https://search.daum.net/search?q="
      : portal === "signal" ? "https://search.naver.com/search.naver?query="
      : "https://www.google.com/search?q=";
  return `${base}${encodeURIComponent(keyword)}`;
};

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendNow/1.0; +https://github.com/dicacros-gif/rt)" },
  });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  const charset = response.headers.get("content-type")?.match(/charset=([^;]+)/i)?.[1]?.trim() ?? "utf-8";
  const encoding = /euc-?kr|ks_c_5601/i.test(charset) ? "euc-kr" : "utf-8";
  return new TextDecoder(encoding).decode(await response.arrayBuffer());
}

async function collectGoogle(): Promise<CollectedItem[]> {
  const page = await fetchText("https://trends.google.com/trending?geo=KR&hl=ko");
  let primary = [...page.matchAll(/<div class="mZ3RIc">([\s\S]*?)<\/div>/gi)]
    .map((match) => decode(match[1]));
  if (!primary.length) {
    const xml = await fetchText("https://trends.google.com/trending/rss?geo=KR");
    primary = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .map((match) => decode(match[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
  }
  return unique(primary).slice(0, 25).map((keyword) => ({
    portal: "google", keyword, link: searchLink("google", keyword),
  }));
}

async function collectNaverPopular(): Promise<CollectedItem[]> {
  const html = await fetchText("https://datalab.naver.com/");
  const blocks = [...html.matchAll(/<ul class="rank_list">([\s\S]*?)<\/ul>/gi)];
  const latest = [...blocks].reverse().find((block) =>
    [...block[1].matchAll(/<span class="title">\s*([^<]+)\s*<\/span>/gi)].length === 10
  );
  const keywords = latest
    ? [...latest[1].matchAll(/<span class="title">\s*([^<]+)\s*<\/span>/gi)].map((match) => match[1])
    : [];
  return unique(keywords).map((keyword) => ({
    portal: "naver", keyword, link: searchLink("naver", keyword),
  }));
}

async function collectDaumRealtime(): Promise<CollectedItem[]> {
  const html = await fetchText("https://www.daum.net/");
  const marker = html.indexOf('"uiType":"REALTIME_TREND_TOP"');
  if (marker < 0) return [];
  const block = html.slice(marker, marker + 24_000);
  const keywords = unique(
    [...block.matchAll(/"keyword":"((?:\\.|[^"])*)","rank":/g)]
      .map((match) => {
        try {
          return JSON.parse(`"${match[1]}"`) as string;
        } catch {
          return "";
        }
      }),
  ).slice(0, 10);
  return keywords.map((keyword) => ({
    portal: "daum", keyword, link: searchLink("daum", keyword),
  }));
}

async function collectSignal(): Promise<CollectedItem[]> {
  const response = await fetch("https://api.signal.bz/news/realtime", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendNow/1.0; +https://github.com/dicacros-gif/rt)" },
  });
  if (!response.ok) throw new Error(`Signal returned ${response.status}`);
  const data = await response.json() as { top10?: Array<{ keyword?: string }> };
  return unique((data.top10 ?? []).slice(0, 10).map((item) => item.keyword ?? ""))
    .map((keyword) => ({ portal: "signal", keyword, link: searchLink("signal", keyword) }));
}

export async function collectAllTrends(): Promise<CollectedItem[]> {
  const results = await Promise.allSettled([
    collectDaumRealtime(),
    collectGoogle(),
    collectSignal(),
    collectNaverPopular(),
  ]);
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

export const normalizeKeyword = (keyword: string) =>
  keyword.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
