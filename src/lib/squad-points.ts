// ─────────────────────────────────────────────────────────────────────────
// Squad scoring: turn settled PlayerMatchStat.fantasyPoints into the numbers
// the dashboard shows (per-player GW points, the captain-doubled GW total, and
// the season total). The pure aggregation lives here for unit testing; the DB
// loaders read only our own DB (points come from the settlement job).
// ─────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { scoreSquadGameweek, resolveCaptain } from "@/lib/scoring";

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

/** Per-player minutes played in a gameweek (for the vice auto-sub rule). */
export async function getGameweekMinutes(
  playerIds: string[],
  gameweekId: string,
): Promise<Record<string, number>> {
  if (playerIds.length === 0) return {};
  const stats = await db.playerMatchStat.findMany({
    where: { playerId: { in: playerIds }, fixture: { gameweekId } },
    select: { playerId: true, minutes: true },
  });
  const out: Record<string, number> = {};
  for (const s of stats) out[s.playerId] = (out[s.playerId] ?? 0) + s.minutes;
  return out;
}

/**
 * Gameweek total for a squad: only the STARTING XI scores, captain doubled —
 * or the vice doubled if the captain played 0 minutes (FPL rule).
 * `points`/`minutes` are the per-player maps (missing = 0).
 */
export function squadGameweekTotal(
  players: Array<{ id: string; isStarting: boolean }>,
  captainId: string | null,
  points: Record<string, number>,
  viceId: string | null = null,
  minutes: Record<string, number> = {},
): number {
  const starters = players
    .filter((p) => p.isStarting)
    .map((p) => ({ playerId: p.id, points: points[p.id] ?? 0 }));
  const effectiveCaptain = resolveCaptain(captainId, viceId, minutes);
  return scoreSquadGameweek(starters, effectiveCaptain);
}

/**
 * Season total points for a user: sum each of their squads' gameweek totals.
 * Reads the per-gameweek captain/vice from GameweekPick (falling back to the
 * squad's initial captain), applying the vice auto-sub rule per gameweek.
 */
export async function getUserSeasonTotal(userId: string): Promise<number> {
  const squads = await db.squad.findMany({
    where: { userId },
    include: { players: { select: { playerId: true, isStarting: true } } },
  });
  const picks = await db.gameweekPick.findMany({
    where: { userId },
    select: { gameweekId: true, captainId: true, viceId: true },
  });
  const pickByGw = new Map(picks.map((p) => [p.gameweekId, p]));

  let total = 0;
  for (const squad of squads) {
    const ids = squad.players.map((p) => p.playerId);
    const [points, minutes] = await Promise.all([
      getGameweekPlayerPoints(ids, squad.gameweekId),
      getGameweekMinutes(ids, squad.gameweekId),
    ]);
    const pick = pickByGw.get(squad.gameweekId);
    total += squadGameweekTotal(
      squad.players.map((p) => ({ id: p.playerId, isStarting: p.isStarting })),
      pick?.captainId ?? squad.captainId,
      points,
      pick?.viceId ?? null,
      minutes,
    );
  }
  return total;
}
