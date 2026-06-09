// ─────────────────────────────────────────────────────────────────────────────
// Store catalogue + per-user perk helpers. Pure functions — no DB, no React —
// so they unit-test cleanly (see store.test.ts).
//
// StoreItem rows are seeded by scripts/migrate-money-store.ts. The IDs here
// must match the IDs in that script.
// ─────────────────────────────────────────────────────────────────────────────

// Costs are in £ (same unit as User.bettingBalance — 1_000_000 = £1M). The store
// unlocks after the group stage, when the user's bank = leftover squad budget +
// the £5M stipend ± betting P&L, so prices sit in the £1–3M band.
export const STORE_ITEMS = [
  {
    id: "perk_extra_captain",
    name: "Extra Captain",
    description: "Your captain scores triple points for one gameweek.",
    cost: 2_000_000,
    effectKey: "extra_captain" as const,
  },
  {
    id: "perk_extra_transfer",
    name: "Extra Transfer",
    description: "One free transfer outside the normal transfer window.",
    cost: 1_000_000,
    effectKey: "extra_transfer" as const,
  },
  {
    id: "perk_bench_boost",
    name: "Bench Boost",
    description: "Your bench players' points count for one full gameweek.",
    cost: 3_000_000,
    effectKey: "bench_boost" as const,
  },
] as const;

export type PerkKey = (typeof STORE_ITEMS)[number]["effectKey"];

/** Minimal perk shape needed by the pure helpers — no DB import. */
export interface PerkLike {
  storeItemId: string;
  gameweekId: string | null;
  usedAt: Date | null;
}

/** Can the user afford this perk? */
export function canAffordPerk(balance: number, cost: number): boolean {
  return balance >= cost;
}

/**
 * Is a given perk currently active for this user?
 *   - usedAt must be null (not yet consumed).
 *   - If the perk is GW-scoped (gameweekId set on the perk row) AND a gameweekId
 *     is supplied, they must match. Permanent perks (gameweekId = null on the row)
 *     are always active regardless of which GW is queried.
 */
export function hasActivePerk(
  perks: PerkLike[],
  effectKey: PerkKey,
  gameweekId?: string,
): boolean {
  const item = STORE_ITEMS.find((s) => s.effectKey === effectKey);
  if (!item) return false;
  return perks.some((p) => {
    if (p.storeItemId !== item.id) return false;
    if (p.usedAt !== null) return false;
    // If the perk is bound to a specific GW and the caller wants a different GW → inactive.
    if (p.gameweekId !== null && gameweekId && p.gameweekId !== gameweekId) return false;
    return true;
  });
}

/** Max players per country: always 3 (country_slot perk removed from catalogue). */
export function getMaxPerCountry(_perks: PerkLike[]): number {
  return 3;
}

/** Captain multiplier for a gameweek: 2 normally, 3 with extra_captain perk. */
export function getCaptainMultiplier(perks: PerkLike[], gameweekId: string): number {
  return hasActivePerk(perks, "extra_captain", gameweekId) ? 3 : 2;
}
