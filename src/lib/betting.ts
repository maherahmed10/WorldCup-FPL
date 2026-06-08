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

/** @deprecated Use User.bettingBalance from the DB — kept for legacy tests only. */
export const STARTING_BALANCE = 1000;

/** Starting virtual £ bank credited to each new user. Matches User.bettingBalance DB default. */
export const STARTING_MONEY = 1000;

/** Format a money amount as a £ string with thousands separator, e.g. 10000 → "£10,000". */
export function formatMoney(amount: number): string {
  return `£${amount.toLocaleString("en-GB")}`;
}

/** Smallest legal stake. */
export const MIN_STAKE = 1;

/**
 * Fixed multipliers for OUR player-prop markets (§7). The API's World Cup
 * player-prop odds are unreliable/sparse, so we price these ourselves.
 * Used as fallbacks; PLAYER_SCORER is derived per-player (see scorerMultiplier).
 */
export const PLAYER_PROP_MULTIPLIER: Record<
  "PLAYER_SCORER" | "PLAYER_ASSIST" | "PLAYER_CARD",
  number
> = {
  PLAYER_SCORER: 3.0,
  PLAYER_ASSIST: 4.0,
  PLAYER_CARD: 3.5,
};

/**
 * Anytime-scorer multiplier, derived from position + price (our own market — the
 * API's player props are unreliable). A premium forward is likeliest to score so
 * pays the least; a cheap midfielder pays the most. price is in TENTHS of a
 * million (matches Player.price; 130 = 13.0M). Returns a decimal odds value
 * rounded to 2dp, clamped to a sensible [1.6, 8.0] band.
 */
export function scorerMultiplier(
  position: "GK" | "DEF" | "MID" | "FWD",
  price: number,
): number {
  // Base by position: forwards score most, then mids, defs rarely, GKs ~never.
  const base: Record<string, number> = { FWD: 2.6, MID: 4.0, DEF: 7.0, GK: 8.0 };
  // Price adjustment: every 1.0M above 5.0M shaves the odds (more likely). The
  // 0.16 factor gives a ~£13m striker ≈ 2.6 − 8×0.16 ≈ 1.7; a £4.5m mid ≈ 4.0.
  const priceM = price / 10;
  const adj = (priceM - 5) * 0.16;
  const raw = (base[position] ?? 5.0) - adj;
  const clamped = Math.min(8.0, Math.max(1.6, raw));
  return Math.round(clamped * 100) / 100;
}

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

// Placeholder odds, used only when the real /odds feed has nothing for a
// fixture (e.g. outside the 7-day window). Keyed by selection.
const PLACEHOLDER_ODDS: Record<string, number> = {
  HOME: 2.1, DRAW: 3.3, AWAY: 3.0,
  "OVER_2.5": 1.9, "UNDER_2.5": 1.9,
  BTTS_YES: 2.0, BTTS_NO: 1.75,
};

/**
 * The three standard match-level market groups.
 * Pass `odds` (selection → decimal multiplier, from FixtureOdds) for REAL
 * per-fixture pricing; any missing selection falls back to a sane placeholder.
 * Call with no odds for the pure-placeholder shape (used by tests).
 */
export function matchMarkets(
  homeName: string,
  awayName: string,
  odds?: Record<string, number>,
): MarketGroup[] {
  const m = (selection: string) =>
    odds?.[selection] ?? PLACEHOLDER_ODDS[selection];
  return [
    {
      marketType: "MATCH_RESULT",
      label: "Match Result",
      options: [
        { name: homeName, selection: "HOME", multiplier: m("HOME") },
        { name: "Draw", selection: "DRAW", multiplier: m("DRAW") },
        { name: awayName, selection: "AWAY", multiplier: m("AWAY") },
      ],
    },
    {
      marketType: "OVER_UNDER",
      label: "Over / Under 2.5 Goals",
      options: [
        { name: "Over 2.5", selection: "OVER_2.5", multiplier: m("OVER_2.5") },
        { name: "Under 2.5", selection: "UNDER_2.5", multiplier: m("UNDER_2.5") },
      ],
    },
    {
      marketType: "BTTS",
      label: "Both Teams To Score",
      options: [
        { name: "Yes", selection: "BTTS_YES", multiplier: m("BTTS_YES") },
        { name: "No", selection: "BTTS_NO", multiplier: m("BTTS_NO") },
      ],
    },
  ];
}

// ───────────────────────── Settlement (post-match) ─────────────────────────
//
// Pure resolution of a bet's selection against the final match facts. The job
// (src/jobs/settle.ts) gathers these facts from our DB and calls this; keeping
// it pure means every market's win/lose rule is unit-tested with no DB.
//
// Two layers:
//   • settleBetSelection() — MATCH-level markets (1X2 / OU / BTTS) + the simple
//     scorer check, from the final score + scorer set.
//   • settlePlayerProp()   — PLAYER props (scorer / assist / card) from a single
//     player's match stat, with VOID when the player didn't feature (ROADMAP 3.4).

/** The facts a finished fixture provides, enough to settle match markets. */
export interface MatchResult {
  homeScore: number;
  awayScore: number;
  /** Player ids (Player.id) who scored at least one goal in the match. */
  scorerIds: Set<string>;
}

/**
 * Resolve one MATCH-level bet selection to a settled status.
 *   - Match/OU/BTTS: decided by the score.
 *   - "scorer:<playerId>": WON if that player is in scorerIds.
 * Returns VOID for selections we can't interpret (refunds the stake — safer than
 * wrongly losing a user's money).
 */
export function settleBetSelection(selection: string, r: MatchResult): BetStatus {
  // Player-prop: anytime goalscorer.
  if (selection.startsWith("scorer:")) {
    const playerId = selection.slice("scorer:".length);
    return r.scorerIds.has(playerId) ? "WON" : "LOST";
  }

  const totalGoals = r.homeScore + r.awayScore;
  const bothScored = r.homeScore > 0 && r.awayScore > 0;
  const homeWin = r.homeScore > r.awayScore;
  const awayWin = r.awayScore > r.homeScore;
  const draw = r.homeScore === r.awayScore;

  switch (selection) {
    case "HOME":
      return homeWin ? "WON" : "LOST";
    case "AWAY":
      return awayWin ? "WON" : "LOST";
    case "DRAW":
      return draw ? "WON" : "LOST";
    case "OVER_2.5":
      return totalGoals > 2.5 ? "WON" : "LOST";
    case "UNDER_2.5":
      return totalGoals < 2.5 ? "WON" : "LOST";
    case "BTTS_YES":
      return bothScored ? "WON" : "LOST";
    case "BTTS_NO":
      return bothScored ? "LOST" : "WON";
    default:
      return "VOID"; // unknown market → refund the stake
  }
}

// ── Player props (scorer / assist / card) — ROADMAP 3.4 ──
// Stored as `Bet.selection = "<kind>:<playerId>"`. They settle from the player's
// PlayerMatchStat for the fixture — the same feed that settles fantasy points.

export type PlayerPropKind = "scorer" | "assist" | "card";

/** The slice of a player's match stat a prop needs. */
export interface PlayerPropStat {
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

/** Parse a player-prop selection ("scorer:abc123") → {kind, playerId}, or null. */
export function parsePlayerProp(
  selection: string,
): { kind: PlayerPropKind; playerId: string } | null {
  const [kind, playerId] = selection.split(":");
  if (playerId && (kind === "scorer" || kind === "assist" || kind === "card")) {
    return { kind, playerId };
  }
  return null;
}

/**
 * Settle a player-prop bet from the player's match stat.
 *   • didn't feature (no stat row, or 0 minutes) → VOID (stake refunded)
 *   • scorer → WON if goals > 0
 *   • assist → WON if assists > 0
 *   • card   → WON if any yellow or red
 * else LOST.
 */
export function settlePlayerProp(
  kind: PlayerPropKind,
  stat: PlayerPropStat | null,
): BetStatus {
  if (!stat || stat.minutes <= 0) return "VOID";
  switch (kind) {
    case "scorer":
      return stat.goals > 0 ? "WON" : "LOST";
    case "assist":
      return stat.assists > 0 ? "WON" : "LOST";
    case "card":
      return stat.yellowCards > 0 || stat.redCards > 0 ? "WON" : "LOST";
    default:
      return "VOID";
  }
}
