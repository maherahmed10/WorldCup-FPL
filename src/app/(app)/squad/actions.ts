"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  getUpcomingDeadlineGameweek,
  getMostRecentSquad,
  getKnockoutTransferAllowance,
} from "@/lib/squad-data";
import {
  validateSquad,
  formationName,
  totalPrice,
  BUDGET,
  XI_SIZE,
  type Position,
  type SquadPlayer,
} from "@/lib/squad-rules";
import {
  ensureKnockoutBudgetMerged,
  poundsToTenths,
  tenthsToPounds,
} from "@/lib/budget-merge";

export interface SavePayload {
  starterIds: string[]; // 11 starting player ids
  benchIds: string[]; // 4 bench player ids
  captainId: string | null;
  viceId: string | null;
}

export async function saveSquad(payload: SavePayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Save targets the NEXT-deadline gameweek (the editable one), so editing after
  // MD1's deadline writes the MD2 row and leaves the locked MD1 untouched.
  const gameweek = await getUpcomingDeadlineGameweek();
  if (!gameweek) return { ok: false, error: "No active gameweek." };

  const allIds = [...payload.starterIds, ...payload.benchIds];
  if (new Set(allIds).size !== allIds.length) {
    return { ok: false, error: "Duplicate player in squad." };
  }

  // The 15 are LOCKED in the group stage whenever a prior squad exists (only the
  // first-ever pick is unlocked). In KNOCKOUT rounds, changes to the 15 ARE
  // allowed — they're transfers, applied right here (limit + bank delta below).
  // Always re-derived server-side, never trusting the client.
  const prior = await getMostRecentSquad(user.id);
  const lockRoster = prior != null;
  const priorIds = new Set(prior?.squad.players.map((p) => p.id) ?? []);
  const incomingIds = lockRoster ? allIds.filter((id) => !priorIds.has(id)) : [];
  const rosterChanged = incomingIds.length > 0;
  if (lockRoster && rosterChanged && !gameweek.isKnockout) {
    return {
      ok: false,
      error: "Your 15 are locked until the knockouts — transfers open each knockout round.",
    };
  }

  // Load the picked players from the DB to validate against real prices/countries.
  const [players, dbUser] = await Promise.all([
    db.player.findMany({ where: { id: { in: allIds } }, include: { team: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { squadBudgetBonus: true } }),
  ]);
  if (players.length !== allIds.length) {
    return { ok: false, error: "Unknown player in squad." };
  }

  const asRules: SquadPlayer[] = players.map((p) => ({
    id: p.id,
    position: p.position as Position,
    price: p.price,
    country: p.team.country,
  }));

  // ── Knockout transfers: limit + money (one pool) ──
  // A changed 15 in a knockout round is a set of transfers. Enforce the carry-over
  // limit (3 per knockout round reached, UNUSED roll forward, + unused Extra
  // Transfer perks) and move the price delta in/out of the betting bank — money
  // you made from betting can strengthen your squad.
  let deltaPounds = 0;
  let transferTxn: { perkIds: string[]; incomingCount: number } | null = null;
  if (rosterChanged && gameweek.isKnockout && prior) {
    await ensureKnockoutBudgetMerged(user.id);

    const [perks, allowance, bankUser] = await Promise.all([
      db.userPerk.findMany({
        where: { userId: user.id, storeItemId: "perk_extra_transfer", usedAt: null },
        select: { id: true },
      }),
      getKnockoutTransferAllowance(user.id, gameweek),
      db.user.findUnique({ where: { id: user.id }, select: { bettingBalance: true } }),
    ]);

    const used = allowance.used;
    const limit = allowance.limit; // includes carried-over base + unused perks
    if (used + incomingIds.length > limit) {
      const left = Math.max(0, limit - used);
      return {
        ok: false,
        error: `Transfer limit exceeded — you have ${left} transfer${left === 1 ? "" : "s"} left.`,
      };
    }

    // Price delta: cost of players coming in minus players going out.
    const newIdSet = new Set(allIds);
    const outgoing = prior.squad.players.filter((p) => !newIdSet.has(p.id));
    const inTenths = asRules.filter((p) => incomingIds.includes(p.id)).reduce((s, p) => s + p.price, 0);
    const outTenths = totalPrice(outgoing);
    deltaPounds = tenthsToPounds(inTenths - outTenths);

    const bank = bankUser?.bettingBalance ?? 0;
    if (deltaPounds > bank) {
      return {
        ok: false,
        error: `Not enough money — that change costs £${((inTenths - outTenths) / 10).toFixed(1)}M more but you only have £${(poundsToTenths(bank) / 10).toFixed(1)}M from betting.`,
      };
    }

    // Full-squad validation with the one-pool cap (current spend + bank).
    const priorSpent = totalPrice(prior.squad.players);
    const dynamicBonus = Math.max(0, priorSpent + poundsToTenths(bank) - BUDGET);
    const result = validateSquad(asRules, { budgetBonus: dynamicBonus });
    if (!result.valid) {
      return { ok: false, error: result.errors[0]?.message ?? "Invalid squad." };
    }

    // Consume Extra Transfer perks only once the carried-over BASE allowance is
    // spent. base = limit − perks (the rolled-over 3-per-round pool); the part of
    // this save's transfers beyond what the base still covers eats perks.
    const baseLimit = Math.max(0, limit - perks.length);
    const baseRemaining = Math.max(0, baseLimit - used);
    const extraNeeded = Math.max(0, incomingIds.length - baseRemaining);
    transferTxn = { perkIds: perks.slice(0, extraNeeded).map((p) => p.id), incomingCount: incomingIds.length };
  } else if (!lockRoster) {
    // First-ever pick: flat £100M budget (+ any legacy bonus).
    const result = validateSquad(asRules, { budgetBonus: dbUser?.squadBudgetBonus ?? 0 });
    if (!result.valid) {
      return { ok: false, error: result.errors[0]?.message ?? "Invalid squad." };
    }
  }
  // (Unchanged locked edit: 15 already validated — only XI/captain/vice below.)

  // Starting XI must be 11 + a 4-man bench, in an allowable named formation.
  if (payload.starterIds.length !== XI_SIZE || payload.benchIds.length !== 4) {
    return { ok: false, error: "Pick 11 starters and 4 substitutes." };
  }
  const byId = new Map(asRules.map((p) => [p.id, p]));
  const starterRules = payload.starterIds
    .map((id) => byId.get(id))
    .filter((p): p is SquadPlayer => !!p);
  if (!formationName(starterRules)) {
    return { ok: false, error: "Your starting 11 isn't an allowed formation." };
  }
  // Captain + vice are REQUIRED, must be in the starting XI, and must differ.
  const { captainId, viceId } = payload;
  const starters = new Set(payload.starterIds);
  if (!captainId || !viceId) {
    return { ok: false, error: "Pick a captain and a vice-captain before saving." };
  }
  if (!starters.has(captainId)) return { ok: false, error: "Captain must be in your starting 11." };
  if (!starters.has(viceId)) return { ok: false, error: "Vice-captain must be in your starting 11." };
  if (captainId === viceId) return { ok: false, error: "Captain and vice-captain must be different players." };

  // Upsert the squad for this user+gameweek, replacing its players. One
  // transaction with the transfer money/perk effects so a failure can't charge
  // the bank without saving the team (or vice versa).
  await db.$transaction(async (tx) => {
    if (transferTxn) {
      // One pool: the transfer's price delta moves in/out of the betting bank.
      if (deltaPounds !== 0) {
        await tx.user.update({
          where: { id: user.id },
          data: { bettingBalance: { decrement: deltaPounds } },
        });
      }
      if (transferTxn.perkIds.length > 0) {
        await tx.userPerk.updateMany({
          where: { id: { in: transferTxn.perkIds } },
          data: { usedAt: new Date() },
        });
      }
    }

    const existing = await tx.squad.findUnique({
      where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
    });

    if (existing) {
      await tx.squadPlayer.deleteMany({ where: { squadId: existing.id } });
      await tx.squad.update({
        where: { id: existing.id },
        data: {
          captainId, // keep the initial captain on the squad too
          ...(transferTxn ? { transfersUsed: { increment: transferTxn.incomingCount } } : {}),
          players: {
            create: allIds.map((id) => ({ playerId: id, isStarting: starters.has(id) })),
          },
        },
      });
    } else {
      await tx.squad.create({
        data: {
          userId: user.id,
          gameweekId: gameweek.id,
          captainId,
          transfersUsed: transferTxn?.incomingCount ?? 0,
          players: {
            create: allIds.map((id) => ({ playerId: id, isStarting: starters.has(id) })),
          },
        },
      });
    }

    // The per-gameweek captain + vice (this is what settlement reads).
    await tx.gameweekPick.upsert({
      where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
      update: { captainId, viceId },
      create: { userId: user.id, gameweekId: gameweek.id, captainId, viceId },
    });
  });

  revalidatePath("/team");
  revalidatePath("/squad");
  revalidatePath("/predict"); // bank may have changed (knockout transfer delta)
  return { ok: true };
}
