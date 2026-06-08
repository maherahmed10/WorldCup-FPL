// Squad-affordability check (ROADMAP 3.2). Pure helper used to sanity-check the
// price set: can a VALID 15-player squad (position quota + max-per-country) be
// built under budget, and is the priciest such squad over budget (so there are
// real trade-offs)? Greedy by price — cheapest gives an affordability ceiling,
// most-expensive gives a "you can't buy everyone" floor.

import type { Position } from "./squad-rules";

export interface PricedPlayer {
  id: string;
  position: Position;
  price: number; // tenths of a million
  country: string;
}

export interface SquadPick {
  picked: PricedPlayer[];
  total: number; // tenths
  feasible: boolean; // false if quotas couldn't be filled under the country cap
}

/**
 * Greedily assemble a valid squad. `order = "asc"` → cheapest feasible squad;
 * `"desc"` → most expensive. Honors per-position quota and max-per-country.
 */
export function pickSquad(
  players: PricedPlayer[],
  quota: Record<Position, number>,
  maxPerCountry: number,
  order: "asc" | "desc" = "asc",
): SquadPick {
  const sorted = [...players].sort((a, b) =>
    order === "asc" ? a.price - b.price : b.price - a.price,
  );
  const slots: Record<Position, number> = { ...quota };
  const countryCount = new Map<string, number>();
  const picked: PricedPlayer[] = [];
  const target = (Object.values(quota) as number[]).reduce((s, n) => s + n, 0);

  for (const p of sorted) {
    if (picked.length === target) break;
    if (slots[p.position] <= 0) continue;
    if ((countryCount.get(p.country) ?? 0) >= maxPerCountry) continue;
    picked.push(p);
    slots[p.position] -= 1;
    countryCount.set(p.country, (countryCount.get(p.country) ?? 0) + 1);
  }

  const feasible = picked.length === target;
  const total = picked.reduce((s, p) => s + p.price, 0);
  return { picked, total, feasible };
}
