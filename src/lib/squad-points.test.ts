// Unit tests for squad gameweek scoring. Run: `npm test`.
// Only the pure aggregation is tested here (DB loaders are integration-tested
// via the live simulation). Mirrors scoring.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { squadGameweekTotal } from "./squad-points.js";

const p = (id: string, isStarting: boolean) => ({ id, isStarting });

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
