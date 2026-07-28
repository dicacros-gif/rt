import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { crawlIfDue, dismissKeyword, listKeywords } from "../../../db/keywords";
import type { PortalId } from "../../../lib/trend-sources";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const portalInfo = {
  daum: { name: "다음", description: "다음 첫 화면 실시간 트렌드 순위", source: "다음 실시간 트렌드" },
  google: { name: "구글", description: "대한민국 실시간 급상승 검색어", source: "Google Trends 실시간 순위" },
  naver: { name: "크리에이터 어드바이저", description: "크리에이터 어드바이저 공개 순위", source: "크리에이터 어드바이저 공개 순위" },
  signal: { name: "Signal.bz", description: "실시간 검색어 TOP 10", source: "Signal.bz" },
} satisfies Record<PortalId, { name: string; description: string; source: string }>;

export async function GET() {
  await crawlIfDue();
  const grouped = await listKeywords();

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
        lastSeenAt: row.last_seen_at,
      })),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json() as { id?: number; password?: string };
  if (!Number.isInteger(body.id) || Number(body.id) < 1) {
    return NextResponse.json({ error: "잘못된 삭제 요청입니다." }, { status: 400 });
  }

  const expected = (env as unknown as { DELETE_PASSWORD?: string }).DELETE_PASSWORD;
  if (!expected || !safeEqual(String(body.password ?? ""), expected)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  await dismissKeyword(Number(body.id));
  return NextResponse.json({ ok: true });
}

function safeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
