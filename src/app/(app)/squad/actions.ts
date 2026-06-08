"use server";

// Server action to save a squad. Re-validates the FPL rules server-side (never
// trust the client), then writes Squad + SquadPlayer rows for the current
// gameweek. Upserts so re-saving replaces the existing squad for that gameweek.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getCurrentGameweek } from "@/lib/squad-data";
import {
  validateSquad,
  formationName,
  XI_SIZE,
  type Position,
  type SquadPlayer,
} from "@/lib/squad-rules";

export interface SavePayload {
  starterIds: string[]; // 11 starting player ids
  benchIds: string[]; // 4 bench player ids
  captainId: string | null;
  viceId: string | null;
}

export async function saveSquad(payload: SavePayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gameweek = await getCurrentGameweek();
  if (!gameweek) return { ok: false, error: "No active gameweek." };

  const allIds = [...payload.starterIds, ...payload.benchIds];
  if (new Set(allIds).size !== allIds.length) {
    return { ok: false, error: "Duplicate player in squad." };
  }

  // Load the picked players from the DB to validate against real prices/countries.
  const players = await db.player.findMany({
    where: { id: { in: allIds } },
    include: { team: true },
  });
  if (players.length !== allIds.length) {
    return { ok: false, error: "Unknown player in squad." };
  }

  const asRules: SquadPlayer[] = players.map((p) => ({
    id: p.id,
    position: p.position as Position,
    price: p.price,
    country: p.team.country,
  }));

  const result = validateSquad(asRules);
  if (!result.valid) {
    return { ok: false, error: result.errors[0]?.message ?? "Invalid squad." };
  }

  // Starting XI must be 11 + a 4-man bench, in an allowable named formation.
  if (payload.starterIds.length !== XI_SIZE || payload.benchIds.length !== 4) {
    return { ok: false, error: "Pick 11 starters and 4 substitutes." };
  }
  const byId = new Map(asRules.map((p) => [p.id, p]));
  const starterRules = payload.starterIds
    .map((id) => byId.get(id))
    .filter((p): p is SquadPlayer => !!p);
  if (!formationName(starterRules)) {
    return { ok: false, error: "Your starting 11 isn't an allowed formation." };
  }
  // Captain + vice are REQUIRED, must be in the starting XI, and must differ.
  const { captainId, viceId } = payload;
  const starters = new Set(payload.starterIds);
  if (!captainId || !viceId) {
    return { ok: false, error: "Pick a captain and a vice-captain before saving." };
  }
  if (!starters.has(captainId)) return { ok: false, error: "Captain must be in your starting 11." };
  if (!starters.has(viceId)) return { ok: false, error: "Vice-captain must be in your starting 11." };
  if (captainId === viceId) return { ok: false, error: "Captain and vice-captain must be different players." };

  // Upsert the squad for this user+gameweek, replacing its players.
  const existing = await db.squad.findUnique({
    where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
  });

  if (existing) {
    await db.squadPlayer.deleteMany({ where: { squadId: existing.id } });
    await db.squad.update({
      where: { id: existing.id },
      data: {
        captainId, // keep the initial captain on the squad too
        players: {
          create: allIds.map((id) => ({ playerId: id, isStarting: starters.has(id) })),
        },
      },
    });
  } else {
    await db.squad.create({
      data: {
        userId: user.id,
        gameweekId: gameweek.id,
        captainId,
        players: {
          create: allIds.map((id) => ({ playerId: id, isStarting: starters.has(id) })),
        },
      },
    });
  }

  // The per-gameweek captain + vice (this is what settlement reads).
  await db.gameweekPick.upsert({
    where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
    update: { captainId, viceId },
    create: { userId: user.id, gameweekId: gameweek.id, captainId, viceId },
  });

  revalidatePath("/team");
  return { ok: true };
}
