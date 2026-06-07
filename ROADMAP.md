# Roadmap — what's left to build

The core app is working end-to-end: sign up → name team → pick a 15-player squad
→ save → see it on your dashboard → place predictions → create/join leagues →
browse fixtures. This doc lists what's **left**, grouped so anyone can grab a
task. Each task has: files, what "done" looks like, and the tests to add.

> Conventions: stay in your area, branch off `main`, `npm run build` + `npm test`
> must pass before merge. See [CONTRIBUTING.md](CONTRIBUTING.md). Pure logic goes
> in `src/lib/*.ts` with a `*.test.ts` next to it (pattern: `scoring.test.ts`).

**Tests today: 53 passing.** Each task below says how many it should add.

---

## ✅ Done (don't redo)

- **Auth + shell** — Supabase (Google + email), app shell, name-your-team.
- **Squad picker** — 15-player FPL squad, £100m budget, max-3-country, formation,
  drag-to-sub, captain, save. Dashboard renders the saved squad.
- **Players** — full pool with judgement pricing, filters.
- **Predictions** — match odds (real, from API `/odds`), scorer odds (judgement +
  formula), bet slip writes `Bet` rows, points wallet.
- **Leagues** — create/join by code, standings query (reads real `fantasyPoints`).
- **Fixtures** — schedule by gameweek + group tables.
- **Data layer** — sync (teams/fixtures/players/standings/odds), settlement of
  per-player `fantasyPoints`.

---

## 🔴 Priority 1 — the scoring loop (makes the whole game "live")

Without these, every points total shows **0**. This is the highest-value work.

### 1.1 — Settle bets after matches
**Why:** bets are placed but never resolved — they sit `OPEN` forever.
**Files:** `src/jobs/settle.ts` (extend), `src/lib/betting.ts`
**Models:** `Bet`, `PlayerMatchStat`, `FixtureOdds`
- [ ] After a fixture finishes, resolve each `Bet` on it: WON/LOST/VOID.
- [ ] Match markets: compare `Bet.selection` (HOME/DRAW/AWAY, OVER_2.5, BTTS_YES…)
      to the final score. Player props (`scorer:<id>`): WON if that player has a
      goal in `PlayerMatchStat`.
- [ ] Set `payout` using `payout(stake, multiplier, status)` (already in betting.ts).
- [ ] Idempotent — re-running settle doesn't double-pay.
- **Tests (+4):** `settleBet` resolution for each market type (correct/incorrect),
      void handling, scorer win from match stats.

### 1.2 — Wire real GW + total points into the dashboard
**Why:** `team/page.tsx` hardcodes `gwPoints = {}` and `Total Points = 0`.
**Files:** `src/app/(app)/team/page.tsx`, `src/lib/squad-data.ts` (helper)
**Models:** `Squad`, `SquadPlayer`, `PlayerMatchStat`
- [ ] Compute each starting player's GW points from `PlayerMatchStat.fantasyPoints`
      for the current gameweek's fixtures (captain ×2 — use `scoreSquadGameweek`).
- [ ] Show real "This Round" + "Total Points" (sum across gameweeks).
- [ ] Pitch tokens show real points (the `gwPoints` map).
- **Tests (+2):** GW total with captain doubling; total across multiple gameweeks
      (extend `scoring.test.ts` or a new `squad-points.test.ts`).

### 1.3 — Leaderboard aggregation + per-user ranks
**Why:** league standings read points but there's no overall rank / GW movement.
**Files:** `src/lib/leagues.ts`, `src/app/(app)/leagues/page.tsx`
- [ ] Per-user season total + per-gameweek total, ranked. Rank movement vs last GW.
- **Tests (+2):** ranking sort (ties → stable), GW-delta calc.

---

## 🟡 Priority 2 — gameplay features

### 2.1 — Switch betting from "points" to MONEY (the bank)  ⭐ requested
**Why:** unify the economy — bet with the same money you build your squad from,
instead of a separate 1000-point wallet.
**Files:** `src/lib/betting.ts`, `src/app/(app)/predict/*`, schema (maybe a
`Wallet`/`balance` on `User`)
**Design decision to lock first** (ask the group): is the betting bank…
  - (a) the **leftover squad budget** (e.g. spent £95m of £100m → £5m to bet), or
  - (b) a **separate cash balance** topped up by performance, or
  - (c) a fixed **starting bankroll** per user (e.g. £100m of "virtual cash")?
- [ ] Replace `STARTING_BALANCE` points with a money balance (store on `User`
      or a `Wallet` row so it persists; right now it's derived from bets only).
- [ ] Stakes + payouts in money; bet slip shows £ not pts.
- [ ] Deduct stake on placement, credit payout on settlement (ties into 1.1).
- **Tests (+3):** balance after stake/win/loss in money; can't bet more than bank;
      payout rounding in £.
> Keep it points-compatible at the math layer — `betting.ts` already separates
> the number from the logic, so this is mostly a rename + a persisted balance.

### 2.2 — The Store (spend winnings on perks)  ⭐ requested
**Why:** give accumulated money/points a purpose — a shop of one-off boosts.
**Files:** new `src/app/(app)/store/*`, `src/lib/store.ts`, schema
(`StoreItem`, `UserPurchase` / `UserPerk`)
**Starter catalogue (tune prices later):**
  | Perk | Effect |
  |---|---|
  | **+1 country slot** | raise max-per-country from 3 → 4 for your squad |
  | **Extra captain (2× → 3×)** | one gameweek, captain scores triple |
  | **Extra transfer** | one free transfer outside the normal window |
  | **Bench boost** | bench players' points count for one gameweek |
  | **Wildcard** | rebuild the whole squad once, free |
- [ ] `StoreItem` (name, cost, effect key, one-shot/duration) + `UserPerk`
      (which user owns/activated what, for which gameweek).
- [ ] Store page: list items, buy (deduct balance), show owned/active perks.
- [ ] Each perk hooks its effect: e.g. "+1 country slot" feeds `MAX_PER_COUNTRY`
      in `squad-rules.ts` per-user; "extra captain" feeds `scoreSquadGameweek`.
- **Tests (+4):** can't buy over balance; perk applies its effect (country limit
      raised, captain ×3, etc.); perk expires after its gameweek.
> Build the catalogue + purchase flow first; wire each effect incrementally —
> they're independent, so this can be split across people.

### 2.3 — Transfers (knockout windows)
**Why:** `transfers/page.tsx` is a stub. Squads lock through the group stage,
then one window opens per knockout round (R32, R16, QF, SF, Final).
**Files:** `src/app/(app)/transfers/*`, `src/lib/squad-rules.ts`, server action
**Models:** `Squad`, `SquadPlayer`, `Gameweek` (`isKnockout`)
- [ ] Only open when the current gameweek `isKnockout`. Swap players in/out within
      budget + all squad rules. New `Squad` row per knockout window (valid-from).
- [ ] Eliminated players (their nation is out) score 0 until transferred.
- [ ] Transfer cap per window (TBD — unlimited is simplest for v1).
- **Tests (+3):** transfer respects budget/quota/country; window-closed rejection;
      eliminated-player handling.

### 2.4 — Bench auto-subs (FPL rule)
**Why:** if a starter's nation is eliminated / they don't play, auto-sub from the
bench (first valid sub that keeps a legal formation).
**Files:** `src/lib/squad-rules.ts` (logic), settlement
- [ ] At settlement, swap non-playing starters for the first eligible bench player.
- **Tests (+3):** auto-sub picks first valid bench player; skips if it breaks
      formation; GK only subs GK.

---

## 🟢 Priority 3 — polish & ops

### 3.1 — Scheduled syncing (cron)
**Why:** data is synced manually. During the tournament it should refresh itself.
**Files:** `vercel.json` (or a cron route), `src/jobs/*`
- [ ] Cron: `sync` (fixtures/odds) a few times daily; `settle` after match windows.
- [ ] `npm run sync -- odds` near kickoffs (7-day odds window).

### 3.2 — Player pricing review
**Why:** prices are judgement-tiered; sanity-check before launch.
**Files:** `src/lib/players.ts` / pricing source (Lane 2's area)
- [ ] Spot-check tiers; ensure a valid 15 fits under £100m with real trade-offs.

### 3.3 — Real flags everywhere / empty states / loading
- [ ] Audit every screen for the `Flag` 2-letter fallback (countries.ts now
      resolves all 48, but double-check new surfaces).
- [ ] Loading skeletons + empty states (design has `.skel`, `.empty`).

### 3.4 — Settle player props beyond scorer
**Why:** only `scorer` props exist. Plan also lists assist / card markets.
**Files:** `src/lib/betting.ts`, predict page, settlement
- [ ] Add `assist` / `card` markets (fixed multipliers exist already) + settle them.
- **Tests (+2):** assist/card settlement from `PlayerMatchStat`.

---

## 🧪 Test summary

| Area | Tests now | After roadmap (target) |
|---|---|---|
| scoring | ✅ | +2 (GW totals, multi-GW) |
| squad-rules | ✅ | +6 (transfers, auto-sub, store country-slot) |
| betting | ✅ | +9 (settle, money economy, store) |
| leagues | ✅ | +2 (ranking, GW delta) |
| scorer-odds | ✅ | — |
| **new** store / perks | — | +4 |
| **Total** | **53** | **~75+** |

Always: `npm run build` + `npm test` green before merge.

---

## How to pick up a task

1. Comment your name next to a task (or in the group chat) so two people don't
   collide.
2. Branch: `feat/<area>-<thing>` (e.g. `feat/betting-money`, `feat/store`).
3. Build it, add the tests, `npm run build` + `npm test`.
4. Pull `main`, merge it into your branch, resolve conflicts, then merge to `main`.

**Suggested grab order** (highest impact first): **1.1 bet settlement** and
**1.2 dashboard points** make the game feel alive — do those first. **2.1 money
betting** and **2.2 the store** are the fun differentiators. Transfers (2.3) and
auto-subs (2.4) matter once the knockouts approach.
