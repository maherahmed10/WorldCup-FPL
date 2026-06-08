// Scheduled data refresh (ROADMAP 3.1). Vercel Cron hits this a few times daily
// to keep fixtures / standings / odds current during the tournament. Follows the
// architecture rule: API-Football → this job → our DB; user requests read the DB.
//
//   GET /api/cron/sync            → fixtures + standings + odds
//
// Guarded by CRON_SECRET (see src/lib/cron-auth.ts).
import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { syncFixtures, syncStandings, syncOdds } from "@/jobs/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // generous; the odds loop hits one API call per upcoming fixture

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const ran: string[] = [];
  try {
    await syncFixtures();
    ran.push("fixtures");
    await syncStandings();
    ran.push("standings");
    await syncOdds();
    ran.push("odds");
    return NextResponse.json({ ok: true, ran });
  } catch (e) {
    return NextResponse.json({ ok: false, ran, error: (e as Error).message }, { status: 500 });
  }
}
