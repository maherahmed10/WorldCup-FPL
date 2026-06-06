"use server";

// Server action: place a points-only prediction. Validates the stake against
// the user's live balance SERVER-SIDE (never trust the client) and writes a Bet
// row. Settlement (post-match job) flips status OPEN → WON/LOST/VOID later.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { availableBalance, canPlaceBet, type BetLike, type MarketType } from "@/lib/betting";

export interface PlaceBetInput {
  fixtureId: string;
  marketType: MarketType;
  selection: string;
  multiplier: number;
  stake: number;
}

export type PlaceBetResult = { ok: true; balance: number } | { ok: false; error: string };

export async function placeBet(input: PlaceBetInput): Promise<PlaceBetResult> {
  const stake = Math.trunc(input.stake);

  const fixture = await db.fixture.findUnique({
    where: { id: input.fixtureId },
    select: { id: true, gameweekId: true, status: true, kickoff: true },
  });
  if (!fixture) return { ok: false, error: "Fixture not found." };
  if (fixture.status !== "SCHEDULED" || fixture.kickoff <= new Date()) {
    return { ok: false, error: "This match is locked — kickoff has passed." };
  }

  const user = await getCurrentUser();

  // Recompute the balance from the user's own bets — the client number is advisory.
  const existing = await db.bet.findMany({
    where: { userId: user.id },
    select: { stake: true, multiplier: true, status: true },
  });
  const balance = availableBalance(existing as BetLike[]);

  if (!canPlaceBet(stake, balance)) {
    return { ok: false, error: `Stake must be 1–${balance} points.` };
  }

  await db.bet.create({
    data: {
      userId: user.id,
      gameweekId: fixture.gameweekId,
      fixtureId: fixture.id,
      marketType: input.marketType,
      selection: input.selection,
      stake,
      multiplier: input.multiplier,
      // status defaults to OPEN, payout null until settlement.
    },
  });

  revalidatePath("/predict");
  return { ok: true, balance: balance - stake };
}
