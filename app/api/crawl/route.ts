import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import { crawlAndStore } from "../../../db/keywords";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = (env as unknown as { CRON_SECRET?: string }).CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "인증되지 않은 수집 요청입니다." }, { status: 401 });
  }

  const result = await crawlAndStore();
  return NextResponse.json({ ok: true, ...result, updatedAt: new Date().toISOString() });
}
