// Post-match settlement (ROADMAP 3.1). Vercel Cron runs this after match windows
// to compute per-player fantasyPoints for finished fixtures (and, once 1.1 lands,
// resolve bets). Idempotent — settleFixture upserts, so re-running is safe.
//
//   GET /api/cron/settle          → settle all FINISHED fixtures
import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { settleAllFinished } from "@/jobs/settle";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    await settleAllFinished();
    return NextResponse.json({ ok: true, ran: ["settle"] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
