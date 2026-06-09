// Players market (Lane 2). Server component: reads the real Player pool from our
// DB (never the API directly — architecture rule), derives the view-model, and
// hands it to the client filter shell. Maps to design: screens_market.jsx.

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { toPlayerView, type Position } from "@/lib/players";
import { PlayersClient } from "./PlayersClient";

// Reads the DB per request — don't try to prerender at build time.
export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [rows, favouriteRows] = await Promise.all([
    db.player.findMany({
      include: {
        team: { select: { country: true, name: true, logoUrl: true } },
        matchStats: {
          select: { fantasyPoints: true, fixture: { select: { kickoff: true } } },
        },
      },
    }),
    user
      ? db.playerFavourite.findMany({ where: { userId: user.id }, select: { playerId: true } })
      : Promise.resolve([]),
  ]);

  const players = rows
    .map((p) => toPlayerView({ ...p, position: p.position as Position }))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));

  const initialFavouriteIds = favouriteRows.map((f) => f.playerId);

  // The (app) layout provides the shell + auth; render the screen directly.
  return <PlayersClient players={players} initialFavouriteIds={initialFavouriteIds} />;
}
