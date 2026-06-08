// Odds-only refresh (ROADMAP 3.1). Odds have a 7-day availability window and move
// up to kickoff, so this runs more often than the full sync. Separate path so
// Vercel Cron can give it its own (tighter) schedule.
//
//   GET /api/cron/odds            → odds for upcoming fixtures only
import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { syncOdds } from "@/jobs/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    await syncOdds();
    return NextResponse.json({ ok: true, ran: ["odds"] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
