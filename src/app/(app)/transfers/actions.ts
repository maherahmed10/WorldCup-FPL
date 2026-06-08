"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getCurrentGameweek, getActiveSquad, getLatestSquad } from "@/lib/squad-data";
import {
  validateTransfer,
  isTransferWindowOpen,
  type Position,
  type SquadPlayer,
} from "@/lib/squad-rules";

export type TransferResult = { error: string } | { success: true };

export async function executeTransfer(
  outPlayerId: string,
  inPlayerId: string,
): Promise<TransferResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gameweek = await getCurrentGameweek();
  if (!gameweek) return { error: "No active gameweek." };
  if (!isTransferWindowOpen(gameweek)) {
    return { error: "Transfer window is closed — transfers only open during knockout rounds." };
  }

  // Use the current GW squad if one exists (chained transfers in same window),
  // otherwise fall back to the most recent squad from any previous gameweek.
  const baseSquad =
    (await getActiveSquad(user.id, gameweek.id)) ??
    (await getLatestSquad(user.id));

  if (!baseSquad) {
    return { error: "You don't have a squad yet. Pick your team first." };
  }
  if (!baseSquad.players.some((p) => p.id === outPlayerId)) {
    return { error: "The player to transfer out is not in your squad." };
  }
  if (baseSquad.players.some((p) => p.id === inPlayerId)) {
    return { error: "That player is already in your squad." };
  }
  if (outPlayerId === inPlayerId) {
    return { error: "Cannot transfer a player for themselves." };
  }

  const [outPlayer, inPlayer] = await Promise.all([
    db.player.findUnique({ where: { id: outPlayerId }, include: { team: true } }),
    db.player.findUnique({ where: { id: inPlayerId }, include: { team: true } }),
  ]);
  if (!outPlayer || !inPlayer) return { error: "Unknown player." };

  const currentSquad: SquadPlayer[] = baseSquad.players.map((p) => ({
    id: p.id,
    position: p.position,
    price: p.price,
    country: p.country,
  }));
  const ruleOut: SquadPlayer = {
    id: outPlayerId,
    position: outPlayer.position as Position,
    price: outPlayer.price,
    country: outPlayer.team.country,
  };
  const ruleIn: SquadPlayer = {
    id: inPlayerId,
    position: inPlayer.position as Position,
    price: inPlayer.price,
    country: inPlayer.team.country,
  };

  const validation = validateTransfer(currentSquad, ruleOut, ruleIn);
  if (!validation.valid) {
    return { error: validation.errors[0]?.message ?? "Transfer is not valid." };
  }

  // Build new player list: swap out → in, preserve isStarting for each slot.
  const newPlayers = baseSquad.players.map((p) => ({
    playerId: p.id === outPlayerId ? inPlayerId : p.id,
    isStarting: p.isStarting,
  }));

  // Captain carried over unless it was the transferred-out player.
  const newCaptainId =
    baseSquad.captainId === outPlayerId ? null : baseSquad.captainId;

  // Upsert Squad row for the current knockout gameweek.
  const existing = await db.squad.findUnique({
    where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek.id } },
  });

  if (existing) {
    await db.squadPlayer.deleteMany({ where: { squadId: existing.id } });
    await db.squad.update({
      where: { id: existing.id },
      data: {
        captainId: newCaptainId,
        players: { create: newPlayers },
      },
    });
  } else {
    await db.squad.create({
      data: {
        userId: user.id,
        gameweekId: gameweek.id,
        captainId: newCaptainId,
        players: { create: newPlayers },
      },
    });
  }

  revalidatePath("/transfers");
  revalidatePath("/team");
  return { success: true };
}
