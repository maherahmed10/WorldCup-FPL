"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getCurrentGameweek } from "@/lib/squad-data";
import { TRANSFERS_PER_WINDOW } from "@/lib/squad-rules";

export type TransferResult = { ok: true } | { ok: false; error: string };

export async function saveTransfers(
  newPlayerIds: string[],
  captainId: string | null,
): Promise<TransferResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const gameweek = await getCurrentGameweek();
  if (!gameweek) return { ok: false, error: "No active gameweek found." };
  if (!gameweek.isKnockout) {
    return { ok: false, error: "Transfer window is not open — transfers are only allowed during knockout rounds." };
  }

  if (newPlayerIds.length !== 15) {
    return { ok: false, error: "Squad must contain exactly 15 players." };
  }

  // Load current squad
  const squad = await db.squad.findUnique({
    where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
    include: { players: true },
  });
  if (!squad) return { ok: false, error: "No squad found for this gameweek." };

  const currentIds = new Set(squad.players.map((p) => p.playerId));
  const newSet = new Set(newPlayerIds);

  // Count incoming players (not in current squad) = number of transfers
  const incomingCount = newPlayerIds.filter((id) => !currentIds.has(id)).length;

  if (incomingCount === 0) {
    // No changes — still save captain if it changed
    await db.squad.update({
      where: { id: squad.id },
      data: { captainId },
    });
    revalidatePath("/transfers");
    revalidatePath("/team");
    return { ok: true };
  }

  // Load active extra_transfer perks
  const activeExtraTransfers = await db.userPerk.findMany({
    where: {
      userId: user.id,
      storeItemId: "perk_extra_transfer",
      usedAt: null,
    },
  });

  const limit = TRANSFERS_PER_WINDOW + activeExtraTransfers.length;
  const totalAfter = squad.transfersUsed + incomingCount;

  if (totalAfter > limit) {
    const remaining = limit - squad.transfersUsed;
    return {
      ok: false,
      error: `Transfer limit exceeded — you have ${remaining} transfer${remaining === 1 ? "" : "s"} remaining this window.`,
    };
  }

  // Determine how many extra_transfer perks to consume
  const normalRemaining = TRANSFERS_PER_WINDOW - squad.transfersUsed;
  const extraNeeded = Math.max(0, incomingCount - normalRemaining);
  const perksToConsume = activeExtraTransfers.slice(0, extraNeeded);

  await db.$transaction(async (tx) => {
    // Consume extra_transfer perks if needed
    if (perksToConsume.length > 0) {
      await tx.userPerk.updateMany({
        where: { id: { in: perksToConsume.map((p) => p.id) } },
        data: { usedAt: new Date() },
      });
    }

    // Remove old squad players and add new ones
    await tx.squadPlayer.deleteMany({ where: { squadId: squad.id } });
    await tx.squadPlayer.createMany({
      data: newPlayerIds.map((playerId) => ({
        squadId: squad.id,
        playerId,
        isStarting: true, // caller manages starting/bench; keep all starting for now
      })),
    });

    // Update squad
    await tx.squad.update({
      where: { id: squad.id },
      data: {
        captainId: captainId && newSet.has(captainId) ? captainId : null,
        transfersUsed: { increment: incomingCount },
      },
    });
  });

  revalidatePath("/transfers");
  revalidatePath("/team");
  return { ok: true };
}
