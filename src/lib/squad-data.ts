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

// Prisma squad row → our LoadedSquad shape.
type SquadWithPlayers = {
  id: string;
  captainId: string | null;
  players: Array<{
    isStarting: boolean;
    player: { id: string; name: string; position: string; price: number; team: { country: string } };
  }>;
};
function toLoadedSquad(squad: SquadWithPlayers): LoadedSquad {
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

const SQUAD_INCLUDE = { players: { include: { player: { include: { team: true } } } } } as const;

/** Load the user's active squad for a gameweek (exact (user, gameweek) match). */
export async function getActiveSquad(
  userId: string,
  gameweekId: string,
): Promise<LoadedSquad | null> {
  const squad = await db.squad.findFirst({ where: { userId, gameweekId }, include: SQUAD_INCLUDE });
  return squad ? toLoadedSquad(squad) : null;
}

/** The user's most recent squad across all gameweeks (for carry-forward seeding). */
export async function getMostRecentSquad(
  userId: string,
): Promise<{ squad: LoadedSquad; gameweekId: string } | null> {
  const squad = await db.squad.findFirst({
    where: { userId },
    include: SQUAD_INCLUDE,
    orderBy: { gameweek: { startsAt: "desc" } },
  });
  return squad ? { squad: toLoadedSquad(squad), gameweekId: squad.gameweekId } : null;
}

/**
 * The squad to SEED the picker with for an EDITABLE gameweek. Returns the
 * upcoming-GW squad if a row already exists for it; otherwise the user's
 * most-recent prior squad so the team "carries forward" (FPL model). `seeded`
 * is true when we fell back to a prior GW (no row yet for upcomingGwId), which
 * means the 15 are inherited and locked. sourceGameweekId tells the caller which
 * GW the squad (and its captain/vice pick) came from.
 */
export async function getSquadForEdit(
  userId: string,
  upcomingGwId: string,
): Promise<{ squad: LoadedSquad | null; seeded: boolean; sourceGameweekId: string | null }> {
  const exact = await getActiveSquad(userId, upcomingGwId);
  if (exact) return { squad: exact, seeded: false, sourceGameweekId: upcomingGwId };
  const recent = await getMostRecentSquad(userId);
  if (recent) return { squad: recent.squad, seeded: true, sourceGameweekId: recent.gameweekId };
  return { squad: null, seeded: false, sourceGameweekId: null };
}

/** The captain/vice pick to seed for editing — from whichever GW the squad came from. */
export async function getPickForEdit(
  userId: string,
  sourceGameweekId: string | null,
): Promise<{ captainId: string | null; viceId: string | null } | null> {
  if (!sourceGameweekId) return null;
  return db.gameweekPick.findUnique({
    where: { userId_gameweekId: { userId, gameweekId: sourceGameweekId } },
    select: { captainId: true, viceId: true },
  });
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
