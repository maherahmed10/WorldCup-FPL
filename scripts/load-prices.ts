// Load the player prices into Player.price from the committed artifact
// scripts/prices.json. This is the single source of truth for pricing:
// judgement-based hand-tiering (build-plan §6), keyed by apiPlayerId so it
// survives re-seeds.
//
//   npm run load-prices
//
// Provenance: drafted team-by-team by football judgement against a shared tier
// rubric (superstar/elite/star/starter/solid/squad/fringe; GK<=6.0, DEF<=7.5),
// then a global consistency pass.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";

interface PriceRow {
  apiPlayerId: number;
  name: string;
  team: string;
  pos: string;
  price: number; // tenths of a million
  tier: string | null;
  note: string | null;
}

async function main() {
  const rows: PriceRow[] = JSON.parse(
    readFileSync(join(process.cwd(), "scripts", "prices.json"), "utf8"),
  );

  let written = 0;
  let skipped = 0;
  for (const r of rows) {
    const res = await db.player.updateMany({
      where: { apiPlayerId: r.apiPlayerId },
      data: { price: r.price },
    });
    if (res.count > 0) written += res.count;
    else skipped++;
  }
  console.log(`✓ Player.price: wrote ${written}, skipped ${skipped} (apiPlayerId not found).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ load-prices failed:", e.message);
    process.exit(1);
  });
