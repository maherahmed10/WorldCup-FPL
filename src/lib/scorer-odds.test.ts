// Unit tests for judgement scorer odds. Run: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { judgementScorerOdds, SCORER_JUDGEMENT } from "./scorer-odds.js";
import { scorerMultiplier } from "./betting.js";

test("judgementScorerOdds returns curated odds for elite finishers", () => {
  assert.equal(judgementScorerOdds("E. Haaland"), 1.5);
  assert.equal(judgementScorerOdds("Kylian Mbappé"), 1.55);
  assert.equal(judgementScorerOdds("Rodri"), 6.0); // deep mid, rarely scores
});

test("judgementScorerOdds returns null for uncurated players (formula fallback)", () => {
  assert.equal(judgementScorerOdds("Some Unknown Player"), null);
});

test("elite finishers are priced lower than the position+price formula would", () => {
  // Haaland at £13.0m FWD: formula ≈ 1.6 floor; judgement 1.5 reflects his finishing.
  const judged = judgementScorerOdds("E. Haaland")!;
  const formula = scorerMultiplier("FWD", 130);
  assert.ok(judged <= formula, `judgement ${judged} should be ≤ formula ${formula}`);
});

test("every judgement value is a sensible decimal odd (1.4–8.0)", () => {
  for (const [name, odd] of Object.entries(SCORER_JUDGEMENT)) {
    assert.ok(odd >= 1.4 && odd <= 8.0, `${name} = ${odd} out of range`);
  }
});
