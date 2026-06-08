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
  settleBetSelection,
  parsePlayerProp,
  settlePlayerProp,
  STARTING_BALANCE,
  type BetLike,
  type MatchResult,
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

// ── Money economy (2.1) ────────────────────────────────────────────────────

test("money balance: availableBalance uses STARTING_MONEY correctly", () => {
  const bets: BetLike[] = [{ stake: 100, multiplier: 2.0, status: "WON" }];
  // STARTING_MONEY is 1000; -100 stake + 200 payout = 1100
  assert.equal(availableBalance(bets, STARTING_BALANCE), 1100);
});

test("money balance: can't stake more than bettingBalance", () => {
  const balance = 350;
  assert.equal(canPlaceBet(350, balance), true);  // exact balance is fine
  assert.equal(canPlaceBet(351, balance), false); // one over
  assert.equal(canPlaceBet(0, balance), false);   // zero stake
});

test("money payout rounding: £ amounts behave identically to points math", () => {
  // £50 at 3.3x → 165 (165.0 exactly)
  assert.equal(payout(50, 3.3, "WON"), 165);
  // £33 at 1.95x → 64 (rounds down from 64.35)
  assert.equal(payout(33, 1.95, "WON"), 64);
  // Void always refunds the exact stake in £
  assert.equal(payout(75, 9.9, "VOID"), 75);
});

// ───────────────────── bet settlement (post-match) ─────────────────────

const res = (h: number, a: number, scorers: string[] = []): MatchResult => ({
  homeScore: h,
  awayScore: a,
  scorerIds: new Set(scorers),
});

test("settle MATCH_RESULT: home win / away win / draw", () => {
  assert.equal(settleBetSelection("HOME", res(2, 1)), "WON");
  assert.equal(settleBetSelection("HOME", res(1, 1)), "LOST");
  assert.equal(settleBetSelection("AWAY", res(0, 3)), "WON");
  assert.equal(settleBetSelection("AWAY", res(2, 2)), "LOST");
  assert.equal(settleBetSelection("DRAW", res(1, 1)), "WON");
  assert.equal(settleBetSelection("DRAW", res(2, 1)), "LOST");
});

test("settle OVER/UNDER 2.5 by total goals", () => {
  assert.equal(settleBetSelection("OVER_2.5", res(2, 1)), "WON"); // 3 > 2.5
  assert.equal(settleBetSelection("OVER_2.5", res(1, 1)), "LOST"); // 2 < 2.5
  assert.equal(settleBetSelection("UNDER_2.5", res(1, 1)), "WON");
  assert.equal(settleBetSelection("UNDER_2.5", res(3, 0)), "LOST");
});

test("settle BTTS: both teams to score", () => {
  assert.equal(settleBetSelection("BTTS_YES", res(1, 1)), "WON");
  assert.equal(settleBetSelection("BTTS_YES", res(2, 0)), "LOST");
  assert.equal(settleBetSelection("BTTS_NO", res(3, 0)), "WON");
  assert.equal(settleBetSelection("BTTS_NO", res(1, 2)), "LOST");
});

test("settle scorer prop: WON if player scored, else LOST", () => {
  const r = res(2, 1, ["p1", "p7"]);
  assert.equal(settleBetSelection("scorer:p1", r), "WON");
  assert.equal(settleBetSelection("scorer:p9", r), "LOST");
});

test("settle unknown selection → VOID (refund, never wrongly lose)", () => {
  assert.equal(settleBetSelection("CORRECT_SCORE_2_1", res(2, 1)), "VOID");
});

test("settlement integrates with payout: won scorer pays stake×mult", () => {
  const status = settleBetSelection("scorer:p1", res(1, 0, ["p1"]));
  assert.equal(status, "WON");
  assert.equal(payout(100, 1.8, status), 180);
});
