// Unit tests for squad gameweek scoring. Run: `npm test`.
// Only the pure aggregation is tested here (DB loaders are integration-tested
// via the live simulation). Mirrors scoring.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { squadGameweekTotal } from "./squad-points.js";
import type { Position } from "./squad-rules.js";

// Default position MID — the small synthetic squads below are NOT a legal 11+4,
// so the auto-sub engine never fires on them (canSwap needs a valid formation),
// which keeps these focused on the captain/vice math. Auto-sub behaviour is
// covered by the full-squad tests at the bottom.
const p = (id: string, isStarting: boolean, position: Position = "MID") => ({
  id,
  position,
  isStarting,
});

test("only starters score; bench is ignored", () => {
  const players = [p("a", true), p("b", true), p("c", false)];
  const points = { a: 5, b: 3, c: 10 }; // c benched
  assert.equal(squadGameweekTotal(players, null, points), 8); // 5 + 3, not c
});

test("captain points are doubled", () => {
  const players = [p("a", true), p("b", true)];
  const points = { a: 10, b: 4 };
  assert.equal(squadGameweekTotal(players, "a", points), 24); // 10*2 + 4
});

test("captain on the bench does not score (and isn't doubled)", () => {
  const players = [p("a", false), p("b", true)];
  const points = { a: 10, b: 4 };
  // a is benched so contributes 0 even as captain; only b's 4 counts.
  assert.equal(squadGameweekTotal(players, "a", points), 4);
});

test("missing player points default to 0", () => {
  const players = [p("a", true), p("b", true)];
  const points = { a: 6 }; // b has no settled points yet
  assert.equal(squadGameweekTotal(players, null, points), 6);
});

test("no points at all (pre-tournament) totals 0", () => {
  const players = [p("a", true), p("b", true)];
  assert.equal(squadGameweekTotal(players, "a", {}), 0);
});

test("negative player points (cards/own goals) reduce the total", () => {
  const players = [p("a", true), p("b", true)];
  const points = { a: 6, b: -2 };
  assert.equal(squadGameweekTotal(players, null, points), 4);
});

// ── vice auto-sub (captain played 0 min → vice gets ×2) ──

test("captain played → captain doubled, vice normal", () => {
  const players = [p("cap", true), p("vice", true), p("x", true)];
  const points = { cap: 6, vice: 4, x: 2 };
  const minutes = { cap: 90, vice: 90, x: 90 };
  // cap×2 (12) + vice (4) + x (2) = 18
  assert.equal(squadGameweekTotal(players, "cap", points, "vice", minutes), 18);
});

test("captain played 0 min → vice gets the ×2 instead", () => {
  const players = [p("cap", true), p("vice", true), p("x", true)];
  const points = { cap: 0, vice: 4, x: 2 };
  const minutes = { cap: 0, vice: 90, x: 90 }; // captain DNP
  // cap (0) + vice×2 (8) + x (2) = 10
  assert.equal(squadGameweekTotal(players, "cap", points, "vice", minutes), 10);
});

test("neither captain nor vice played → no doubling (×2 of 0)", () => {
  const players = [p("cap", true), p("vice", true), p("x", true)];
  const points = { cap: 0, vice: 0, x: 5 };
  const minutes = { cap: 0, vice: 0, x: 90 };
  assert.equal(squadGameweekTotal(players, "cap", points, "vice", minutes), 5);
});

test("no vice given → falls back to captain doubling", () => {
  const players = [p("cap", true), p("x", true)];
  const points = { cap: 7, x: 3 };
  // no minutes/vice passed → captain doubled: 14 + 3 = 17
  assert.equal(squadGameweekTotal(players, "cap", points), 17);
});

// ── bench auto-subs (0-minute starter → first eligible bench player) ──
// A legal 4-3-3 XI + a 4-man bench (GK first, then 3 outfielders).
function fullSquad() {
  return [
    p("gk", true, "GK"),
    p("d1", true, "DEF"), p("d2", true, "DEF"), p("d3", true, "DEF"), p("d4", true, "DEF"),
    p("m1", true, "MID"), p("m2", true, "MID"), p("m3", true, "MID"),
    p("f1", true, "FWD"), p("f2", true, "FWD"), p("f3", true, "FWD"),
    // bench, left-to-right priority: GK, then 3 outfielders
    p("bgk", false, "GK"), p("bo1", false, "DEF"), p("bo2", false, "MID"), p("bo3", false, "FWD"),
  ];
}
// All 15 played 90 unless overridden.
const allPlayed = () =>
  Object.fromEntries(fullSquad().map((x) => [x.id, 90])) as Record<string, number>;

test("auto-sub: a starter who played 0 min is replaced by the first eligible bench player", () => {
  const players = fullSquad();
  const minutes = { ...allPlayed(), m2: 0 }; // a midfielder didn't play
  // Bench order is bgk, bo1(DEF), bo2(MID), bo3(FWD). For a MID out, bgk(GK) is
  // ineligible (2 GKs), but bo1(DEF) IS eligible — 4-3-3 → 5-2-3 is a valid
  // shape — so bo1 comes in FIRST (left-to-right), even though bo2 is like-for-like.
  const points = { m2: 0, bo1: 4, bo2: 7 };
  assert.equal(squadGameweekTotal(players, null, points, null, minutes), 4); // bo1, not bo2
});

test("auto-sub: first eligible bench player (left→right) is chosen", () => {
  const players = fullSquad();
  const minutes = { ...allPlayed(), f1: 0, bo1: 90, bo2: 90, bo3: 90 };
  // f1 (FWD) out. Bench order is bgk, bo1(DEF), bo2(MID), bo3(FWD).
  // Replacing a FWD with a DEF (bo1) → 4-3-3 becomes 5-3-2, an allowed shape, so
  // bo1 is taken FIRST even though bo3 is a like-for-like FWD. Give them distinct
  // points so we can tell which came in.
  const points = { f1: 0, bo1: 4, bo2: 5, bo3: 9 };
  assert.equal(squadGameweekTotal(players, null, points, null, minutes), 4); // bo1, not bo3
});

test("auto-sub: GK is only replaced by the bench GK", () => {
  const players = fullSquad();
  const minutes = { ...allPlayed(), gk: 0, bgk: 90 };
  const points = { gk: 0, bgk: 6, bo1: 3, bo2: 3, bo3: 3 };
  // gk out → bench GK in for 6 (an outfielder can't fill the GK slot).
  assert.equal(squadGameweekTotal(players, null, points, null, minutes), 6);
});

test("auto-sub: no sub when no eligible bench player played", () => {
  const players = fullSquad();
  const minutes = { ...allPlayed(), m1: 0, bgk: 0, bo1: 0, bo2: 0, bo3: 0 };
  const points = { m1: 0, bo2: 9 }; // bench MID scored but DNP → ineligible
  assert.equal(squadGameweekTotal(players, null, points, null, minutes), 0);
});

test("auto-sub: captain who played 0 min → vice ×2, AND the captain is subbed out", () => {
  const players = fullSquad();
  const minutes = { ...allPlayed(), f1: 0 };
  // f1 (captain, FWD) DNP. Vice m1 (played) takes ×2. f1 is subbed out — the
  // first eligible bench player for a FWD is bo1(DEF) (4-3-3 → 5-3-2), in for 4.
  const points = { f1: 0, m1: 5, bo1: 4 };
  // vice m1 ×2 (10) + bo1 (4) = 14.
  assert.equal(squadGameweekTotal(players, "f1", points, "m1", minutes), 14);
});
