import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { crawlIfDue, dismissKeyword, listKeywords } from "../../../db/keywords";
import type { PortalId } from "../../../lib/trend-sources";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const deleteDeviceCookie = "trend_delete_device";
const deleteDeviceMaxAge = 60 * 60 * 24 * 365;

const portalInfo = {
  daum: { name: "다음", description: "다음 첫 화면 실시간 트렌드 순위", source: "다음 실시간 트렌드" },
  google: { name: "구글", description: "대한민국 실시간 급상승 검색어", source: "Google Trends 실시간 순위" },
  naver: { name: "크리에이터 어드바이저", description: "크리에이터 어드바이저 공개 순위", source: "크리에이터 어드바이저 공개 순위" },
  signal: { name: "네이버", description: "네이버 실시간 검색어 TOP 10", source: "네이버 실시간 검색어" },
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
  if (!expected) {
    return NextResponse.json({ error: "삭제 인증 설정을 확인해 주세요." }, { status: 503 });
  }
  const suppliedPassword = String(body.password ?? "");
  const passwordAuthorized = safeEqual(suppliedPassword, expected);
  const savedDeviceToken = request.cookies.get(deleteDeviceCookie)?.value ?? "";
  const deviceAuthorized = safeEqual(savedDeviceToken, await createDeleteDeviceToken(expected));

  if (!passwordAuthorized && !deviceAuthorized) {
    return NextResponse.json({
      error: "삭제 비밀번호를 확인해 주세요.",
      requiresPassword: true,
    }, { status: 401 });
  }

  await dismissKeyword(Number(body.id));
  const response = NextResponse.json({ ok: true, deviceAuthorized: true });
  response.cookies.set(deleteDeviceCookie, await createDeleteDeviceToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: deleteDeviceMaxAge,
  });
  return response;
}

async function createDeleteDeviceToken(secret: string) {
  const input = new TextEncoder().encode(`delete-device:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
