// Unit tests for the betting core (build-plan §7). Run: `npm test`.
// No DB / no network — pure functions, mirroring src/lib/scoring.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  payout,
  potentialReturn,
  availableBalance,
  canPlaceBet,
  matchMarkets,
  scorerMultiplier,
  parsePlayerProp,
  settlePlayerProp,
  STARTING_BALANCE,
  type BetLike,
  type PlayerPropStat,
} from "./betting.js";

const stat = (over: Partial<PlayerPropStat>): PlayerPropStat => ({
  minutes: 90,
  goals: 0,
  assists: 0,
  yellowCards: 0,
  redCards: 0,
  ...over,
});

test("parsePlayerProp: valid kinds parse, others reject", () => {
  assert.deepEqual(parsePlayerProp("scorer:abc"), { kind: "scorer", playerId: "abc" });
  assert.deepEqual(parsePlayerProp("assist:p1"), { kind: "assist", playerId: "p1" });
  assert.deepEqual(parsePlayerProp("card:p2"), { kind: "card", playerId: "p2" });
  assert.equal(parsePlayerProp("HOME"), null);
  assert.equal(parsePlayerProp("scorer:"), null);
});

test("settlePlayerProp: scorer/assist won from match stats, else lost", () => {
  assert.equal(settlePlayerProp("scorer", stat({ goals: 1 })), "WON");
  assert.equal(settlePlayerProp("scorer", stat({ goals: 0 })), "LOST");
  assert.equal(settlePlayerProp("assist", stat({ assists: 2 })), "WON");
  assert.equal(settlePlayerProp("assist", stat({ assists: 0 })), "LOST");
});

test("settlePlayerProp: card won on yellow or red", () => {
  assert.equal(settlePlayerProp("card", stat({ yellowCards: 1 })), "WON");
  assert.equal(settlePlayerProp("card", stat({ redCards: 1 })), "WON");
  assert.equal(settlePlayerProp("card", stat({})), "LOST");
});

test("settlePlayerProp: didn't feature → VOID (refund)", () => {
  assert.equal(settlePlayerProp("scorer", null), "VOID");
  assert.equal(settlePlayerProp("scorer", stat({ minutes: 0, goals: 0 })), "VOID");
});

test("payout: won → round(stake × multiplier)", () => {
  assert.equal(payout(100, 2.0, "WON"), 200);
  assert.equal(payout(120, 1.8, "WON"), 216); // matches design BetSlip rounding
  assert.equal(payout(33, 1.95, "WON"), 64); // 64.35 → 64
});

test("payout: lost → 0, open → 0", () => {
  assert.equal(payout(100, 2.0, "LOST"), 0);
  assert.equal(payout(100, 2.0, "OPEN"), 0);
});

test("payout: void → stake returned", () => {
  assert.equal(payout(100, 2.0, "VOID"), 100);
  assert.equal(payout(75, 9.9, "VOID"), 75); // multiplier irrelevant on void
});

test("potentialReturn = round(stake × multiplier)", () => {
  assert.equal(potentialReturn(50, 1.9), 95);
  assert.equal(potentialReturn(50, 3.6), 180);
});

test("availableBalance: open stake is locked", () => {
  const bets: BetLike[] = [{ stake: 100, multiplier: 2.0, status: "OPEN" }];
  assert.equal(availableBalance(bets, 1000), 900);
});

test("availableBalance: win credits the payout, loss keeps the deduction", () => {
  const won: BetLike[] = [{ stake: 100, multiplier: 2.0, status: "WON" }];
  assert.equal(availableBalance(won, 1000), 1100); // -100 + 200

  const lost: BetLike[] = [{ stake: 100, multiplier: 2.0, status: "LOST" }];
  assert.equal(availableBalance(lost, 1000), 900); // -100 + 0
});

test("availableBalance: void washes out (stake refunded)", () => {
  const bets: BetLike[] = [{ stake: 100, multiplier: 2.0, status: "VOID" }];
  assert.equal(availableBalance(bets, 1000), 1000);
});

test("availableBalance: mixed ledger and default starting balance", () => {
  const bets: BetLike[] = [
    { stake: 100, multiplier: 2.0, status: "WON" }, // +100 net
    { stake: 50, multiplier: 1.9, status: "LOST" }, // -50
    { stake: 80, multiplier: 3.0, status: "OPEN" }, // -80 locked
  ];
  assert.equal(availableBalance(bets), STARTING_BALANCE + 100 - 50 - 80);
});

test("canPlaceBet: can't stake more than balance, must be a positive integer", () => {
  assert.equal(canPlaceBet(100, 900), true);
  assert.equal(canPlaceBet(900, 900), true); // exactly the balance is fine
  assert.equal(canPlaceBet(901, 900), false); // over balance
  assert.equal(canPlaceBet(0, 900), false); // below MIN_STAKE
  assert.equal(canPlaceBet(-10, 900), false);
  assert.equal(canPlaceBet(10.5, 900), false); // fractional
});

test("matchMarkets: 3 groups, stable selection keys", () => {
  const groups = matchMarkets("England", "Japan");
  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map((g) => g.marketType),
    ["MATCH_RESULT", "OVER_UNDER", "BTTS"],
  );
  const result = groups[0];
  assert.equal(result.options[0].name, "England");
  assert.equal(result.options[0].selection, "HOME");
  assert.equal(result.options[2].selection, "AWAY");
});

test("matchMarkets: real odds override placeholders; missing falls back", () => {
  const groups = matchMarkets("England", "Japan", { HOME: 1.4, AWAY: 8.4 });
  const result = groups.find((g) => g.marketType === "MATCH_RESULT")!;
  assert.equal(result.options[0].multiplier, 1.4); // real
  assert.equal(result.options[2].multiplier, 8.4); // real
  assert.equal(result.options[1].multiplier, 3.3); // DRAW missing → placeholder
});

test("scorerMultiplier: premium FWD pays less than a cheap MID", () => {
  const star = scorerMultiplier("FWD", 130); // £13.0m striker
  const cheapMid = scorerMultiplier("MID", 45); // £4.5m midfielder
  assert.ok(star < cheapMid, `${star} should be < ${cheapMid}`);
  assert.ok(star >= 1.6); // clamped floor
});

test("scorerMultiplier: position ordering (FWD < MID < DEF) at equal price", () => {
  const p = 70;
  assert.ok(scorerMultiplier("FWD", p) < scorerMultiplier("MID", p));
  assert.ok(scorerMultiplier("MID", p) < scorerMultiplier("DEF", p));
});

test("scorerMultiplier: clamped to [1.6, 8.0] and 2dp", () => {
  const hi = scorerMultiplier("GK", 40); // cheap GK → should hit the 8.0 ceiling
  const lo = scorerMultiplier("FWD", 150); // £15m striker → should hit ~floor
  assert.ok(hi <= 8.0 && lo >= 1.6);
  assert.equal(Math.round(hi * 100) / 100, hi); // already 2dp
});
