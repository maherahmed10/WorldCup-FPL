// Players market (Lane 2). Server component: reads the real Player pool from our
// DB (never the API directly — architecture rule), derives the view-model, and
// hands it to the client filter shell. Maps to design: screens_market.jsx.

import Link from "next/link";
import { db } from "@/lib/db";
import { toPlayerView, type Position } from "@/lib/players";
import { PlayersClient } from "./PlayersClient";

// Reads the DB per request — don't try to prerender at build time.
export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const rows = await db.player.findMany({
    include: {
      team: { select: { country: true, name: true, logoUrl: true } },
      priceAlt: { select: { price: true } }, // judgement price — preferred for display
      matchStats: {
        select: { fantasyPoints: true, fixture: { select: { kickoff: true } } },
      },
    },
  });

  const players = rows
    .map((p) => toPlayerView({ ...p, position: p.position as Position }))
    .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="text-sm" style={{ color: "var(--text-3)" }}>
        ← dev shell
      </Link>
      <div className="mt-4">
        <PlayersClient players={players} />
      </div>
    </main>
  );
}
