// Load the judgement-based prices (build-plan §6 hand-tiering) into the
// PlayerPriceAlt table from the committed artifact scripts/alt-prices.json.
//
//   npm run load-alt-prices
//
// The artifact is keyed by apiPlayerId (stable across re-seeds, unlike the cuid
// Player.id). These prices are deliberately SEPARATE from Player.price (the
// stats-driven model) so both methods coexist and are queryable side by side.
//
// Provenance: drafted team-by-team by football judgement against a shared tier
// rubric, then a global consistency pass (DEF/GK caps, cross-team gradient).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";

interface AltPrice {
  apiPlayerId: number;
  name: string;
  team: string;
  pos: string;
  price: number; // tenths of a million
  tier: string | null;
  note: string | null;
}

async function main() {
  const rows: AltPrice[] = JSON.parse(
    readFileSync(join(process.cwd(), "scripts", "alt-prices.json"), "utf8"),
  );
  const idByApi = new Map(
    (await db.player.findMany({ select: { id: true, apiPlayerId: true } })).map((p) => [
      p.apiPlayerId,
      p.id,
    ]),
  );

  let written = 0;
  let skipped = 0;
  for (const r of rows) {
    const playerId = idByApi.get(r.apiPlayerId);
    if (!playerId) {
      skipped++;
      continue;
    }
    await db.playerPriceAlt.upsert({
      where: { playerId },
      update: { price: r.price, tier: r.tier, note: r.note },
      create: { playerId, price: r.price, tier: r.tier, note: r.note },
    });
    written++;
  }
  console.log(`✓ PlayerPriceAlt: wrote ${written}, skipped ${skipped} (player not found).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ load-alt-prices failed:", e.message);
    process.exit(1);
  });
