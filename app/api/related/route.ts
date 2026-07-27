import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type SourceName = "naver" | "daum" | "google";
type RelatedResult = { keyword: string; sources: SourceName[] };

const headers = {
  "User-Agent": "Mozilla/5.0 (compatible; TrendNow/1.0; +https://github.com/dicacros-gif/rt)",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

const normalize = (value: unknown) =>
  String(value ?? "").normalize("NFC").replace(/[\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim();

const comparisonKey = (value: string) =>
  normalize(value).toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");

async function fetchNaver(seed: string) {
  const url = new URL("https://ac.search.naver.com/nx/ac");
  Object.entries({
    q: seed, con: "0", frm: "nx", ans: "2", r_format: "json",
    r_enc: "UTF-8", r_unicode: "0", t_koreng: "1", run: "2",
    rev: "4", q_enc: "UTF-8", st: "100",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Naver ${response.status}`);
  const data = await response.json() as { items?: unknown[][] };
  const values: string[] = [];
  for (const group of data.items ?? []) {
    for (const item of group) {
      if (Array.isArray(item) && item.length) values.push(normalize(item[0]));
    }
  }
  return values.slice(0, 15);
}

async function fetchDaum(seed: string) {
  const url = new URL("https://suggest.search.daum.net/sushi/opensearch/pc");
  url.searchParams.set("q", seed);
  url.searchParams.set("DA", "JU2");
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Daum ${response.status}`);
  const data = await response.json() as unknown[];
  return (Array.isArray(data[1]) ? data[1] : []).map(normalize).filter(Boolean).slice(0, 15);
}

async function fetchGoogle(seed: string) {
  const url = new URL("https://suggestqueries.google.com/complete/search");
  url.searchParams.set("client", "firefox");
  url.searchParams.set("hl", "ko");
  url.searchParams.set("q", seed);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Google ${response.status}`);
  const data = await response.json() as unknown[];
  return (Array.isArray(data[1]) ? data[1] : []).map(normalize).filter(Boolean).slice(0, 15);
}

export async function GET(request: NextRequest) {
  const seed = normalize(request.nextUrl.searchParams.get("q"));
  if (!seed || seed.length > 100) {
    return NextResponse.json({ error: "검색어가 필요합니다." }, { status: 400 });
  }

  const sourceEntries = await Promise.all([
    fetchNaver(seed).then((items) => ["naver", items] as const).catch(() => ["naver", []] as const),
    fetchDaum(seed).then((items) => ["daum", items] as const).catch(() => ["daum", []] as const),
    fetchGoogle(seed).then((items) => ["google", items] as const).catch(() => ["google", []] as const),
  ]);

  const seedKey = comparisonKey(seed);
  const unique = new Map<string, RelatedResult>();
  for (const [source, items] of sourceEntries) {
    for (const value of items) {
      const keyword = normalize(value);
      const key = comparisonKey(keyword);
      if (!key || key === seedKey) continue;
      const existing = unique.get(key);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
      } else {
        unique.set(key, { keyword, sources: [source] });
      }
    }
  }

  return NextResponse.json({
    seed,
    count: unique.size,
    items: [...unique.values()],
    sources: Object.fromEntries(sourceEntries.map(([source, items]) => [source, items.length])),
  }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
