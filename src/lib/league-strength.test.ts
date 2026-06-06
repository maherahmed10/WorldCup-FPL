// Unit tests for league-strength weighting (build-plan §6). Run: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leagueWeight, DEFAULT_WEIGHT } from "./league-strength.js";

test("big-5 top flights weigh 1.0", () => {
  assert.equal(leagueWeight("Premier League", "England"), 1.0);
  assert.equal(leagueWeight("Ligue 1", "France"), 1.0);
  assert.equal(leagueWeight("La Liga", "Spain"), 1.0);
});

test("Serie A name clash resolved by country", () => {
  assert.equal(leagueWeight("Serie A", "Italy"), 1.0); // name rule? no — country fallback
  assert.equal(leagueWeight("Serie A", "Brazil"), 0.72); // Brazilian top flight
});

test("name rules beat country fallback (Champions League is elite regardless)", () => {
  assert.ok(leagueWeight("UEFA Champions League", "Spain") > 1.0);
  assert.equal(leagueWeight("AFC Champions League Elite", "Saudi Arabia"), 0.6);
});

test("lower divisions are discounted", () => {
  assert.ok(leagueWeight("Championship", "England") < leagueWeight("Premier League", "England"));
  assert.ok(leagueWeight("Ligue 2", "France") <= 0.5);
});

test("regional state leagues are weak", () => {
  assert.equal(leagueWeight("Paulista - A1", "Brazil"), 0.45);
});

test("internationals: friendlies weak, qualifiers moderate", () => {
  assert.equal(leagueWeight("Friendlies", null), 0.4);
  assert.equal(leagueWeight("World Cup - Qualification", "World"), 0.7);
  assert.equal(leagueWeight("UEFA Nations League", "World"), 0.8);
});

test("CONMEBOL continental cups matched by API name", () => {
  assert.equal(leagueWeight("CONMEBOL Libertadores", "World"), 0.8);
  assert.equal(leagueWeight("CONMEBOL Sudamericana", "World"), 0.68);
});

test("hyphenated multi-word countries resolve to their top flight", () => {
  assert.equal(leagueWeight("Chance Liga", "Czech-Republic"), 0.55);
});

test("'Pro League' name clash disambiguated by country", () => {
  assert.equal(leagueWeight("Pro League", "Belgium"), 0.78);
  assert.equal(leagueWeight("Pro League", "Saudi-Arabia"), 0.6);
});

test("unknown competition → neutral default", () => {
  assert.equal(leagueWeight("Some Obscure Cup", "Atlantis"), DEFAULT_WEIGHT);
  assert.equal(leagueWeight("", null), DEFAULT_WEIGHT);
});

test("country top-flight fallback when name isn't a known rule", () => {
  assert.equal(leagueWeight("Eliteserien", "Norway"), 0.55);
  assert.equal(leagueWeight("Liga Profesional Argentina", "Argentina"), 0.68);
});
