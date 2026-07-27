export type PortalId = "naver" | "google" | "daum";
export type CollectedItem = { portal: PortalId; keyword: string; link: string };

const decode = (value: string) => value
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/<[^>]+>/g, "")
  .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/\\n|\\r|\\t/g, " ").replace(/\\"/g, '"').replace(/\\\//g, "/")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

const unique = (values: string[]) =>
  [...new Set(values.map(decode).filter((value) => value.length > 1 && value.length < 100))];

const searchLink = (portal: PortalId, keyword: string) => {
  const base = portal === "naver" ? "https://search.naver.com/search.naver?query="
    : portal === "daum" ? "https://search.daum.net/search?q="
      : "https://www.google.com/search?q=";
  return `${base}${encodeURIComponent(keyword)}`;
};

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendNow/1.0; +https://github.com/dicacros-gif/rt)" },
  });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response.text();
}

async function collectGoogle(): Promise<CollectedItem[]> {
  const xml = await fetchText("https://trends.google.com/trending/rss?geo=KR");
  const primary = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) =>
    decode(match[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "")
  );
  const related = [...xml.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/gi)]
    .map((match) => decode(match[1]));
  return unique([...primary, ...related]).map((keyword) => ({
    portal: "google", keyword, link: searchLink("google", keyword),
  }));
}

async function collectHeadlines(portal: "naver" | "daum", url: string): Promise<CollectedItem[]> {
  const html = await fetchText(url);
  const candidates = [
    ...[...html.matchAll(/<a[^>]+(?:class="[^"]*(?:ranking|rank|item|link_txt|tit|headline)[^"]*"|data-tiara-layer="[^"]*")[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => match[1]),
    ...[...html.matchAll(/"(?:title|headline|subject)"\s*:\s*"([^"]+)"/gi)]
      .map((match) => match[1]),
  ];
  return unique(candidates).map((keyword) => ({
    portal, keyword, link: searchLink(portal, keyword),
  }));
}

export async function collectAllTrends(): Promise<CollectedItem[]> {
  const results = await Promise.allSettled([
    collectHeadlines("naver", "https://news.naver.com/main/ranking/popularDay.naver"),
    collectGoogle(),
    collectHeadlines("daum", "https://www.daum.net/"),
  ]);
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

export const normalizeKeyword = (keyword: string) =>
  keyword.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
