// Maps to design: screens_more.jsx (FixturesScreen)
// Owner: Teammate C (Lane 3)
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { computeGroupsFromFixtures, type FixtureForGroup } from "@/lib/leagues";
import { FixturesClient, type GameweekData } from "@/components/FixturesClient";

// Local shape for the Prisma query result (avoids implicit-any in callbacks).
interface TeamRow { id: string; name: string; logoUrl: string | null }
interface FixtureRow {
  id: string;
  kickoff: Date;
  status: string;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: TeamRow;
  awayTeam: TeamRow;
}
interface GameweekRow {
  id: string;
  label: string;
  roundType: string;
  startsAt: Date;
  deadline: Date;
  isKnockout: boolean;
  fixtures: FixtureRow[];
}

export default async function FixturesPage() {
  let gameweeks: GameweekData[] = [];
  let groupStandings: ReturnType<typeof computeGroupsFromFixtures> = [];

  try {
    const raw = await db.gameweek.findMany({
      orderBy: { startsAt: "asc" },
      include: {
        fixtures: {
          orderBy: { kickoff: "asc" },
          include: {
            homeTeam: { select: { id: true, name: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });

    const rows = raw as unknown as GameweekRow[];

    // Serialise dates to ISO strings for the client component.
    gameweeks = rows.map((gw: GameweekRow) => ({
      id: gw.id,
      label: gw.label,
      roundType: gw.roundType,
      startsAt: gw.startsAt.toISOString(),
      deadline: gw.deadline.toISOString(),
      isKnockout: gw.isKnockout,
      fixtures: gw.fixtures.map((f: FixtureRow) => ({
        id: f.id,
        kickoff: f.kickoff.toISOString(),
        status: f.status,
        venue: f.venue,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
      })),
    }));

    // Derive group standings from group-stage fixtures (no group label in DB,
    // so we cluster by union-find on who plays whom — see lib/leagues.ts).
    const groupFixtures: FixtureForGroup[] = rows
      .filter((gw: GameweekRow) => gw.roundType === "GROUP")
      .flatMap((gw: GameweekRow) =>
        gw.fixtures.map((f: FixtureRow) => ({
          homeTeamId: f.homeTeam.id,
          awayTeamId: f.awayTeam.id,
          homeTeamName: f.homeTeam.name,
          awayTeamName: f.awayTeam.name,
          homeScore: f.homeScore,
          awayScore: f.awayScore,
          status: f.status,
        })),
      );

    groupStandings = computeGroupsFromFixtures(groupFixtures);
  } catch {
    // DB not reachable — render empty state.
  }

  return <FixturesClient gameweeks={gameweeks} groupStandings={groupStandings} />;
}
