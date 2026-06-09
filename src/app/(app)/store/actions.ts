"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getCurrentGameweek } from "@/lib/squad-data";
import { STORE_ITEMS, canAffordPerk } from "@/lib/store";

export type PurchaseResult = { ok: true } | { ok: false; error: string };

export async function purchaseItem(storeItemId: string): Promise<PurchaseResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const item = STORE_ITEMS.find((i) => i.id === storeItemId);
  if (!item) return { ok: false, error: "Item not found." };

  // The whole store is locked until the group stage ends — you can't spend until
  // your squad budget + stipend + winnings merge into one bank in the knockouts.
  const gameweek = await getCurrentGameweek();
  if (!gameweek?.isKnockout) {
    return { ok: false, error: "The store unlocks after the group stage." };
  }

  if (!canAffordPerk(user.bettingBalance, item.cost)) {
    return {
      ok: false,
      error: `Not enough funds — you need £${item.cost.toLocaleString("en-GB")} but have £${user.bettingBalance.toLocaleString("en-GB")}.`,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { bettingBalance: { decrement: item.cost } },
    });
    await tx.userPerk.create({
      data: {
        userId: user.id,
        storeItemId: item.id,
        gameweekId: null,
        usedAt: null,
      },
    });
  });

  revalidatePath("/store");
  return { ok: true };
}
