// ─────────────────────────────────────────────────────────────────────────
// Betting / predictions core (build-plan §7). Pure functions — no DB, no API —
// so the money-math is provably correct before any UI or settlement is wired.
//
// Points-only economy. Two market families:
//   • Match-level  (1X2 / over-under / BTTS)  — placeholder odds for the MVP;
//     real pricing from /odds wires in later.
//   • Player-level (anytime scorer / assist / card) — OUR OWN markets with
//     FIXED multipliers (§7: "our own markets with fixed point values").
//
// payout = round(stake × multiplier) when the bet WINS, else 0. A VOID bet
// returns the stake. The stake-budget size is a tunable dial (§12) — change
// STARTING_BALANCE; nothing else depends on the number.
// ─────────────────────────────────────────────────────────────────────────

// Mirrors the Prisma enums (kept as string unions so this file has no DB import
// and stays trivially testable).
export type BetStatus = "OPEN" | "WON" | "LOST" | "VOID";
export type MarketType =
  | "MATCH_RESULT"
  | "OVER_UNDER"
  | "BTTS"
  | "CORRECT_SCORE"
  | "PLAYER_SCORER"
  | "PLAYER_ASSIST"
  | "PLAYER_CARD";

/** Per-gameweek points wallet. Tunable (§12) — the only place the number lives. */
export const STARTING_BALANCE = 1000;

/** Smallest legal stake. */
export const MIN_STAKE = 1;

/**
 * Fixed multipliers for OUR player-prop markets (§7). The API's World Cup
 * player-prop odds are unreliable, so we price these ourselves.
 */
export const PLAYER_PROP_MULTIPLIER: Record<
  "PLAYER_SCORER" | "PLAYER_ASSIST" | "PLAYER_CARD",
  number
> = {
  PLAYER_SCORER: 3.0,
  PLAYER_ASSIST: 4.0,
  PLAYER_CARD: 3.5,
};

/** A single placed/settled bet, reduced to just what the math needs. */
export interface BetLike {
  stake: number;
  multiplier: number;
  status: BetStatus;
}

/** Potential return shown in the bet slip before settlement: stake × multiplier. */
export function potentialReturn(stake: number, multiplier: number): number {
  return Math.round(stake * multiplier);
}

/**
 * Settled payout credited back to the wallet:
 *   WON  → round(stake × multiplier)
 *   VOID → stake (refund)
 *   LOST / OPEN → 0
 */
export function payout(stake: number, multiplier: number, status: BetStatus): number {
  if (status === "WON") return Math.round(stake * multiplier);
  if (status === "VOID") return stake; // refund
  return 0;
}

/**
 * Wallet balance after a set of bets. Every stake is deducted when the bet is
 * placed; settlement credits the payout back. So:
 *   balance = starting − Σ stakes + Σ payouts
 * OPEN bets keep their stake locked (payout 0); WON bets net a profit; VOID
 * bets wash out (stake refunded).
 */
export function availableBalance(bets: BetLike[], starting = STARTING_BALANCE): number {
  return bets.reduce(
    (bal, b) => bal - b.stake + payout(b.stake, b.multiplier, b.status),
    starting,
  );
}

/** A stake is legal iff it's a whole number ≥ MIN_STAKE and ≤ the balance. */
export function canPlaceBet(stake: number, balance: number): boolean {
  return Number.isInteger(stake) && stake >= MIN_STAKE && stake <= balance;
}

// ───────────────────────── Market shaping ─────────────────────────

export interface MarketOption {
  /** Human label, e.g. "England", "Over 2.5", "Yes". */
  name: string;
  /** Stored verbatim on Bet.selection — stable, settlement-friendly key. */
  selection: string;
  multiplier: number;
}

export interface MarketGroup {
  marketType: MarketType;
  label: string;
  options: MarketOption[];
}

/**
 * The three standard match-level market groups with PLACEHOLDER odds (MVP).
 * Real per-fixture pricing from /odds replaces the constants later; the shape
 * (selection keys + multipliers) is what settlement reads.
 */
export function matchMarkets(homeName: string, awayName: string): MarketGroup[] {
  return [
    {
      marketType: "MATCH_RESULT",
      label: "Match Result",
      options: [
        { name: homeName, selection: "HOME", multiplier: 2.1 },
        { name: "Draw", selection: "DRAW", multiplier: 3.3 },
        { name: awayName, selection: "AWAY", multiplier: 3.0 },
      ],
    },
    {
      marketType: "OVER_UNDER",
      label: "Over / Under 2.5 Goals",
      options: [
        { name: "Over 2.5", selection: "OVER_2.5", multiplier: 1.9 },
        { name: "Under 2.5", selection: "UNDER_2.5", multiplier: 1.9 },
      ],
    },
    {
      marketType: "BTTS",
      label: "Both Teams To Score",
      options: [
        { name: "Yes", selection: "BTTS_YES", multiplier: 2.0 },
        { name: "No", selection: "BTTS_NO", multiplier: 1.75 },
      ],
    },
  ];
}
