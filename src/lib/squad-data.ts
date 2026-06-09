// Server-side helpers to load a user's active squad + the current gameweek,
// and shape them for the Pitch component. Reads only our DB (never the API).
import { db } from "@/lib/db";
import type { Position, SquadPlayer } from "@/lib/squad-rules";
import type { PitchPlayer, Slot } from "@/components/Pitch";

/**
 * Other managers' squads are only viewable once the current transfer window has
 * LOCKED — i.e. the gameweek's deadline has passed. Before then (initial squad
 * selection, or an open knockout transfer window) teams stay hidden so nobody
 * can copy a rival mid-window.
 */
export function teamsViewable(gameweek: { deadline: Date } | null | undefined): boolean {
  return !!gameweek && gameweek.deadline.getTime() <= Date.now();
}

/**
 * The SCORING gameweek — the one currently being played. Drives the squad load,
 * "this round" points, captain, and transfer/store eligibility (isKnockout).
 * First gameweek whose window hasn't fully CLOSED (endsAt >= now).
 */
export async function getCurrentGameweek() {
  const now = new Date();
  const upcoming = await db.gameweek.findFirst({
    where: { endsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
  });
  return upcoming ?? (await db.gameweek.findFirst({ orderBy: { startsAt: "desc" } }));
}

/**
 * The UPCOMING-DEADLINE gameweek — the next one you must act before. Once the
 * current gameweek's DEADLINE (first kickoff) passes, this advances to the next
 * gameweek so the dashboard countdown shows the deadline you can still act on,
 * not one that's already gone. First gameweek with deadline still in the future.
 */
export async function getUpcomingDeadlineGameweek() {
  const now = new Date();
  const upcoming = await db.gameweek.findFirst({
    where: { deadline: { gt: now } },
    orderBy: { deadline: "asc" },
  });
  return upcoming ?? (await db.gameweek.findFirst({ orderBy: { startsAt: "desc" } }));
}

export interface LoadedSquad {
  squadId: string;
  captainId: string | null;
  players: Array<SquadPlayer & { name: string; isStarting: boolean }>;
}

/** Load the user's active squad for a gameweek (most recent valid-from ≤ gw). */
export async function getActiveSquad(
  userId: string,
  gameweekId: string,
): Promise<LoadedSquad | null> {
  const squad = await db.squad.findFirst({
    where: { userId, gameweekId },
    include: {
      players: { include: { player: { include: { team: true } } } },
    },
  });
  if (!squad) return null;

  return {
    squadId: squad.id,
    captainId: squad.captainId,
    players: squad.players.map((sp) => ({
      id: sp.player.id,
      name: sp.player.name,
      position: sp.player.position as Position,
      price: sp.player.price,
      country: sp.player.team.country,
      isStarting: sp.isStarting,
    })),
  };
}

/** Group starters into Pitch rows (GK→DEF→MID→FWD) for the view. */
export function toPitchRows(
  players: Array<SquadPlayer & { name: string; isStarting: boolean }>,
): Record<Position, Slot[]> {
  const rows: Record<Position, Slot[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players.filter((x) => x.isStarting)) {
    const pitchPlayer: PitchPlayer = {
      id: p.id,
      name: p.name,
      country: p.country,
      position: p.position,
      price: p.price,
    };
    rows[p.position].push({ position: p.position, player: pitchPlayer });
  }
  return rows;
}
