// ─────────────────────────────────────────────────────────────────────────
// Squad scoring: turn settled PlayerMatchStat.fantasyPoints into the numbers
// the dashboard shows (per-player GW points, the captain-doubled GW total, and
// the season total). The pure aggregation lives here for unit testing; the DB
// loaders read only our own DB (points come from the settlement job).
// ─────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { scoreSquadGameweek } from "@/lib/scoring";

/**
 * Per-player gameweek points: map of playerId → summed fantasyPoints across that
 * gameweek's fixtures. A player can feature in multiple fixtures within a
 * date-bucket gameweek, so we SUM rather than take one.
 */
export async function getGameweekPlayerPoints(
  playerIds: string[],
  gameweekId: string,
): Promise<Record<string, number>> {
  if (playerIds.length === 0) return {};
  const stats = await db.playerMatchStat.findMany({
    where: {
      playerId: { in: playerIds },
      fantasyPoints: { not: null },
      fixture: { gameweekId },
    },
    select: { playerId: true, fantasyPoints: true },
  });
  const out: Record<string, number> = {};
  for (const s of stats) {
    out[s.playerId] = (out[s.playerId] ?? 0) + (s.fantasyPoints ?? 0);
  }
  return out;
}

/**
 * Gameweek total for a squad: only the STARTING XI scores, captain doubled.
 * `points` is the per-player map from getGameweekPlayerPoints (missing = 0).
 */
export function squadGameweekTotal(
  players: Array<{ id: string; isStarting: boolean }>,
  captainId: string | null,
  points: Record<string, number>,
): number {
  const starters = players
    .filter((p) => p.isStarting)
    .map((p) => ({ playerId: p.id, points: points[p.id] ?? 0 }));
  return scoreSquadGameweek(starters, captainId);
}

/**
 * Season total points for a user: sum each of their squads' gameweek totals.
 * A user has one Squad per gameweek (knockout windows create new ones); each is
 * scored against its own gameweek's settled stats, captain doubled.
 */
export async function getUserSeasonTotal(userId: string): Promise<number> {
  const squads = await db.squad.findMany({
    where: { userId },
    include: { players: { select: { playerId: true, isStarting: true } } },
  });

  let total = 0;
  for (const squad of squads) {
    const ids = squad.players.map((p) => p.playerId);
    const points = await getGameweekPlayerPoints(ids, squad.gameweekId);
    total += squadGameweekTotal(
      squad.players.map((p) => ({ id: p.playerId, isStarting: p.isStarting })),
      squad.captainId,
      points,
    );
  }
  return total;
}
