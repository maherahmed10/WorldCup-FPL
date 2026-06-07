"use server";

// Set the user's fantasy team name (the one-time in-app prompt after first login).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export async function setTeamName(teamName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = teamName.trim();
  if (trimmed.length < 2 || trimmed.length > 30) {
    return { ok: false, error: "Team name must be 2–30 characters." };
  }

  await db.user.update({ where: { id: user.id }, data: { teamName: trimmed } });
  revalidatePath("/team");
  return { ok: true };
}
