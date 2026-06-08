// Unit tests for the FPL scoring core (build-plan §3). Run: `npm test`.
// No DB / no network — pure function tests, so the core is provably correct
// before any feed is wired.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreMatch, scoreSquadGameweek, resolveCaptain, type MatchStatLine } from "./scoring.js";

const base: MatchStatLine = {
  position: "MID",
  minutes: 0,
  goals: 0,
  assists: 0,
  yellowCards: 0,
  redCards: 0,
  saves: 0,
  penaltiesSaved: 0,
  penaltiesMissed: 0,
  goalsConceded: 0,
  ownGoals: 0,
};

test("appearance: 60+ min = 2 (+1 MID clean sheet), 1-59 = 1, 0 = 0", () => {
  // base is a MID with 0 conceded, so 90 min => 2 appearance + 1 clean sheet.
  assert.equal(scoreMatch({ ...base, minutes: 90 }), 3);
  assert.equal(scoreMatch({ ...base, minutes: 30 }), 1); // <60, no clean sheet
  assert.equal(scoreMatch({ ...base, minutes: 0 }), 0);
});

test("midfielder goal = 5, assist = 3 (+1 clean sheet at 90 min)", () => {
  assert.equal(scoreMatch({ ...base, minutes: 90, goals: 1 }), 2 + 1 + 5);
  assert.equal(scoreMatch({ ...base, minutes: 90, assists: 1 }), 2 + 1 + 3);
});

test("forward goal = 4, defender goal = 6, keeper goal = 6", () => {
  assert.equal(scoreMatch({ ...base, position: "FWD", minutes: 90, goals: 1 }), 2 + 4);
  assert.equal(scoreMatch({ ...base, position: "DEF", minutes: 90, goals: 1 }), 2 + 6 + 4); // +clean sheet
  assert.equal(scoreMatch({ ...base, position: "GK", minutes: 90, goals: 1 }), 2 + 6 + 4);
});

test("clean sheet only with 60+ min and 0 conceded", () => {
  // DEF, 90 min, 0 conceded => 2 + 4
  assert.equal(scoreMatch({ ...base, position: "DEF", minutes: 90 }), 6);
  // DEF, 45 min, 0 conceded => no clean sheet => 1
  assert.equal(scoreMatch({ ...base, position: "DEF", minutes: 45 }), 1);
  // MID clean sheet = 1
  assert.equal(scoreMatch({ ...base, position: "MID", minutes: 90 }), 2 + 1);
  // FWD clean sheet = 0
  assert.equal(scoreMatch({ ...base, position: "FWD", minutes: 90 }), 2);
});

test("keeper saves: +1 per 3, penalty save +5", () => {
  assert.equal(scoreMatch({ ...base, position: "GK", minutes: 90, saves: 6, goalsConceded: 2 }), 2 + 2 - 1);
  assert.equal(scoreMatch({ ...base, position: "GK", minutes: 90, penaltiesSaved: 1 }), 2 + 4 + 5);
});

test("goals conceded: -1 per 2 for GK/DEF only", () => {
  assert.equal(scoreMatch({ ...base, position: "DEF", minutes: 90, goalsConceded: 2 }), 2 - 1);
  assert.equal(scoreMatch({ ...base, position: "MID", minutes: 90, goalsConceded: 2 }), 2); // MID unaffected
});

test("cards and own goals (base MID 90 min = 2 appearance + 1 clean sheet = 3)", () => {
  assert.equal(scoreMatch({ ...base, minutes: 90, yellowCards: 1 }), 3 - 1);
  assert.equal(scoreMatch({ ...base, minutes: 90, redCards: 1 }), 3 - 3);
  assert.equal(scoreMatch({ ...base, minutes: 90, ownGoals: 1 }), 3 - 2);
  assert.equal(scoreMatch({ ...base, minutes: 90, penaltiesMissed: 1 }), 3 - 2);
});

test("captain doubles in squad total", () => {
  const starters = [
    { playerId: "a", points: 10 },
    { playerId: "b", points: 5 },
  ];
  assert.equal(scoreSquadGameweek(starters, "a"), 25); // 10*2 + 5
  assert.equal(scoreSquadGameweek(starters, null), 15);
});

test("resolveCaptain: captain played → captain wears armband", () => {
  assert.equal(resolveCaptain("cap", "vice", { cap: 90, vice: 90 }), "cap");
});

test("resolveCaptain: captain DNP → vice wears armband", () => {
  assert.equal(resolveCaptain("cap", "vice", { cap: 0, vice: 90 }), "vice");
  assert.equal(resolveCaptain("cap", "vice", { vice: 45 }), "vice"); // cap missing = 0
});

test("resolveCaptain: neither played → keeps captain (×2 of 0)", () => {
  assert.equal(resolveCaptain("cap", "vice", { cap: 0, vice: 0 }), "cap");
});

test("resolveCaptain: null vice → captain even if DNP", () => {
  assert.equal(resolveCaptain("cap", null, { cap: 0 }), "cap");
});
