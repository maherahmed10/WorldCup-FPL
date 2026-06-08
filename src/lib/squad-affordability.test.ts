// Unit tests for squad-affordability (ROADMAP 3.2). Run: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSquad, type PricedPlayer } from "./squad-affordability.js";
import type { Position } from "./squad-rules.js";

const QUOTA: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

// Build a deep, varied pool: many countries so the 3-per-country cap is satisfiable.
function pool(): PricedPlayer[] {
  const out: PricedPlayer[] = [];
  const perPos: Record<Position, number> = { GK: 8, DEF: 16, MID: 16, FWD: 10 };
  let i = 0;
  for (const pos of ["GK", "DEF", "MID", "FWD"] as Position[]) {
    for (let n = 0; n < perPos[pos]; n++) {
      out.push({ id: `${pos}${n}`, position: pos, price: 40 + ((i * 5) % 90), country: `C${i % 12}` });
      i++;
    }
  }
  return out;
}

test("cheapest valid squad fills the exact quota and is feasible", () => {
  const r = pickSquad(pool(), QUOTA, 3, "asc");
  assert.equal(r.feasible, true);
  assert.equal(r.picked.length, 15);
  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 } as Record<Position, number>;
  for (const p of r.picked) counts[p.position]++;
  assert.deepEqual(counts, QUOTA);
});

test("cheapest <= most-expensive (real trade-offs band)", () => {
  const lo = pickSquad(pool(), QUOTA, 3, "asc");
  const hi = pickSquad(pool(), QUOTA, 3, "desc");
  assert.ok(lo.total <= hi.total);
});

test("respects max-per-country", () => {
  const r = pickSquad(pool(), QUOTA, 3, "asc");
  const counts = new Map<string, number>();
  for (const p of r.picked) counts.set(p.country, (counts.get(p.country) ?? 0) + 1);
  for (const [, n] of counts) assert.ok(n <= 3, "no country exceeds 3");
});

test("infeasible when the country cap can't satisfy the quota", () => {
  // Only 2 countries, cap 3 → at most 6 players can be picked, but 15 needed.
  const tiny: PricedPlayer[] = [];
  for (const pos of ["GK", "DEF", "MID", "FWD"] as Position[]) {
    for (let n = 0; n < 5; n++) {
      tiny.push({ id: `${pos}${n}`, position: pos, price: 50, country: n % 2 ? "A" : "B" });
    }
  }
  const r = pickSquad(tiny, QUOTA, 3, "asc");
  assert.equal(r.feasible, false);
});
