// ─────────────────────────────────────────────────────────────────────────
// FPL scoring model (build-plan §3). Pure functions — no DB, no API — so they
// are trivially unit-testable. The settlement job feeds rows in, gets points out.
//
// Clean sheets are DERIVED (§3 gotcha #1): a player earns a clean-sheet bonus
// only if they played 60+ minutes AND their team conceded 0 while on the pitch.
// We approximate "while on the pitch" with goalsConceded recorded against the
// player's row in /fixtures/players, which is what the feed gives us.
// ─────────────────────────────────────────────────────────────────────────

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface MatchStatLine {
  position: Position;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  penaltiesSaved: number;
  penaltiesMissed: number;
  goalsConceded: number;
  ownGoals: number;
}

const GOAL_POINTS: Record<Position, number> = { GK: 6, DEF: 6, MID: 5, FWD: 4 };
const CLEAN_SHEET_POINTS: Record<Position, number> = { GK: 4, DEF: 4, MID: 1, FWD: 0 };

/** Compute a single player's FPL points for one match. */
export function scoreMatch(s: MatchStatLine): number {
  let pts = 0;

  // Appearance
  if (s.minutes >= 60) pts += 2;
  else if (s.minutes >= 1) pts += 1;

  // Attacking returns
  pts += s.goals * GOAL_POINTS[s.position];
  pts += s.assists * 3;

  // Clean sheet — derived, requires 60+ minutes and 0 conceded.
  if (s.minutes >= 60 && s.goalsConceded === 0) {
    pts += CLEAN_SHEET_POINTS[s.position];
  }

  // Goalkeeper saves: +1 per 3 saves.
  if (s.position === "GK") {
    pts += Math.floor(s.saves / 3);
    pts += s.penaltiesSaved * 5;
  }

  // Goals conceded penalty (GK/DEF): −1 per 2 conceded.
  if (s.position === "GK" || s.position === "DEF") {
    pts -= Math.floor(s.goalsConceded / 2);
  }

  // Disciplinary / misc
  pts -= s.penaltiesMissed * 2;
  pts -= s.yellowCards * 1;
  pts -= s.redCards * 3;
  pts -= s.ownGoals * 2;

  return pts;
}

/** One labelled component of a player's match score (for the breakdown UI). */
export interface PointComponent {
  label: string;
  pts: number;
}

/**
 * Break a player's match score into labelled components — same maths as
 * scoreMatch, but itemised (Appearance / Goals / Assists / Clean sheet / …).
 * Zero components are omitted. The sum equals scoreMatch(s).
 */
export function breakdownMatch(s: MatchStatLine): PointComponent[] {
  const out: PointComponent[] = [];
  const add = (label: string, pts: number) => { if (pts !== 0) out.push({ label, pts }); };

  if (s.minutes >= 60) add("Played 60+ mins", 2);
  else if (s.minutes >= 1) add("Appearance", 1);

  if (s.goals > 0) add(`${s.goals} goal${s.goals > 1 ? "s" : ""}`, s.goals * GOAL_POINTS[s.position]);
  if (s.assists > 0) add(`${s.assists} assist${s.assists > 1 ? "s" : ""}`, s.assists * 3);

  if (s.minutes >= 60 && s.goalsConceded === 0 && CLEAN_SHEET_POINTS[s.position] > 0) {
    add("Clean sheet", CLEAN_SHEET_POINTS[s.position]);
  }
  if (s.position === "GK") {
    if (s.saves >= 3) add(`${s.saves} saves`, Math.floor(s.saves / 3));
    if (s.penaltiesSaved > 0) add(`${s.penaltiesSaved} pen saved`, s.penaltiesSaved * 5);
  }
  if ((s.position === "GK" || s.position === "DEF") && s.goalsConceded >= 2) {
    add(`${s.goalsConceded} conceded`, -Math.floor(s.goalsConceded / 2));
  }
  if (s.penaltiesMissed > 0) add(`${s.penaltiesMissed} pen missed`, -s.penaltiesMissed * 2);
  if (s.yellowCards > 0) add("Yellow card", -s.yellowCards * 1);
  if (s.redCards > 0) add("Red card", -s.redCards * 3);
  if (s.ownGoals > 0) add(`${s.ownGoals} own goal${s.ownGoals > 1 ? "s" : ""}`, -s.ownGoals * 2);

  return out;
}

/**
 * Fantasy points contributed by a single MATCH EVENT (for the events timeline).
 * A goal's value depends on the scorer's position; cards are flat. Returns null
 * for events that don't carry points (subs/VAR) or when position is unknown.
 */
export function eventPoints(
  type: string,
  detail: string,
  position: Position | null,
): number | null {
  const d = detail.toLowerCase();
  if (type === "Goal") {
    if (d.includes("own")) return -2; // own goal
    if (!position) return null;
    return GOAL_POINTS[position];
  }
  if (type === "Card") {
    if (d.includes("red")) return -3;
    if (d.includes("yellow")) return -1;
  }
  return null;
}

/**
 * Gameweek total for a squad: sum starting XI; each CAPTAIN scores ×2.
 * `captainIds` is the set of armband-wearers (1 normally; 2 with the Extra
 * Captain perk — both ×2). Accepts a single id, an array, or a Set.
 */
export function scoreSquadGameweek(
  starters: Array<{ playerId: string; points: number }>,
  captainIds: string | string[] | Set<string> | null,
  captainMultiplier = 2,
): number {
  const caps =
    captainIds == null
      ? new Set<string>()
      : captainIds instanceof Set
        ? captainIds
        : new Set(Array.isArray(captainIds) ? captainIds : [captainIds]);
  return starters.reduce((total, p) => {
    const mult = caps.has(p.playerId) ? captainMultiplier : 1;
    return total + p.points * mult;
  }, 0);
}

/**
 * Resolve which player wears the armband (FPL vice rule): the captain, UNLESS
 * the captain played 0 minutes this gameweek — then the vice takes the ×2.
 * `minutes[id]` is total minutes played in the gameweek (missing/0 = didn't play).
 * Returns null if neither played (no doubling applied).
 */
export function resolveCaptain(
  captainId: string | null,
  viceId: string | null,
  minutes: Record<string, number>,
): string | null {
  if (captainId && (minutes[captainId] ?? 0) > 0) return captainId;
  if (viceId && (minutes[viceId] ?? 0) > 0) return viceId;
  return captainId; // neither played → keep captain (×2 of 0 = 0 anyway)
}

/**
 * Resolve all armband-wearers for a gameweek (1 or 2 captains), applying the
 * vice rule ONLY to the primary captain: if the primary played 0 minutes the
 * vice takes its ×2. A second captain (Extra Captain perk) doubles on its own —
 * if it doesn't play, ×2 of 0 = 0, same as any starter. Returns a Set of ids.
 */
export function resolveCaptains(
  captainId: string | null,
  viceId: string | null,
  captain2Id: string | null,
  minutes: Record<string, number>,
): Set<string> {
  const out = new Set<string>();
  const primary = resolveCaptain(captainId, viceId, minutes);
  if (primary) out.add(primary);
  if (captain2Id) out.add(captain2Id);
  return out;
}
