"use server";

// Server action: place a money bet. Validates the stake against the user's
// bettingBalance (stored on User, not derived from bets), then atomically
// deducts the stake and creates the Bet row in one transaction.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canPlaceBet, type MarketType } from "@/lib/betting";

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
  if (!user) return { ok: false, error: "You must be signed in to place a bet." };

  const balance = user.bettingBalance;
  if (!canPlaceBet(stake, balance)) {
    return { ok: false, error: `Stake must be between £1 and £${balance.toLocaleString("en-GB")}.` };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { bettingBalance: { decrement: stake } },
    });
    await tx.bet.create({
      data: {
        userId: user.id,
        gameweekId: fixture.gameweekId,
        fixtureId: fixture.id,
        marketType: input.marketType,
        selection: input.selection,
        stake,
        multiplier: input.multiplier,
      },
    });
  });

  revalidatePath("/predict");
  return { ok: true, balance: balance - stake };
}
