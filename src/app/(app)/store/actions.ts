"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { STORE_ITEMS, canAffordPerk } from "@/lib/store";

export type PurchaseResult = { ok: true } | { ok: false; error: string };

export async function purchaseItem(storeItemId: string): Promise<PurchaseResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const item = STORE_ITEMS.find((i) => i.id === storeItemId);
  if (!item) return { ok: false, error: "Item not found." };

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
