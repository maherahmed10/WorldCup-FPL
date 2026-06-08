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

// Set the captain + vice for a given gameweek. Editable until the gameweek
// deadline (first kickoff). Both must be in the user's STARTING XI and differ.
export async function setGameweekCaptain(
  gameweekId: string,
  captainId: string,
  viceId: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (captainId === viceId) {
    return { ok: false, error: "Captain and vice-captain must be different players." };
  }

  const gameweek = await db.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) return { ok: false, error: "Gameweek not found." };
  if (gameweek.deadline.getTime() <= Date.now()) {
    return { ok: false, error: "The captaincy deadline for this gameweek has passed." };
  }

  // Both must be in the user's active squad and STARTING for this gameweek.
  const squad = await db.squad.findUnique({
    where: { userId_gameweekId: { userId: user.id, gameweekId } },
    include: { players: { select: { playerId: true, isStarting: true } } },
  });
  if (!squad) return { ok: false, error: "Pick your squad first." };
  const starters = new Set(squad.players.filter((p) => p.isStarting).map((p) => p.playerId));
  if (!starters.has(captainId) || !starters.has(viceId)) {
    return { ok: false, error: "Captain and vice must both be in your starting 11." };
  }

  await db.gameweekPick.upsert({
    where: { userId_gameweekId: { userId: user.id, gameweekId } },
    update: { captainId, viceId },
    create: { userId: user.id, gameweekId, captainId, viceId },
  });
  revalidatePath("/team");
  return { ok: true };
}
