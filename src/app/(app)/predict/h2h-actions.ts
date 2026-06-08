"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

// Create an H2H challenge from one of the creator's existing OPEN bets.
// Both sides stake the same amount; pot = 2 × stake; winner takes all.
export async function createH2HFromBet(
  betId: string,
  opponentId: string,
  stake: number,
  pickLabel: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  if (!Number.isInteger(stake) || stake < 1)
    return { ok: false, error: "Stake must be a whole number ≥ £1" };
  if (stake > user.bettingBalance)
    return { ok: false, error: `Insufficient balance (have £${user.bettingBalance.toLocaleString("en-GB")})` };
  if (opponentId === user.id)
    return { ok: false, error: "You can't challenge yourself" };

  const bet = await db.bet.findUnique({ where: { id: betId } });
  if (!bet) return { ok: false, error: "Bet not found" };
  if (bet.userId !== user.id) return { ok: false, error: "Not your bet" };
  if (bet.status !== "OPEN") return { ok: false, error: "Can only challenge on open bets" };
  if (!bet.fixtureId) return { ok: false, error: "This bet has no linked fixture" };

  const opponent = await db.user.findUnique({ where: { id: opponentId } });
  if (!opponent) return { ok: false, error: "Opponent not found" };

  const challenge = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { bettingBalance: { decrement: stake } },
    });
    return tx.h2HChallenge.create({
      data: {
        creatorId: user.id,
        opponentId,
        fixtureId: bet.fixtureId!,
        selection: bet.selection,
        multiplier: bet.multiplier,
        pickLabel,
        stake,
      },
    });
  });

  revalidatePath("/predict");
  return { ok: true, id: challenge.id };
}

// Opponent accepts or rejects an incoming challenge.
export async function respondToH2HChallenge(
  challengeId: string,
  accept: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const challenge = await db.h2HChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return { ok: false, error: "Challenge not found" };
  if (challenge.opponentId !== user.id) return { ok: false, error: "Not your challenge" };
  if (challenge.status !== "PENDING") return { ok: false, error: "Challenge is no longer pending" };

  if (!accept) {
    await db.$transaction(async (tx) => {
      await tx.h2HChallenge.update({ where: { id: challengeId }, data: { status: "REJECTED" } });
      await tx.user.update({
        where: { id: challenge.creatorId },
        data: { bettingBalance: { increment: challenge.stake } },
      });
    });
  } else {
    if (user.bettingBalance < challenge.stake)
      return { ok: false, error: `Insufficient balance — need £${challenge.stake.toLocaleString("en-GB")}` };
    await db.$transaction(async (tx) => {
      await tx.h2HChallenge.update({ where: { id: challengeId }, data: { status: "ACCEPTED" } });
      await tx.user.update({
        where: { id: user.id },
        data: { bettingBalance: { decrement: challenge.stake } },
      });
    });
  }

  revalidatePath("/predict");
  return { ok: true };
}

// Create an H2H challenge directly from a market selection (no prior bet needed).
export async function createH2HFromMarket(
  fixtureId: string,
  selection: string,
  multiplier: number,
  pickLabel: string,
  opponentId: string,
  stake: number,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  if (!Number.isInteger(stake) || stake < 1)
    return { ok: false, error: "Stake must be a whole number ≥ £1" };
  if (stake > user.bettingBalance)
    return { ok: false, error: `Insufficient balance (have £${user.bettingBalance.toLocaleString("en-GB")})` };
  if (opponentId === user.id)
    return { ok: false, error: "You can't challenge yourself" };

  const fixture = await db.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return { ok: false, error: "Fixture not found" };

  const opponent = await db.user.findUnique({ where: { id: opponentId } });
  if (!opponent) return { ok: false, error: "Opponent not found" };

  const challenge = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { bettingBalance: { decrement: stake } },
    });
    return tx.h2HChallenge.create({
      data: { creatorId: user.id, opponentId, fixtureId, selection, multiplier, pickLabel, stake },
    });
  });

  revalidatePath("/predict");
  return { ok: true, id: challenge.id };
}

// Creator cancels a PENDING challenge and gets their stake back.
export async function cancelH2HChallenge(
  challengeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const challenge = await db.h2HChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return { ok: false, error: "Challenge not found" };
  if (challenge.creatorId !== user.id) return { ok: false, error: "Not your challenge" };
  if (challenge.status !== "PENDING") return { ok: false, error: "Can only cancel pending challenges" };

  await db.$transaction(async (tx) => {
    await tx.h2HChallenge.update({ where: { id: challengeId }, data: { status: "CANCELLED" } });
    await tx.user.update({
      where: { id: user.id },
      data: { bettingBalance: { increment: challenge.stake } },
    });
  });

  revalidatePath("/predict");
  return { ok: true };
}
