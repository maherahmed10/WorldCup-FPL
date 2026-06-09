// Head-to-Head settlement. Server-only (imports Prisma).
// No AI — settlement uses the same pure settleBetSelection() as regular bets.

import { db } from "@/lib/db";
import { settleBetSelection, type MatchResult } from "@/lib/betting";

export async function settleH2HChallenges(fixtureId: string): Promise<number> {
  const challenges = await db.h2HChallenge.findMany({
    where: { fixtureId, status: "ACCEPTED" },
  });
  if (!challenges.length) return 0;

  const fixture = await db.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture || fixture.homeScore == null || fixture.awayScore == null) return 0;

  const scorerRows = await db.playerMatchStat.findMany({
    where: { fixtureId, goals: { gt: 0 } },
    select: { playerId: true },
  });
  const result: MatchResult = {
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    scorerIds: new Set(scorerRows.map((r) => r.playerId)),
  };

  let settled = 0;
  for (const challenge of challenges) {
    const status = settleBetSelection(challenge.selection, result);
    const pot = challenge.stake * 2;

    await db.$transaction(async (tx) => {
      if (status === "VOID") {
        // Refund both sides.
        await tx.h2HChallenge.update({
          where: { id: challenge.id },
          data: { status: "SETTLED", settledAt: new Date() },
        });
        await tx.user.update({ where: { id: challenge.creatorId }, data: { bettingBalance: { increment: challenge.stake } } });
        await tx.user.update({ where: { id: challenge.opponentId }, data: { bettingBalance: { increment: challenge.stake } } });
      } else {
        // Creator wins if their selection won, opponent wins otherwise.
        const winnerId = status === "WON" ? challenge.creatorId : challenge.opponentId;
        await tx.h2HChallenge.update({
          where: { id: challenge.id },
          data: { status: "SETTLED", winnerId, settledAt: new Date() },
        });
        await tx.user.update({ where: { id: winnerId }, data: { bettingBalance: { increment: pot } } });
      }
    });
    settled++;
  }
  return settled;
}
