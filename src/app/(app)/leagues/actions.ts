"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/leagues";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Ensure a User row exists for the Supabase Auth user (auto-created on first action).
async function ensureUser(user: { id: string; email?: string }) {
  await db.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email ?? user.id,
      name: (user.email ?? user.id).split("@")[0],
    },
    update: {},
  });
}

export type ActionResult = { error: string } | { success: true; message: string };

export async function createLeague(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Sign in to create a league." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "League name is required." };
  if (name.length > 60) return { error: "League name must be 60 characters or fewer." };

  await ensureUser(user);

  // Retry on rare code collision (expected collision rate < 1 in 10M).
  let joinCode = generateJoinCode();
  for (let i = 0; i < 5; i++) {
    const clash = await db.league.findUnique({ where: { joinCode } });
    if (!clash) break;
    joinCode = generateJoinCode();
  }

  const league = await db.league.create({
    data: {
      name,
      joinCode,
      ownerId: user.id,
      members: { create: { userId: user.id } },
    },
  });

  revalidatePath("/leagues");
  return { success: true, message: `League "${league.name}" created · code: ${league.joinCode}` };
}

export async function joinLeague(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "Sign in to join a league." };

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return { error: "Enter a join code." };

  await ensureUser(user);

  const league = await db.league.findUnique({ where: { joinCode: code } });
  if (!league) return { error: `No league found with code ${code}.` };

  const already = await db.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
  });
  if (already) return { error: "You're already a member of that league." };

  await db.leagueMember.create({ data: { leagueId: league.id, userId: user.id } });

  revalidatePath("/leagues");
  return { success: true, message: `Joined "${league.name}"` };
}
