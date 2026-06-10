import {
  SQUAD_QUOTA,
  MAX_PER_COUNTRY,
  BUDGET,
  type Position,
  type SquadPlayer,
} from "./squad-rules";

const POS_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];

/**
 * Build a sensible template squad from the player pool.
 * Returns the IDs of the 15 chosen players, or an empty array if no valid squad
 * can be constructed (shouldn't happen with a real 700+ player pool).
 *
 * Phase 1 — Greedy: pick the highest-priced player at each position slot while
 *   respecting the max-3-per-country rule (ignoring the budget).
 * Phase 2 — Trim: repeatedly replace the player whose swap saves the most money
 *   until the total fits within BUDGET.
 */
export function buildTemplateSquad(pool: SquadPlayer[]): string[] {
  // Sort each position's pool by price descending
  const byPos: Record<Position, SquadPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of pool) {
    const pos = p.position as Position;
    if (byPos[pos]) byPos[pos].push(p);
  }
  for (const pos of POS_ORDER) byPos[pos].sort((a, b) => b.price - a.price);

  const chosen: SquadPlayer[] = [];
  const cc: Record<string, number> = {}; // country counts

  // Phase 1: greedy pick, ignore budget
  for (const pos of POS_ORDER) {
    let added = 0;
    for (const p of byPos[pos]) {
      if (added >= SQUAD_QUOTA[pos]) break;
      if ((cc[p.country] ?? 0) >= MAX_PER_COUNTRY) continue;
      chosen.push(p);
      cc[p.country] = (cc[p.country] ?? 0) + 1;
      added++;
    }
    if (added < SQUAD_QUOTA[pos]) return []; // pool too small to fill this position
  }

  // Phase 2: swap expensive players with cheaper replacements until within BUDGET.
  // byPos[pos] is sorted price-desc, so iterating from the end = cheapest first.
  let spent = chosen.reduce((s, p) => s + p.price, 0);

  for (let iter = 0; iter < 60 && spent > BUDGET; iter++) {
    const chosenIds = new Set(chosen.map((p) => p.id));
    let bestSwap: { idx: number; replacement: SquadPlayer; saving: number } | null = null;

    for (let i = 0; i < chosen.length; i++) {
      const cur = chosen[i];
      const pos = cur.position as Position;

      // Walk from cheapest end toward most-expensive — first viable candidate = max saving for cur
      for (let j = byPos[pos].length - 1; j >= 0; j--) {
        const cand = byPos[pos][j];
        if (cand.price >= cur.price) break; // no further savings (ascending from here)
        if (chosenIds.has(cand.id)) continue;
        // When removing cur, its country slot frees up — adjust count for same-country swaps
        const occupancy =
          (cc[cand.country] ?? 0) - (cand.country === cur.country ? 1 : 0);
        if (occupancy >= MAX_PER_COUNTRY) continue;
        const saving = cur.price - cand.price;
        if (!bestSwap || saving > bestSwap.saving) {
          bestSwap = { idx: i, replacement: cand, saving };
        }
        break; // cheapest viable for cur found — move on to next cur
      }
    }

    if (!bestSwap) break; // no further swap possible

    const old = chosen[bestSwap.idx];
    chosen[bestSwap.idx] = bestSwap.replacement;
    cc[old.country]--;
    if (cc[old.country] === 0) delete cc[old.country];
    cc[bestSwap.replacement.country] = (cc[bestSwap.replacement.country] ?? 0) + 1;
    spent -= bestSwap.saving;
  }

  return spent <= BUDGET ? chosen.map((p) => p.id) : [];
}
