"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export async function toggleFavourite(playerId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const existing = await db.playerFavourite.findUnique({
    where: { userId_playerId: { userId: user.id, playerId } },
  });

  if (existing) {
    await db.playerFavourite.delete({
      where: { userId_playerId: { userId: user.id, playerId } },
    });
  } else {
    await db.playerFavourite.create({
      data: { userId: user.id, playerId },
    });
  }

  return { ok: true };
}
