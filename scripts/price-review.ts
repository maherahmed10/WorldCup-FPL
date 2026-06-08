// Player pricing review (ROADMAP 3.2). Sanity-checks the live price set:
//  • a valid 15-player squad fits under £100m (the game is playable), and
//  • the priciest valid squad is OVER £100m (so there are real trade-offs).
// Also prints the tier distribution + headline names for an eyeball check.
//
//   npm run price-review
import { db } from "@/lib/db";
import { SQUAD_QUOTA, MAX_PER_COUNTRY, BUDGET, type Position } from "@/lib/squad-rules";
import { pickSquad, type PricedPlayer } from "@/lib/squad-affordability";

const m = (tenths: number) => `£${(tenths / 10).toFixed(1)}m`;

async function main() {
  const rows = await db.player.findMany({
    select: { id: true, name: true, position: true, price: true, team: { select: { name: true } } },
  });
  const players: (PricedPlayer & { name: string; team: string })[] = rows.map((r) => ({
    id: r.id,
    position: r.position as Position,
    price: r.price,
    country: r.team.name,
    name: r.name,
    team: r.team.name,
  }));
  console.log(`Reviewing ${players.length} players · budget ${m(BUDGET)} · quota ${JSON.stringify(SQUAD_QUOTA)} · max/country ${MAX_PER_COUNTRY}\n`);

  // Distribution per position.
  console.log("Per-position price spread:");
  for (const pos of ["GK", "DEF", "MID", "FWD"] as Position[]) {
    const ps = players.filter((p) => p.position === pos).map((p) => p.price);
    const min = Math.min(...ps), max = Math.max(...ps);
    const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
    console.log(`  ${pos}: n=${ps.length}  ${m(min)}–${m(max)}  avg ${m(avg)}`);
  }

  // Affordability band.
  const cheapest = pickSquad(players, SQUAD_QUOTA, MAX_PER_COUNTRY, "asc");
  const priciest = pickSquad(players, SQUAD_QUOTA, MAX_PER_COUNTRY, "desc");
  console.log(`\nCheapest valid XV: ${m(cheapest.total)}  (feasible: ${cheapest.feasible})`);
  console.log(`Priciest valid XV: ${m(priciest.total)}  (feasible: ${priciest.feasible})`);

  const headroom = BUDGET - cheapest.total;
  console.log(`\nTop 12 by price:`);
  for (const p of [...players].sort((a, b) => b.price - a.price).slice(0, 12)) {
    console.log(`  ${m(p.price).padStart(7)}  ${p.position}  ${p.name} (${p.team})`);
  }

  // Verdict.
  const playable = cheapest.feasible && cheapest.total <= BUDGET;
  const tradeoffs = priciest.total > BUDGET;
  console.log("\n──────── VERDICT ────────");
  console.log(`${playable ? "✅" : "❌"} Playable: a valid XV costs ${m(cheapest.total)} (${m(headroom)} headroom under ${m(BUDGET)}).`);
  console.log(`${tradeoffs ? "✅" : "❌"} Trade-offs: the dream XV costs ${m(priciest.total)} — ${tradeoffs ? "can't afford everyone" : "TOO CHEAP, no trade-offs"}.`);
  console.log("─────────────────────────");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error("✗ price-review failed:", e.message); process.exit(1); });
