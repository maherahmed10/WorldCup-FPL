// Unit tests for store + perk helpers. Run: `npm test`.
// No DB / no network — pure functions only.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAffordPerk,
  hasActivePerk,
  getMaxPerCountry,
  type PerkLike,
} from "./store.js";

// ── purchase guard ──────────────────────────────────────────────────────────

test("canAffordPerk: returns true when balance >= cost", () => {
  assert.equal(canAffordPerk(500, 500), true);
  assert.equal(canAffordPerk(1000, 300), true);
});

test("canAffordPerk: returns false when balance < cost", () => {
  assert.equal(canAffordPerk(100, 200), false);
  assert.equal(canAffordPerk(0, 1), false);
});

// ── country slot perk (removed from catalogue — always returns 3) ───────────

test("getMaxPerCountry: always returns 3 (country_slot removed from catalogue)", () => {
  assert.equal(getMaxPerCountry([]), 3);
  // Even if a legacy perk_country_slot row somehow exists, it has no effect now.
  const legacy: PerkLike[] = [
    { storeItemId: "perk_country_slot", gameweekId: null, usedAt: null },
  ];
  assert.equal(getMaxPerCountry(legacy), 3);
});

// ── extra captain perk (lets you name a 2nd captain — bound to its GW) ───────

test("hasActivePerk: extra_captain active for its GW, not another", () => {
  const perks: PerkLike[] = [
    { storeItemId: "perk_extra_captain", gameweekId: "gw1", usedAt: null },
  ];
  assert.equal(hasActivePerk(perks, "extra_captain", "gw1"), true);
  assert.equal(hasActivePerk(perks, "extra_captain", "gw2"), false);
  assert.equal(hasActivePerk([], "extra_captain", "gw1"), false);
});

// ── hasActivePerk general ───────────────────────────────────────────────────

test("hasActivePerk: consumed perk is inactive regardless of GW", () => {
  const used: PerkLike[] = [
    { storeItemId: "perk_extra_captain", gameweekId: "gw1", usedAt: new Date() },
  ];
  assert.equal(hasActivePerk(used, "extra_captain", "gw1"), false);
});

test("hasActivePerk: unknown effectKey always returns false", () => {
  const perks: PerkLike[] = [
    { storeItemId: "perk_country_slot", gameweekId: null, usedAt: null },
  ];
  // @ts-expect-error testing unknown key
  assert.equal(hasActivePerk(perks, "nonexistent"), false);
});
