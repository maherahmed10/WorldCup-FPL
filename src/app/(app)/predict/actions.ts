"use server";

// Server action: place a money bet. Validates the stake against the user's
// bettingBalance (stored on User, not derived from bets), then atomically
// deducts the stake and creates the Bet row in one transaction.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canPlaceBet, MIN_STAKE, type MarketType } from "@/lib/betting";

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

// ── Parlay (accumulator) + Singles placement ──

export interface SlipLegInput {
  fixtureId: string;
  marketType: MarketType;
  selection: string;
  pick: string; // human label
  multiplier: number;
}

type FixtureLite = { id: string; gameweekId: string; status: string; kickoff: Date };
type LoadResult =
  | { error: string; byId?: undefined }
  | { error?: undefined; byId: Map<string, FixtureLite> };

/** Validate the legs are real, open fixtures; return them with gameweekIds. */
async function loadOpenLegs(legs: SlipLegInput[]): Promise<LoadResult> {
  const ids = [...new Set(legs.map((l) => l.fixtureId))];
  const fixtures = await db.fixture.findMany({
    where: { id: { in: ids } },
    select: { id: true, gameweekId: true, status: true, kickoff: true },
  });
  const byId = new Map(fixtures.map((f) => [f.id, f as FixtureLite]));
  const now = new Date();
  for (const leg of legs) {
    const f = byId.get(leg.fixtureId);
    if (!f) return { error: "A selection's match no longer exists." };
    if (f.status !== "SCHEDULED" || f.kickoff <= now) {
      return { error: "A selection is locked — its kickoff has passed." };
    }
  }
  return { byId };
}

/** Place a single accumulator bet — all legs must win. payout = stake × combo. */
export async function placeParlay(
  legs: SlipLegInput[],
  stakeInput: number,
): Promise<PlaceBetResult> {
  const stake = Math.trunc(stakeInput);
  if (legs.length < 2) return { ok: false, error: "A parlay needs at least 2 selections." };

  const loaded = await loadOpenLegs(legs);
  if (loaded.error) return { ok: false, error: loaded.error };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to place a bet." };
  if (!canPlaceBet(stake, user.bettingBalance)) {
    return { ok: false, error: `Stake must be between £1 and £${user.bettingBalance.toLocaleString("en-GB")}.` };
  }

  const combo = legs.reduce((p, l) => p * l.multiplier, 1);

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { bettingBalance: { decrement: stake } } });
    await tx.parlay.create({
      data: {
        userId: user.id,
        stake,
        multiplier: combo,
        legs: {
          create: legs.map((l) => ({
            fixtureId: l.fixtureId,
            marketType: l.marketType,
            selection: l.selection,
            pick: l.pick,
            multiplier: l.multiplier,
          })),
        },
      },
    });
  });

  revalidatePath("/predict");
  return { ok: true, balance: user.bettingBalance - stake };
}

/** Place each leg as its own single bet — stake applied per leg. */
export async function placeSingles(
  legs: SlipLegInput[],
  stakeEachInput: number,
): Promise<PlaceBetResult> {
  const stakeEach = Math.trunc(stakeEachInput);
  if (legs.length === 0) return { ok: false, error: "No selections to place." };

  const loaded = await loadOpenLegs(legs);
  if (loaded.error || !loaded.byId) return { ok: false, error: loaded.error ?? "Could not load fixtures." };
  const byId = loaded.byId;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to place a bet." };
  const total = stakeEach * legs.length;
  if (stakeEach < MIN_STAKE) {
    return { ok: false, error: `Minimum stake is £${MIN_STAKE.toLocaleString("en-GB")} per leg.` };
  }
  if (total > user.bettingBalance) {
    return { ok: false, error: `Total stake £${total.toLocaleString("en-GB")} exceeds your balance.` };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { bettingBalance: { decrement: total } } });
    for (const l of legs) {
      const f = byId.get(l.fixtureId)!;
      await tx.bet.create({
        data: {
          userId: user.id,
          gameweekId: f.gameweekId,
          fixtureId: l.fixtureId,
          marketType: l.marketType,
          selection: l.selection,
          stake: stakeEach,
          multiplier: l.multiplier,
        },
      });
    }
  });

  revalidatePath("/predict");
  return { ok: true, balance: user.bettingBalance - total };
}
