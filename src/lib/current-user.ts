// ─────────────────────────────────────────────────────────────────────────
// TEMPORARY current-user resolver.
//
// Lane 1 (Youssef) owns real Supabase Auth. Until that merges, the Predictions
// lane still needs a User row to attach Bets to, so this get-or-creates a single
// local dev user. When auth lands, replace the body with the Supabase session
// lookup (the `User.id` is already the auth.users UUID) and delete the dev path.
// ─────────────────────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import { db } from "./db";

const DEV_EMAIL = "dev@gaffer.local";

export async function getCurrentUser() {
  // TODO(auth): return the Supabase-authenticated user instead of the dev stub.
  const existing = await db.user.findUnique({ where: { email: DEV_EMAIL } });
  if (existing) return existing;
  return db.user.create({
    data: { id: randomUUID(), email: DEV_EMAIL, name: "Dev User" },
  });
}
