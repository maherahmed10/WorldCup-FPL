// On-demand player profile data for the player-detail modal. Reads our DB only
// (no API-Football call). Returns the PlayerProfileView for one player id.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toPlayerProfile } from "@/lib/player-profile";
import type { Position } from "@/lib/players";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const player = await db.player.findUnique({
    where: { id },
    include: {
      team: true,
      matchStats: {
        include: {
          fixture: {
            include: { homeTeam: true, awayTeam: true, gameweek: true },
          },
        },
        orderBy: { fixture: { kickoff: "asc" } },
      },
    },
  });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Upcoming fixtures for the player's nation (next scheduled matches).
  const upcoming = await db.fixture.findMany({
    where: {
      status: "SCHEDULED",
      OR: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }],
    },
    include: { homeTeam: true, awayTeam: true, gameweek: true },
    orderBy: { kickoff: "asc" },
    take: 5,
  });

  const view = toPlayerProfile(
    { ...player, position: player.position as Position },
    upcoming,
  );
  return NextResponse.json(view);
}
