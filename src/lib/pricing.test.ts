// Unit tests for the pricing core (build-plan §6). Run: `npm test`.
// Pure functions — no DB / no API.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  productionScore,
  teamTierFor,
  computePrices,
  POSITION_BANDS,
  type PlayerProduction,
  type ProductionInput,
} from "./pricing.js";

const fwd: ProductionInput = { position: "FWD", minutes: 0, goals: 0, assists: 0, rating: null };

test("productionScore: more goals → higher score", () => {
  const few = productionScore({ ...fwd, minutes: 2700, goals: 5, rating: 7 });
  const many = productionScore({ ...fwd, minutes: 2700, goals: 20, rating: 7 });
  assert.ok(many > few);
});

test("productionScore: totals beat a high-rate cameo (no per-90 fluke)", () => {
  const starter = productionScore({ position: "FWD", minutes: 2700, goals: 18, assists: 6, rating: 7.4 });
  const cameo = productionScore({ position: "FWD", minutes: 90, goals: 2, assists: 1, rating: 9.0 });
  assert.ok(starter > cameo, `starter ${starter} should beat cameo ${cameo}`);
});

test("productionScore: a defender's minutes/rating still produce a score", () => {
  const def = productionScore({ position: "DEF", minutes: 2700, goals: 1, assists: 2, rating: 7.0 });
  assert.ok(def > 0);
});

test("productionScore: zero minutes → zero", () => {
  assert.equal(productionScore({ ...fwd, minutes: 0, goals: 0, rating: null }), 0);
});

test("teamTierFor: known nations bucketed, unknown defaults to 1.0", () => {
  assert.equal(teamTierFor("Brazil"), 1.15);
  assert.equal(teamTierFor("Japan"), 1.07);
  assert.equal(teamTierFor("New Zealand"), 0.9);
  assert.equal(teamTierFor("Sweden"), 1.0); // listed-as-default
  assert.equal(teamTierFor("Atlantis"), 1.0); // not in table
});

// Build a pool of N forwards with increasing goals so ranks are deterministic.
function forwards(n: number, tier = 1.0): PlayerProduction[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `f${i}`,
    position: "FWD" as const,
    minutes: 2700,
    goals: i, // strictly increasing
    assists: 0,
    rating: 7,
    teamTier: tier,
  }));
}

test("computePrices: top of a position gets the band max, bottom the band min", () => {
  const priced = computePrices(forwards(10));
  const byId = new Map(priced.map((p) => [p.id, p.price]));
  const [lo, hi] = POSITION_BANDS.FWD;
  assert.equal(byId.get("f9"), hi); // most goals
  assert.equal(byId.get("f0"), lo); // fewest goals
});

test("computePrices: prices stay inside the position band and step by 0.5M", () => {
  const priced = computePrices(forwards(20));
  const [lo, hi] = POSITION_BANDS.FWD;
  for (const p of priced) {
    assert.ok(p.price >= lo && p.price <= hi, `${p.price} out of band`);
    assert.equal(p.price % 5, 0, `${p.price} not a 0.5M step`);
  }
});

test("computePrices: lone player in a position prices at the top of its band", () => {
  const priced = computePrices([
    { id: "g", position: "GK", minutes: 2700, goals: 0, assists: 0, rating: 7, teamTier: 1 },
  ]);
  assert.equal(priced[0].price, POSITION_BANDS.GK[1]);
});

test("computePrices: team tier lifts an equal-stats player's rank", () => {
  // Two identical forwards except tier; the higher tier must not price lower.
  const pool: PlayerProduction[] = [
    { id: "weak", position: "FWD", minutes: 2700, goals: 10, assists: 5, rating: 7, teamTier: 0.9 },
    { id: "strong", position: "FWD", minutes: 2700, goals: 10, assists: 5, rating: 7, teamTier: 1.15 },
  ];
  const byId = new Map(computePrices(pool).map((p) => [p.id, p.price]));
  assert.ok((byId.get("strong") ?? 0) >= (byId.get("weak") ?? 0));
});
