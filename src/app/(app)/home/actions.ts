"use server";

// Mark the signed-in user as onboarded (first-login Welcome guide dismissed).
// Per-account source of truth: User.onboardedAt. Mirrors team/actions.ts.
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export async function setOnboarded() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  await db.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
  return { ok: true };
}
