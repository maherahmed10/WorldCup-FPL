// ─────────────────────────────────────────────────────────────────────────
// Post-group-stage bank merge. Once the group stage ends, each user's UNSPENT
// squad budget (e.g. £1M of the £100M) is credited into their betting bank, so
// the knockout-phase bank = leftover squad budget + £5M stipend ± betting P&L.
// Runs once per user (guarded by User.squadBudgetMerged).
//
// Units: squad prices/budget are in TENTHS of a million (BUDGET = 1000 = £100M);
// bettingBalance is in plain £. 1 tenth = £0.1M = £100,000.
// ─────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { BUDGET, totalPrice, type SquadPlayer } from "@/lib/squad-rules";

const TENTH_TO_POUNDS = 100_000; // 1 tenth of a million

/** Has the group stage finished? True once any knockout gameweek exists/has started. */
export async function groupStageOver(): Promise<boolean> {
  const firstKnockout = await db.gameweek.findFirst({
    where: { isKnockout: true },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });
  if (!firstKnockout) return false;
  return firstKnockout.startsAt <= new Date();
}

// ─────────────────────────────────────────────────────────────────────────
// Knockout economy — ONE POOL. From the knockouts on, a manager's money is a
// single pot: spend it on players, and whatever's left is their betting bank.
//   • bettingBalance (£) = the bank — what you have NOT spent on the 15. This is
//     the real wallet: bets deduct it, payouts credit it. The post-group merge
//     (mergeSquadBudgetsToBank) folds leftover group-stage squad budget into it,
//     so by the knockouts it holds the stipend + P&L + leftover budget.
//   • Squad budget CAP (tenths) = currentSquadSpent + bettingBalance(in tenths).
//     i.e. you may spend your whole bank on players. Buy a pricier player → the
//     delta comes out of the bank; sell → it goes back. Squad cost is a REAL
//     spend in the knockouts, not just a constraint (that's the transfer action).
//
// In the GROUP STAGE the two stay separate: a flat £100M squad cap, and the
// bank is the £5M stipend. knockoutFunds() reflects that (isKnockout=false).
// ─────────────────────────────────────────────────────────────────────────

/** £ → tenths-of-a-million, floored (1 tenth = £100k). */
export const poundsToTenths = (pounds: number): number => Math.floor(pounds / TENTH_TO_POUNDS);
/** tenths-of-a-million → £. */
export const tenthsToPounds = (tenths: number): number => tenths * TENTH_TO_POUNDS;

export interface KnockoutFunds {
  isKnockout: boolean;
  /** Squad spend cap in tenths of a million. */
  squadCapTenths: number;
  /** Betting bank in £ (the real wallet). */
  bankPounds: number;
  /** Current squad spend in tenths (0 if no squad). */
  squadSpentTenths: number;
}

/**
 * The single source of truth for a manager's spendable money.
 *
 * GROUP STAGE: squad cap = £100M (+ legacy bonus), bank = bettingBalance — separate.
 * KNOCKOUTS:   squad cap = squadSpent + bank — one pool. Buying players eats the
 *              bank; the bank IS what's left to bet.
 */
export function knockoutFunds(opts: {
  isKnockout: boolean;
  bettingBalance: number; // £
  squadSpentTenths: number; // tenths
  squadBudgetBonus?: number; // tenths (legacy group-stage bonus only)
}): KnockoutFunds {
  const { isKnockout, bettingBalance, squadSpentTenths } = opts;
  if (!isKnockout) {
    return {
      isKnockout: false,
      squadCapTenths: BUDGET + (opts.squadBudgetBonus ?? 0),
      bankPounds: bettingBalance,
      squadSpentTenths,
    };
  }
  // One pool: the cap is whatever you've already committed to players PLUS your
  // whole remaining bank, so you can spend it all on the squad if you want.
  return {
    isKnockout: true,
    squadCapTenths: squadSpentTenths + poundsToTenths(bettingBalance),
    bankPounds: bettingBalance,
    squadSpentTenths,
  };
}

/** Sum a loaded squad's prices to tenths (helper for callers). */
export function squadSpendTenths(
  players: Array<Pick<SquadPlayer, "id" | "position" | "price" | "country">>,
): number {
  return totalPrice(players);
}

export interface MergeResult {
  merged: number; // users credited
  totalCredited: number; // £ credited across all users
}

/**
 * Credit every un-merged user's leftover squad budget into their betting bank.
 * Idempotent: skips users already merged. Uses each user's MOST RECENT squad
 * (the one carried into the knockouts) to compute spend, honouring any
 * squadBudgetBonus they'd converted the other way.
 */
export async function mergeSquadBudgetsToBank(): Promise<MergeResult> {
  const users = await db.user.findMany({
    where: { squadBudgetMerged: false },
    select: { id: true },
  });

  let merged = 0;
  let totalCredited = 0;
  for (const u of users) {
    const credited = await mergeOneUserBudget(u.id);
    if (credited !== null) {
      merged++;
      totalCredited += credited;
    }
  }
  return { merged, totalCredited };
}

/**
 * Merge ONE user's leftover squad budget into their bank, once. Returns the £
 * credited, or null if the user was already merged (no-op). Used both by the
 * batch job and the LAZY trigger on first knockout page load, so the simulator
 * flow "just works" without a separate cron. Idempotent via squadBudgetMerged.
 */
export async function mergeOneUserBudget(userId: string): Promise<number | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { squadBudgetMerged: true, squadBudgetBonus: true },
  });
  if (!u || u.squadBudgetMerged) return null;

  const squad = await db.squad.findFirst({
    where: { userId },
    orderBy: { gameweek: { startsAt: "desc" } },
    include: { players: { include: { player: { include: { team: true } } } } },
  });

  // No squad → nothing spent; still mark merged so the stipend stands alone.
  let leftoverPounds = 0;
  if (squad) {
    const spent = totalPrice(
      squad.players.map((sp) => ({
        id: sp.playerId,
        position: sp.player.position as "GK" | "DEF" | "MID" | "FWD",
        price: sp.player.price,
        country: sp.player.team.country,
      })),
    );
    const effectiveBudget = BUDGET + u.squadBudgetBonus; // tenths
    const leftoverTenths = Math.max(0, effectiveBudget - spent);
    leftoverPounds = leftoverTenths * TENTH_TO_POUNDS;
  }

  // Guard the one-time credit on squadBudgetMerged so a race can't double-credit.
  const res = await db.user.updateMany({
    where: { id: userId, squadBudgetMerged: false },
    data: {
      bettingBalance: { increment: leftoverPounds },
      squadBudgetMerged: true,
    },
  });
  return res.count > 0 ? leftoverPounds : null;
}

/**
 * Lazy trigger: if the group stage is over, ensure THIS user's budget has been
 * merged into their bank. Safe to call on every knockout page load (a no-op once
 * merged). Returns true if it just merged (caller may want to surface a notice).
 */
export async function ensureKnockoutBudgetMerged(userId: string): Promise<boolean> {
  if (!(await groupStageOver())) return false;
  const credited = await mergeOneUserBudget(userId);
  return credited !== null;
}
