// Unit tests for store + perk helpers. Run: `npm test`.
// No DB / no network — pure functions only.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAffordPerk,
  hasActivePerk,
  getMaxPerCountry,
  getCaptainMultiplier,
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

// ── extra captain perk ──────────────────────────────────────────────────────

test("getCaptainMultiplier: returns 2 without perk, 3 with extra_captain for matching GW", () => {
  assert.equal(getCaptainMultiplier([], "gw1"), 2);

  const withPerk: PerkLike[] = [
    { storeItemId: "perk_extra_captain", gameweekId: "gw1", usedAt: null },
  ];
  assert.equal(getCaptainMultiplier(withPerk, "gw1"), 3);
});

test("getCaptainMultiplier: perk for gw1 does NOT apply in gw2 (expires after its GW)", () => {
  const perks: PerkLike[] = [
    { storeItemId: "perk_extra_captain", gameweekId: "gw1", usedAt: null },
  ];
  assert.equal(getCaptainMultiplier(perks, "gw2"), 2);
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
