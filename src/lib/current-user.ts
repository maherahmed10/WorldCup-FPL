// Current authenticated user (Supabase). Routes under (app) are already gated
// by (app)/layout.tsx, which redirects signed-out users to /login and upserts
// the matching app User row — so inside those routes this returns a real row.
// Returns null when there's no session or Supabase env isn't configured.

import { createClient } from "@/lib/supabase/server";
import { db } from "./db";

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await db.user.findUnique({ where: { id: user.id } });
  } catch {
    return null; // Supabase env not configured
  }
}
