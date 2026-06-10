"use server";

import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/squad-data";
import { getNationMembersData, type NationMemberRow } from "@/lib/nations";
import { db } from "@/lib/db";

export async function loadNationMembers(country: string): Promise<NationMemberRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const gameweek = await getCurrentGameweek();
  if (!gameweek) return [];

  return getNationMembersData(country, user.id, gameweek.id);
}

export async function setSupportedNation(country: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await db.user.update({
    where: { id: user.id },
    data: { supportedNation: country },
  });

  revalidateTag("nations", { expire: 60 });
}
