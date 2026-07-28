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
  const xml = await fetchText("https://trends.google.com/trending/rss?geo=KR");
  const primary = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map((match) => decode(match[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
  return unique(primary).map((keyword) => ({
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

async function collectDaumSuggestions(seeds: string[]): Promise<CollectedItem[]> {
  const responses = await Promise.allSettled(seeds.slice(0, 12).map(async (seed) => {
    const url = new URL("https://suggest.search.daum.net/sushi/opensearch/pc");
    url.searchParams.set("q", seed);
    url.searchParams.set("DA", "JU2");
    const data = JSON.parse(await fetchText(url.toString())) as unknown[];
    return Array.isArray(data[1]) ? data[1].map((value) => String(value)) : [];
  }));
  const keywords = unique(responses.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  )).slice(0, 30);
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
  const primaryResults = await Promise.allSettled([
    collectSignal(),
    collectNaverPopular(),
    collectGoogle(),
  ]);
  const primary = primaryResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seeds = primary
    .filter((item) => item.portal === "signal" || item.portal === "google")
    .map((item) => item.keyword);
  const daum = await collectDaumSuggestions(seeds).catch(() => []);
  return [...primary, ...daum];
}

export const normalizeKeyword = (keyword: string) =>
  keyword.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
