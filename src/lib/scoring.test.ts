// Unit tests for the FPL scoring core (build-plan §3). Run: `npm test`.
// No DB / no network — pure function tests, so the core is provably correct
// before any feed is wired.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreMatch, scoreSquadGameweek, resolveCaptain, resolveCaptains, breakdownMatch, eventPoints, type MatchStatLine } from "./scoring.js";

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

test("two captains both double (Extra Captain perk)", () => {
  const starters = [
    { playerId: "a", points: 10 },
    { playerId: "b", points: 5 },
    { playerId: "c", points: 3 },
  ];
  // a + b both captained → 10*2 + 5*2 + 3 = 33
  assert.equal(scoreSquadGameweek(starters, ["a", "b"]), 33);
  assert.equal(scoreSquadGameweek(starters, new Set(["a", "b"])), 33);
});

test("resolveCaptains: primary + 2nd captain, vice rule on primary only", () => {
  // primary played, 2nd captain set → both armbands
  assert.deepEqual(
    resolveCaptains("cap", "vice", "cap2", { cap: 90, cap2: 90 }),
    new Set(["cap", "cap2"]),
  );
  // primary DNP → vice takes primary's ×2, 2nd captain still doubles
  assert.deepEqual(
    resolveCaptains("cap", "vice", "cap2", { cap: 0, vice: 90, cap2: 90 }),
    new Set(["vice", "cap2"]),
  );
  // no 2nd captain → single armband
  assert.deepEqual(
    resolveCaptains("cap", "vice", null, { cap: 90 }),
    new Set(["cap"]),
  );
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

test("breakdownMatch: itemises and sums to scoreMatch", () => {
  const s: MatchStatLine = { position: "FWD", minutes: 90, goals: 2, assists: 1, yellowCards: 1, redCards: 0, saves: 0, penaltiesSaved: 0, penaltiesMissed: 0, goalsConceded: 1, ownGoals: 0 };
  const bd = breakdownMatch(s);
  const sum = bd.reduce((t, c) => t + c.pts, 0);
  assert.equal(sum, scoreMatch(s)); // breakdown sums to the total
  // FWD: 60+min (2) + 2 goals (8) + 1 assist (3) − 1 yellow (1) = 12
  assert.equal(sum, 12);
  assert.ok(bd.some((c) => c.label.includes("goal")));
});

test("breakdownMatch: GK clean sheet + saves", () => {
  const s: MatchStatLine = { position: "GK", minutes: 90, goals: 0, assists: 0, yellowCards: 0, redCards: 0, saves: 6, penaltiesSaved: 0, penaltiesMissed: 0, goalsConceded: 0, ownGoals: 0 };
  const bd = breakdownMatch(s);
  assert.equal(bd.reduce((t, c) => t + c.pts, 0), scoreMatch(s)); // 2 + 4 (CS) + 2 (saves) = 8
  assert.ok(bd.some((c) => c.label === "Clean sheet"));
});

test("eventPoints: goal value by position, cards flat, own goal", () => {
  assert.equal(eventPoints("Goal", "Normal Goal", "FWD"), 4);
  assert.equal(eventPoints("Goal", "Normal Goal", "DEF"), 6);
  assert.equal(eventPoints("Goal", "Own Goal", "DEF"), -2);
  assert.equal(eventPoints("Card", "Yellow Card", null), -1);
  assert.equal(eventPoints("Card", "Red Card", null), -3);
  assert.equal(eventPoints("subst", "Substitution 1", null), null);
  assert.equal(eventPoints("Goal", "Normal Goal", null), null); // unknown position
});
