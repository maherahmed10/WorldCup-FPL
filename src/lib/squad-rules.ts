// ─────────────────────────────────────────────────────────────────────────
// Squad model + validation rules (build-plan §2). PURE functions — no DB, no
// React, no globals — so they unit-test cleanly (see squad-rules.test.ts).
//
// FPL squad rules:
//   • 15 players: 2 GK, 5 DEF, 5 MID, 3 FWD
//   • Starting XI = 11 in a valid formation (1 GK; 3–5 DEF; 2–5 MID; 1–3 FWD)
//   • Budget: 100.0M total
//   • Max 3 players per country
//   • Captain scores ×2 (handled in scoring.ts)
// ─────────────────────────────────────────────────────────────────────────

export type Position = "GK" | "DEF" | "MID" | "FWD";

// A player as the squad rules need to see it. price is in TENTHS of a million
// to match the DB (Player.price: 130 = 13.0M). BUDGET below is in the same unit.
export interface SquadPlayer {
  id: string;
  position: Position;
  price: number; // tenths of a million
  country: string;
}

export const BUDGET = 1000; // 100.0M in tenths

// Required squad composition (the full 15).
export const SQUAD_QUOTA: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
export const SQUAD_SIZE = 15;
export const MAX_PER_COUNTRY = 3;

// Valid starting-XI formation bounds (the 11 on the pitch).
export const XI_SIZE = 11;
export const FORMATION_BOUNDS: Record<Position, [number, number]> = {
  GK: [1, 1],
  DEF: [3, 5],
  MID: [2, 5],
  FWD: [1, 3],
};

// Named formations the picker offers (must each sum to 10 outfielders + 1 GK).
export const FORMATIONS: Record<string, Record<Position, number>> = {
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  "3-4-3": { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  "5-3-2": { GK: 1, DEF: 5, MID: 3, FWD: 2 },
  "4-5-1": { GK: 1, DEF: 4, MID: 5, FWD: 1 },
};

export const totalPrice = (players: SquadPlayer[]): number =>
  players.reduce((sum, p) => sum + p.price, 0);

export function countByPosition(players: SquadPlayer[]): Record<Position, number> {
  const c: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) c[p.position]++;
  return c;
}

export function countByCountry(players: SquadPlayer[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const p of players) m[p.country] = (m[p.country] ?? 0) + 1;
  return m;
}

export interface ValidationError {
  type: "size" | "quota" | "budget" | "country";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  complete: boolean; // all 15 picked
  errors: ValidationError[];
  spent: number;
  remaining: number;
  total: number;
}

/** Validate a full 15-player squad against the FPL rules. */
export function validateSquad(
  players: SquadPlayer[],
  opts?: { maxPerCountry?: number },
): ValidationResult {
  const maxPerCountry = opts?.maxPerCountry ?? MAX_PER_COUNTRY;
  const errors: ValidationError[] = [];
  const total = players.length;
  const spent = totalPrice(players);
  const remaining = BUDGET - spent;

  // Budget
  if (spent > BUDGET) {
    errors.push({
      type: "budget",
      message: `Over budget by ${((spent - BUDGET) / 10).toFixed(1)}M — sell a player to continue.`,
    });
  }

  // Max per country (default 3, raised to 4 with country_slot perk)
  for (const [country, n] of Object.entries(countByCountry(players))) {
    if (n > maxPerCountry) {
      errors.push({
        type: "country",
        message: `Max ${maxPerCountry} players per country — you have ${n} from ${country}.`,
      });
    }
  }

  // Exact composition (only enforced once full, so partial squads aren't spammed)
  if (total === SQUAD_SIZE) {
    const byPos = countByPosition(players);
    for (const pos of ["GK", "DEF", "MID", "FWD"] as Position[]) {
      if (byPos[pos] !== SQUAD_QUOTA[pos]) {
        errors.push({
          type: "quota",
          message: `Need exactly ${SQUAD_QUOTA[pos]} ${pos} — you have ${byPos[pos]}.`,
        });
      }
    }
  } else {
    errors.push({
      type: "size",
      message: `Squad incomplete — fill all ${SQUAD_SIZE} slots (${total}/${SQUAD_SIZE} picked).`,
    });
  }

  return {
    valid: errors.length === 0,
    complete: total === SQUAD_SIZE,
    errors,
    spent,
    remaining,
    total,
  };
}

/** Is a starting XI a legal formation? (1 GK, bounds per line, 11 total.) */
export function isValidFormation(starters: SquadPlayer[]): boolean {
  if (starters.length !== XI_SIZE) return false;
  const byPos = countByPosition(starters);
  return (["GK", "DEF", "MID", "FWD"] as Position[]).every((pos) => {
    const [min, max] = FORMATION_BOUNDS[pos];
    return byPos[pos] >= min && byPos[pos] <= max;
  });
}

/**
 * Name of the formation a starting XI is in, or null if it doesn't match one of
 * the allowable named formations (FORMATIONS). Stricter than isValidFormation:
 * e.g. 5-4-1 satisfies the loose line bounds but is NOT an allowed formation, so
 * this returns null for it. This is what the picker enforces on swaps + save.
 */
export function formationName(starters: SquadPlayer[]): string | null {
  if (starters.length !== XI_SIZE) return null;
  const have = countByPosition(starters);
  return (
    Object.keys(FORMATIONS).find((name) => {
      const need = FORMATIONS[name];
      return (["GK", "DEF", "MID", "FWD"] as Position[]).every((p) => have[p] === need[p]);
    }) ?? null
  );
}

/** Is a starting XI one of the allowable named formations? */
export function isNamedFormation(starters: SquadPlayer[]): boolean {
  return formationName(starters) !== null;
}

/** Can we still add a player of this country without breaking the max-per-country rule? */
export function canAddCountry(
  players: SquadPlayer[],
  country: string,
  maxPerCountry = MAX_PER_COUNTRY,
): boolean {
  return (countByCountry(players)[country] ?? 0) < maxPerCountry;
}

/** Can we still add a player of this position without exceeding the quota? */
export function canAddPosition(players: SquadPlayer[], position: Position): boolean {
  return countByPosition(players)[position] < SQUAD_QUOTA[position];
}

// ───────────────────── starting XI / bench (FPL model) ─────────────────────
//
// The squad is a FIXED 15 (2/5/5/3). The formation only decides which 11 start.
// Changing formation never removes a player — it just moves players between the
// starting XI and the 4-man bench. These helpers derive that split.

/** Does the squad have enough players per line to field this formation? */
export function canFieldFormation(
  players: SquadPlayer[],
  formation: string,
): boolean {
  const need = FORMATIONS[formation];
  if (!need) return false;
  const have = countByPosition(players);
  return (["GK", "DEF", "MID", "FWD"] as Position[]).every((p) => have[p] >= need[p]);
}

export interface StartingSplit<T extends SquadPlayer = SquadPlayer> {
  starters: T[]; // 11
  bench: T[]; // 4 (GK first, then outfielders)
}

/**
 * Split a 15-player squad into starting XI + bench for a formation.
 * Picks the required count per line (caller decides ordering — here we keep the
 * given array order, so callers can pre-sort by who they want to start).
 * Returns null if the squad can't field the formation.
 */
export function splitStartingXI<T extends SquadPlayer>(
  players: T[],
  formation: string,
): StartingSplit<T> | null {
  const need = FORMATIONS[formation];
  if (!need || !canFieldFormation(players, formation)) return null;

  const byPos: Record<Position, T[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) byPos[p.position].push(p);

  const starters: T[] = [];
  const bench: T[] = [];
  (["GK", "DEF", "MID", "FWD"] as Position[]).forEach((pos) => {
    byPos[pos].forEach((p, i) => {
      if (i < need[pos]) starters.push(p);
      else bench.push(p);
    });
  });
  // Bench order: GK first (FPL convention), then the rest as collected.
  bench.sort((a, b) => (a.position === "GK" ? -1 : b.position === "GK" ? 1 : 0));
  return { starters, bench };
}

/** First formation this squad can legally field (for a sensible default). */
export function defaultFormationFor(players: SquadPlayer[]): string | null {
  return Object.keys(FORMATIONS).find((f) => canFieldFormation(players, f)) ?? null;
}

/**
 * Would swapping `benchPlayer` into the XI and `starterPlayer` out keep a valid
 * formation? (1 GK; 3–5 DEF; 2–5 MID; 1–3 FWD; 11 total.) Same-position swaps
 * always pass; cross-position swaps must not break the line bounds.
 */
export function canSwap(
  starters: SquadPlayer[],
  starterOut: SquadPlayer,
  benchIn: SquadPlayer,
): boolean {
  if (starterOut.position === benchIn.position) return true;
  const next = starters
    .filter((p) => p.id !== starterOut.id)
    .concat(benchIn);
  // A cross-position sub must land on one of the allowable named formations
  // (e.g. 4-3-3 → sub a FWD for a MID → 4-4-2). Shapes that only satisfy the
  // loose line bounds (e.g. 5-4-1) are rejected.
  if (next.length === XI_SIZE) return isNamedFormation(next);
  return isValidFormation(next);
}
