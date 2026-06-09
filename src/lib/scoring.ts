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

/**
 * Gameweek total for a squad: sum starting XI, captain scores ×captainMultiplier.
 * captainMultiplier defaults to 2; pass 3 when the user has the extra_captain perk.
 */
export function scoreSquadGameweek(
  starters: Array<{ playerId: string; points: number }>,
  captainId: string | null,
  captainMultiplier = 2,
): number {
  return starters.reduce((total, p) => {
    const mult = p.playerId === captainId ? captainMultiplier : 1;
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
