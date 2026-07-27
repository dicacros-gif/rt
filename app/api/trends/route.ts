import { NextRequest, NextResponse } from "next/server";
import { crawlAndStore, dismissKeyword, listKeywords } from "../../../db/keywords";
import type { PortalId } from "../../../lib/trend-sources";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const portalInfo = {
  naver: { name: "네이버", description: "많이 본 뉴스 기반 누적 화제어", source: "네이버 뉴스" },
  google: { name: "구글", description: "대한민국 누적 급상승 검색", source: "Google Trends" },
  daum: { name: "다음", description: "주요 뉴스 기반 누적 화제어", source: "다음" },
} satisfies Record<PortalId, { name: string; description: string; source: string }>;

export async function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("limit") ?? 30);
  const limit = Math.max(20, Math.min(50, Number.isFinite(requested) ? requested : 30));

  let grouped = await listKeywords(limit);
  if ([...grouped.values()].every((items) => items.length === 0)) {
    await crawlAndStore();
    grouped = await listKeywords(limit);
  }

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    portals: (Object.keys(portalInfo) as PortalId[]).map((id) => ({
      id,
      ...portalInfo[id],
      items: (grouped.get(id) ?? []).map((row, index) => ({
        id: row.id,
        rank: index + 1,
        keyword: row.keyword,
        link: row.link,
        firstSeenAt: row.first_seen_at,
      })),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json() as { id?: number };
  if (!Number.isInteger(body.id) || Number(body.id) < 1) {
    return NextResponse.json({ error: "잘못된 삭제 요청입니다." }, { status: 400 });
  }
  await dismissKeyword(Number(body.id));
  return NextResponse.json({ ok: true });
}
