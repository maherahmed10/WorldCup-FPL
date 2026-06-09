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
import { BUDGET, totalPrice } from "@/lib/squad-rules";

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
    select: { id: true, squadBudgetBonus: true },
  });

  let merged = 0;
  let totalCredited = 0;
  for (const u of users) {
    const squad = await db.squad.findFirst({
      where: { userId: u.id },
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

    await db.user.update({
      where: { id: u.id },
      data: {
        bettingBalance: { increment: leftoverPounds },
        squadBudgetMerged: true,
      },
    });
    merged++;
    totalCredited += leftoverPounds;
  }
  return { merged, totalCredited };
}
