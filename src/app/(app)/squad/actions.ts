"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getCurrentGameweek } from "@/lib/squad-data";
import {
  validateSquad,
  formationName,
  XI_SIZE,
  type Position,
  type SquadPlayer,
} from "@/lib/squad-rules";

export interface SavePayload {
  starterIds: string[]; // 11 starting player ids
  benchIds: string[]; // 4 bench player ids
  captainId: string | null;
}

export async function saveSquad(payload: SavePayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gameweek = await getCurrentGameweek();
  if (!gameweek) return { ok: false, error: "No active gameweek." };

  const allIds = [...payload.starterIds, ...payload.benchIds];
  if (new Set(allIds).size !== allIds.length) {
    return { ok: false, error: "Duplicate player in squad." };
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

  const result = validateSquad(asRules, { budgetBonus: dbUser?.squadBudgetBonus ?? 0 });
  if (!result.valid) {
    return { ok: false, error: result.errors[0]?.message ?? "Invalid squad." };
  }

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
  if (payload.captainId && !allIds.includes(payload.captainId)) {
    return { ok: false, error: "Captain must be in the squad." };
  }

  const starters = new Set(payload.starterIds);

  // Upsert the squad for this user+gameweek, replacing its players.
  const existing = await db.squad.findUnique({
    where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
  });

  if (existing) {
    await db.squadPlayer.deleteMany({ where: { squadId: existing.id } });
    await db.squad.update({
      where: { id: existing.id },
      data: {
        captainId: payload.captainId,
        players: {
          create: allIds.map((id) => ({ playerId: id, isStarting: starters.has(id) })),
        },
      },
    });
  } else {
    await db.squad.create({
      data: {
        userId: user.id,
        gameweekId: gameweek.id,
        captainId: payload.captainId,
        players: {
          create: allIds.map((id) => ({ playerId: id, isStarting: starters.has(id) })),
        },
      },
    });
  }

  revalidatePath("/team");
  return { ok: true };
}

// Convert betting bank balance into squad budget bonus.
// Conversion: £100,000 betting = 1 tenth = 0.1M squad budget.
// Only available once the active gameweek is a knockout round.
export async function allocateBankToSquad(
  amountGBP: number, // whole £ amount the user wants to convert
): Promise<{ ok: true; addedTenths: number } | { ok: false; error: string }> {
  if (!Number.isInteger(amountGBP) || amountGBP < 100_000)
    return { ok: false, error: "Minimum conversion is £100,000." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const gameweek = await getCurrentGameweek();
  if (!gameweek?.isKnockout)
    return { ok: false, error: "Bank-to-squad conversion unlocks after the group stage." };

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { bettingBalance: true },
  });
  if (!dbUser) return { ok: false, error: "User not found." };
  if (amountGBP > dbUser.bettingBalance)
    return { ok: false, error: `Insufficient balance (have £${dbUser.bettingBalance.toLocaleString("en-GB")}).` };

  // Round down to nearest £100,000 so we never end up with fractional tenths.
  const tenths = Math.floor(amountGBP / 100_000);
  const actualDeduct = tenths * 100_000;

  await db.user.update({
    where: { id: user.id },
    data: {
      bettingBalance: { decrement: actualDeduct },
      squadBudgetBonus: { increment: tenths },
    },
  });

  revalidatePath("/squad");
  revalidatePath("/predict");
  return { ok: true, addedTenths: tenths };
}
