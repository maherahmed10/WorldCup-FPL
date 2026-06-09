// Serves pre-fetched match stats (events, statistics, lineups) for one fixture.
// Reads exclusively from our DB — never calls API-Football.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [events, statistics, lineups] = await Promise.all([
    db.matchEvent.findMany({
      where: { fixtureId: id },
      orderBy: [{ minute: "asc" }, { extraMinute: "asc" }],
    }),
    db.matchStatistic.findMany({ where: { fixtureId: id } }),
    db.matchLineup.findMany({
      where: { fixtureId: id },
      orderBy: [{ isSubstitute: "asc" }, { grid: "asc" }],
    }),
  ]);

  if (statistics.length === 0 && events.length === 0 && lineups.length === 0) {
    return NextResponse.json({ noData: true });
  }

  return NextResponse.json({ events, statistics, lineups });
}
