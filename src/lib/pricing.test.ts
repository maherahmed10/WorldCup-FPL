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

const base: ProductionInput = {
  position: "FWD",
  minutes: 2700,
  goals: 0,
  assists: 0,
  shotsOn: 0,
  keyPasses: 0,
  defActions: 0,
  saves: 0,
  conceded: 0,
  rating: 7.0,
  leagueWeight: 1.0,
};

test("more shots on target → higher forward score", () => {
  const few = productionScore({ ...base, shotsOn: 20 });
  const many = productionScore({ ...base, shotsOn: 80 });
  assert.ok(many > few);
});

test("per-90 rate beats raw volume", () => {
  // Same minutes: the higher per-90 shot rate must score higher, even though
  // a volume model could be fooled by totals.
  const sharp = productionScore({ ...base, minutes: 2700, shotsOn: 60, goals: 18 });
  const padded = productionScore({ ...base, minutes: 2700, shotsOn: 30, goals: 12 });
  assert.ok(sharp > padded);
});

test("league weight scales the score (context restored after per-90)", () => {
  const strong = productionScore({ ...base, shotsOn: 50, goals: 15, leagueWeight: 1.0 });
  const weak = productionScore({ ...base, shotsOn: 50, goals: 15, leagueWeight: 0.6 });
  assert.ok(strong > weak);
  assert.ok(Math.abs(weak - strong * 0.6) < 1e-9); // exactly proportional
});

test("minutes reliability: same rates, more minutes scores higher (up to the cap)", () => {
  // Same per-90 (goals scale with minutes), but the low-minute sample is damped.
  const low = productionScore({ ...base, minutes: 600, shotsOn: 12, goals: 4 });
  const high = productionScore({ ...base, minutes: 1500, shotsOn: 30, goals: 10 });
  assert.ok(high > low);
});

test("zero minutes → zero", () => {
  assert.equal(productionScore({ ...base, minutes: 0, shotsOn: 50, goals: 20 }), 0);
});

test("defenders are scored on defensive actions + clean sheets, not just goals", () => {
  const busyDef = productionScore({ ...base, position: "DEF", defActions: 180, conceded: 25 });
  const idleDef = productionScore({ ...base, position: "DEF", defActions: 30, conceded: 60 });
  assert.ok(busyDef > idleDef);
});

test("keepers: high save% + few conceded beats a leaky keeper", () => {
  const elite = productionScore({ ...base, position: "GK", minutes: 2700, saves: 90, conceded: 25, rating: 7.2 });
  const leaky = productionScore({ ...base, position: "GK", minutes: 2700, saves: 60, conceded: 60, rating: 6.6 });
  assert.ok(elite > leaky);
});

// Build N forwards with increasing shot output for deterministic ranks.
function forwards(n: number, tier = 1.0): PlayerProduction[] {
  return Array.from({ length: n }, (_, i) => ({
    ...base,
    id: `f${i}`,
    position: "FWD" as const,
    shotsOn: i * 3,
    goals: i,
    teamTier: tier,
  }));
}

test("computePrices: top of a position gets the band max, bottom the band min", () => {
  const priced = computePrices(forwards(10));
  const byId = new Map(priced.map((p) => [p.id, p.price]));
  const [lo, hi] = POSITION_BANDS.FWD;
  assert.equal(byId.get("f9"), hi);
  assert.equal(byId.get("f0"), lo);
});

test("computePrices: prices stay inside the band and step by 0.5M", () => {
  const priced = computePrices(forwards(20));
  const [lo, hi] = POSITION_BANDS.FWD;
  for (const p of priced) {
    assert.ok(p.price >= lo && p.price <= hi, `${p.price} out of band`);
    assert.equal(p.price % 5, 0, `${p.price} not a 0.5M step`);
  }
});

test("computePrices: lone player in a position prices at the top of its band", () => {
  const priced = computePrices([{ ...base, id: "g", position: "GK", saves: 80, conceded: 30, teamTier: 1 }]);
  assert.equal(priced[0].price, POSITION_BANDS.GK[1]);
});

test("computePrices: team tier lifts an equal-stats player's rank", () => {
  const pool: PlayerProduction[] = [
    { ...base, id: "weak", shotsOn: 40, goals: 12, teamTier: 0.9 },
    { ...base, id: "strong", shotsOn: 40, goals: 12, teamTier: 1.15 },
  ];
  const byId = new Map(computePrices(pool).map((p) => [p.id, p.price]));
  assert.ok((byId.get("strong") ?? 0) >= (byId.get("weak") ?? 0));
});

test("teamTierFor: known nations bucketed, unknown defaults to 1.0", () => {
  assert.equal(teamTierFor("Brazil"), 1.15);
  assert.equal(teamTierFor("Japan"), 1.07);
  assert.equal(teamTierFor("New Zealand"), 0.9);
  assert.equal(teamTierFor("Atlantis"), 1.0);
});
