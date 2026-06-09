// Fixture detail: stadium hero + stats / events / lineups for a finished match.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { FixtureStatsClient } from "@/components/FixtureStatsClient";
import type {
  FixtureDetail,
  YourHaul,
  MatchStatsData,
} from "@/components/FixtureStatsClient";

export default async function FixtureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // ── Core fixture row (always needed) ──────────────────────────────────────
  const fixture = await db.fixture.findUnique({
    where: { id },
    include: {
      homeTeam: { select: { id: true, name: true, country: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, country: true, logoUrl: true } },
      gameweek: { select: { label: true } },
    },
  });
  if (!fixture) notFound();

  const detail: FixtureDetail = {
    id: fixture.id,
    kickoff: fixture.kickoff.toISOString(),
    status: fixture.status,
    venue: fixture.venue ?? null,
    homeScore: fixture.homeScore ?? null,
    awayScore: fixture.awayScore ?? null,
    round: fixture.gameweek.label,
    homeTeam: {
      id: fixture.homeTeam.id,
      name: fixture.homeTeam.name,
      country: fixture.homeTeam.country,
      logoUrl: fixture.homeTeam.logoUrl ?? null,
    },
    awayTeam: {
      id: fixture.awayTeam.id,
      name: fixture.awayTeam.name,
      country: fixture.awayTeam.country,
      logoUrl: fixture.awayTeam.logoUrl ?? null,
    },
  };

  // ── Match stats (may be empty before syncMatchStats runs) ──────────────────
  const [rawEvents, rawStats, rawLineups] = await Promise.all([
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

  const statsData: MatchStatsData | null =
    rawStats.length > 0 || rawEvents.length > 0 || rawLineups.length > 0
      ? {
          events: rawEvents.map((e) => ({
            id: e.id,
            teamId: e.teamId,
            playerApiId: e.playerApiId,
            playerName: e.playerName,
            assistApiId: e.assistApiId,
            assistName: e.assistName ?? null,
            minute: e.minute,
            extraMinute: e.extraMinute ?? null,
            type: e.type,
            detail: e.detail,
            comments: e.comments ?? null,
          })),
          statistics: rawStats.map((s) => ({
            id: s.id,
            teamId: s.teamId,
            key: s.key,
            value: s.value,
          })),
          lineups: rawLineups.map((l) => ({
            id: l.id,
            teamId: l.teamId,
            formation: l.formation ?? null,
            playerApiId: l.playerApiId,
            playerName: l.playerName,
            playerNumber: l.playerNumber ?? null,
            pos: l.pos ?? null,
            grid: l.grid ?? null,
            isSubstitute: l.isSubstitute,
          })),
        }
      : null;

  // ── Personalisation: "Your haul" ──────────────────────────────────────────
  let haul: YourHaul | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Find the most recent squad for this user.
      const latestSquad = await db.squad.findFirst({
        where: { userId: user.id },
        orderBy: { gameweek: { startsAt: "desc" } },
        include: {
          players: {
            include: { player: { include: { team: true } } },
          },
        },
      });

      if (latestSquad) {
        const squadPlayerIds = new Set(latestSquad.players.map((sp) => sp.playerId));

        // Get the player match stats for this fixture filtered to the user's squad.
        const matchPlayerStats = await db.playerMatchStat.findMany({
          where: {
            fixtureId: id,
            playerId: { in: [...squadPlayerIds] },
          },
          include: { player: { include: { team: true } } },
        });

        if (matchPlayerStats.length > 0) {
          const captainId = latestSquad.captainId ?? null;
          const entries = matchPlayerStats.map((ms) => ({
            playerId: ms.playerId,
            name: ms.player.name,
            country: ms.player.team.country,
            pts: ms.fantasyPoints ?? 0,
            isCaptain: ms.playerId === captainId,
          }));
          const total = entries.reduce(
            (sum, e) => sum + (e.isCaptain ? e.pts : e.pts),
            0,
          );
          haul = { entries, total };
        }
      }
    }
  } catch {
    // Auth error or no session — haul stays null, page still renders.
  }

  return (
    <FixtureStatsClient fixture={detail} stats={statsData} haul={haul} />
  );
}
