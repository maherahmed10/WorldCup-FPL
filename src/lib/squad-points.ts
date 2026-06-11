// ─────────────────────────────────────────────────────────────────────────
// Squad scoring: turn settled PlayerMatchStat.fantasyPoints into the numbers
// the dashboard shows (per-player GW points, the captain-doubled GW total, and
// the season total). The pure aggregation lives here for unit testing; the DB
// loaders read only our own DB (points come from the settlement job).
// ─────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { scoreSquadGameweek, resolveCaptains } from "@/lib/scoring";
import { applyAutoSubs, type Position, type PlayerWithMinutes } from "@/lib/squad-rules";

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
 * Gameweek total for a squad, with FPL bench auto-subs.
 *
 * Any starter who played 0 minutes is replaced by the first eligible bench
 * player (bench in left-to-right priority order) whose entry keeps a legal
 * formation — GKs only swap with GKs. The captain (or vice, if the captain
 * played 0 minutes) scores ×2; a second captain (Extra Captain perk) also ×2.
 * A subbed-in bench player never inherits the armband.
 *
 * `players` must include `position` and be ordered so that bench priority is the
 * array order of the bench players (GK first). `points`/`minutes` are per-player
 * maps (missing = 0).
 */
export function squadGameweekTotal(
  players: Array<{ id: string; position: Position; isStarting: boolean }>,
  captainId: string | null,
  points: Record<string, number>,
  viceId: string | null = null,
  minutes: Record<string, number> = {},
  captain2Id: string | null = null, // second captain (Extra Captain perk) — also ×2
): number {
  // Build the minute-aware starter/bench split for the auto-sub engine. price +
  // country are irrelevant to scoring but required by the SquadPlayer shape.
  const toPwm = (p: { id: string; position: Position }): PlayerWithMinutes => ({
    id: p.id,
    position: p.position,
    price: 0,
    country: "",
    minutesPlayed: minutes[p.id] ?? 0,
  });
  const startersIn = players.filter((p) => p.isStarting).map(toPwm);
  // Bench priority = the displayed left-to-right order, with the GK first (FPL
  // convention: the bench keeper is sub 1). Keeps the given order otherwise.
  const benchIn = players
    .filter((p) => !p.isStarting)
    .map(toPwm)
    .sort((a, b) => (a.position === "GK" ? -1 : b.position === "GK" ? 1 : 0));

  // Auto-sub 0-minute starters for the first eligible bench player (left→right).
  const { starters: effective } = applyAutoSubs(startersIn, benchIn);

  const scored = effective.map((p) => ({ playerId: p.id, points: points[p.id] ?? 0 }));
  const captains = resolveCaptains(captainId, viceId, captain2Id, minutes);
  return scoreSquadGameweek(scored, captains);
}

/**
 * Season total points for a user: sum each of their squads' gameweek totals.
 * Reads the per-gameweek captain/vice from GameweekPick (falling back to the
 * squad's initial captain), applying the vice auto-sub rule per gameweek.
 */
export async function getUserSeasonTotal(userId: string): Promise<number> {
  const squads = await db.squad.findMany({
    where: { userId },
    include: {
      players: {
        select: { playerId: true, isStarting: true, player: { select: { position: true } } },
      },
    },
  });
  const picks = await db.gameweekPick.findMany({
    where: { userId },
    select: { gameweekId: true, captainId: true, viceId: true, captain2Id: true },
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
      squad.players.map((p) => ({
        id: p.playerId,
        position: p.player.position as Position,
        isStarting: p.isStarting,
      })),
      pick?.captainId ?? squad.captainId,
      points,
      pick?.viceId ?? null,
      minutes,
      pick?.captain2Id ?? null,
    );
  }
  return total;
}
