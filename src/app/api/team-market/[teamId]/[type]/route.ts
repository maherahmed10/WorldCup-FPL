// On-demand team roster for a player market (scorer / assist / card), with our
// computed odds per player. Powers the "+ Other <team>" picker so users can bet
// on ANY player in a nation's squad, not just the top-3 shortlist. DB only.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scorerMultiplier, assistMultiplier, cardMultiplier } from "@/lib/betting";

type MarketType = "scorer" | "assist" | "card";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; type: string }> },
) {
  const { teamId, type } = await params;
  const market = type as MarketType;

  // Position pool per market (matches the shortlist logic on the page):
  //   scorer/assist → attackers (FWD/MID); card → defenders (DEF/MID).
  const positions =
    market === "card" ? (["DEF", "MID"] as const) : (["FWD", "MID"] as const);

  const players = await db.player.findMany({
    where: { teamId, position: { in: positions as unknown as ("FWD" | "MID" | "DEF")[] } },
    select: { id: true, name: true, position: true, price: true },
    orderBy: [{ price: "desc" }, { name: "asc" }],
  });

  const odds = (pos: "GK" | "DEF" | "MID" | "FWD", price: number) =>
    market === "scorer"
      ? scorerMultiplier(pos, price)
      : market === "assist"
        ? assistMultiplier(pos, price)
        : cardMultiplier(pos, price);

  const rows = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position as "DEF" | "MID" | "FWD",
      odds: odds(p.position as "GK" | "DEF" | "MID" | "FWD", p.price),
    }))
    // shortest odds first (most likely) — same ordering the shortlist uses.
    .sort((a, b) => a.odds - b.odds);

  return NextResponse.json(rows);
}
