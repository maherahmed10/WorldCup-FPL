# Tasks — first assignments

> **The first round of lanes (squad / players / predict / leagues / fixtures) is
> built and merged.** For what's LEFT to do — bet settlement, real points, money
> betting, the store, transfers, etc. — see **[ROADMAP.md](ROADMAP.md)** and grab
> a task there. This file is kept for the original lane assignments / reference.

Three of us. The app is split into three ownership lanes that barely overlap, so
we can all push in parallel. Each lane has a clear design reference, the DB
models it touches, and acceptance criteria for the first milestone.

> Foundation already done (on `main`): Next.js + Prisma + Supabase, the full data
> model, the API-Football sync + settlement jobs, the FPL scoring core (tested),
> and the design ported into `globals.css`. Everyone builds on top of this.
>
> **✅ The shared Supabase DB is already loaded with REAL World Cup data:**
> **48 teams · 1,248 players · 72 fixtures · 8 gameweeks.** You do NOT need Docker
> and you do NOT need to run `seed` or `sync` — just connect and build.

## Shared setup (everyone does this first, ~10 min)

```bash
git clone https://github.com/maherahmed10/WorldCup-FPL.git
cd WorldCup-FPL
npm install
cp .env.example .env.local      # then paste the shared values Youssef sends you (DM, not the repo)
npm run db:generate             # generates the Prisma client from the schema
npm run dev                     # http://localhost:3000
npm run db:studio               # optional: browse the 1,248 real players in the DB
```

**The `.env.local` values come from Youssef privately** (Supabase URLs + keys, API
key). They are NOT in the repo — `.env.local` is git-ignored on purpose. Never
commit it or paste secrets into the repo / a logged channel.

> Heads-up: every `Player.price` is currently **0** — pricing is a pre-launch step
> (build plan §6). Build the picker/list against price=0; real prices backfill later.

Open `design/index.html` in a browser to see the clickable target design.

## Sanity check — confirm your setup works (everyone)

After setup, run this. If it prints the counts, you're fully connected to the real DB:

```bash
npm run check          # prints: teams 48 · players 1248 · fixtures 72
```

(If `npm run check` errors with a DB connection problem, your `.env.local` is wrong
— most likely `DIRECT_URL` must use the **pooler** host on port 5432, not
`db.<ref>.supabase.co`. Ask Youssef.)

---

## Lane 1 — Youssef · Auth + App Shell + My Team / Squad

**You own the spine everyone plugs into**, so do the shell early and merge it so
others can mount their screens inside it.

**Branch:** `feat/shell-and-team`
**Routes:** `src/app/team/*`, the app shell (sidebar + mobile tabbar), auth
**Design refs:** `design/app.jsx` (shell), `design/screens_auth.jsx`,
`design/screens_dash.jsx`, `design/screens_squad.jsx`, `design/squadlib.jsx`
**Models:** `User`, `Squad`, `SquadPlayer`, `Player`

**First milestone — acceptance criteria:**
- [ ] Supabase Auth login (magic-link or Google) — real session, `User` row created
- [ ] App shell ported: desktop sidebar + mobile tab bar (the `NAV` from `app.jsx`),
      wrapping all `/team`, `/players`, `/predict`, `/leagues`, `/fixtures` routes
- [ ] **My Team** dashboard: pitch view of starting XI, captain/vice badges,
      GW points, deadline countdown (`design/screens_dash.jsx`)
- [ ] **Squad picker**: 15 players, 100M budget bar, formation, **max-3-per-country**
      rule enforced, captain/vice select → saves `Squad` + `SquadPlayer`
- [ ] Builds, lints, merged to `main`

**How you test this lane:**
- [ ] **Unit test the squad-validation rules** (pure functions, no DB). Put them in
      `src/lib/squad-rules.ts` + `src/lib/squad-rules.test.ts`, run with `npm test`.
      Cover: exactly 15 players (2 GK / 5 DEF / 5 MID / 3 FWD), total price ≤ 100.0,
      **max 3 per country**, valid starting XI formation (1 GK; 3–5 DEF; 2–5 MID;
      1–3 FWD = 11). These mirror the FPL rules and the existing `scoring.test.ts`.
- [ ] **Manual:** log in (real Supabase Auth), confirm a `User` row appears in
      `npm run db:studio`. Build a squad, save it, confirm `Squad` + 15 `SquadPlayer`
      rows are written. Try to break the rules (4 from one country, over budget) →
      the UI must block it.
- [ ] `npm run build` passes before merge.

> ⚠️ The app shell + `layout.tsx` are shared files — land the shell early in one
> focused PR so B and C can branch off it.

---

## Lane 2 — Teammate B · Players + Predictions

**Branch:** `feat/players-predict`
**Routes:** `src/app/players/*`, `src/app/predict/*`
**Design refs:** `design/screens_market.jsx`, `design/playerlist.jsx`,
`design/screens_predict.jsx`
**Models:** `Player`, `Bet` (+ `MarketType`), reads `Fixture`

**First milestone — acceptance criteria:**
- [ ] **Players** page: list the `Player` pool from the DB with filter bar
      (position, country, price, search) and form sparkline — `design/screens_market.jsx`
- [ ] Reusable `PlayerRow` + `FilterBar` components in `src/components/`
      (Youssef's squad picker will reuse these — coordinate the prop shape early)
- [ ] **Predictions** page: render markets per upcoming fixture (1X2, O/U 2.5,
      BTTS, anytime scorer), a stake balance, a bet slip that writes `Bet` rows
- [ ] Open bets + settled bets sections (`design/screens_predict.jsx`)
- [ ] Builds, lints, merged to `main`

**How you test this lane:**
- [ ] **Unit test the bet math** (pure functions, no DB). Put `payout(stake,
      multiplier, won)` and any stake-balance logic in `src/lib/betting.ts` +
      `src/lib/betting.test.ts`, run with `npm test`. Cover: won → `stake *
      multiplier`, lost → 0, can't stake more than balance, void → stake returned.
- [ ] **Manual — Players:** load `/players`, confirm **1,248 real players** render
      (Mbappé, Messi, etc. — note prices show 0 until pricing lands; that's fine).
      Filter by position/country/search and confirm the list narrows correctly.
- [ ] **Manual — Predictions:** place a bet → confirm a `Bet` row is written
      (`npm run db:studio`), balance decreases, the bet shows in "open bets".
- [ ] `npm run build` passes before merge.

> The player-prop markets (scorer/assist/card) are **our own markets with fixed
> point values** — see build plan §7. Match markets can use placeholder odds for
> now; real odds wiring comes later.

---

## Lane 3 — Teammate C · Leagues + Fixtures + Leaderboard data

**Branch:** `feat/leagues-fixtures`
**Routes:** `src/app/leagues/*`, `src/app/fixtures/*`
**Design refs:** `design/screens_leagues.jsx`, `design/screens_more.jsx`
**Models:** `League`, `LeagueMember`, `Fixture`, `Gameweek`, `Team`

**First milestone — acceptance criteria:**
- [ ] **Leagues**: create a league (generates a join code) + join by code →
      writes `League` / `LeagueMember`
- [ ] League standings table: members ranked by total points, GW points, rank
      movement (`design/screens_leagues.jsx`). Points aggregation can read a
      helper — coordinate with Youssef on where squad-GW-points are computed.
- [ ] **Fixtures**: schedule grouped by round/gameweek + group standings tables
      (`design/screens_more.jsx`). Reads `Fixture` joined to `Team`, bucketed by
      `Gameweek`.
- [ ] Builds, lints, merged to `main`

**How you test this lane:**
- [ ] **Unit test pure helpers** (no DB): join-code generation (unique, right
      format) and standings sort (points → goal difference → goals for). Put them
      in `src/lib/leagues.ts` + `src/lib/leagues.test.ts`, run with `npm test`.
- [ ] **Manual — Leagues:** create a league → confirm a `League` row + your
      `LeagueMember` row in `npm run db:studio`. From a second account, join by the
      code → confirm a second `LeagueMember` row and both appear in the standings.
- [ ] **Manual — Fixtures:** load `/fixtures`, confirm the **72 real fixtures**
      render grouped by gameweek (first one: Mexico vs South Africa, Jun 11), with
      correct team names/flags.
- [ ] `npm run build` passes before merge.

---

## Cross-cutting (whoever finishes first / pairs up)

- **Settlement → points pipeline:** `src/jobs/settle.ts` already computes
  per-player `fantasyPoints`. Next: aggregate to per-user GW totals + a
  leaderboard query. Touches everyone — pair on it.
- **✅ Real API wiring is DONE:** the shared DB already has 48 teams / 1,248
  players / 72 fixtures. To refresh later (new fixtures, post-match stats), the
  maintainer runs `npm run sync` / `npm run settle`. You don't need to.
- **Player pricing:** the sync sets `price=0`; we hand-tier prices before launch
  (build plan §6). Until then, build against price=0.

## Testing — the shared bar (everyone)

We keep it light but real. Two gates before you merge to `main`:

1. **`npm run build` must pass** — this is the one hard rule for `main`.
2. **`npm test` must pass** — runs every `*.test.ts` under `src/`. If you wrote
   pure logic (squad rules, bet math, standings sort), it has a unit test.

Pattern to copy: `src/lib/scoring.test.ts` — pure functions, `node:test` +
`node:assert`, no DB or network. Keep business rules in a pure `src/lib/*.ts`
file and test that; don't bury rules inside React components where they can't be
tested. UI itself we verify manually (the "Manual" checks in each lane).

Quick reference:
- `npm run check` — confirm you're connected to the real shared DB
- `npm test` — run all unit tests
- `npm run build` — must pass before merge
- `npm run db:studio` — eyeball what your code wrote to the DB

## Coordination rules

- Stay in your routes/components. Shared files (`schema.prisma`, `globals.css`,
  `layout.tsx`, app shell, `src/components/*`) → flag in chat before editing.
- See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branch/merge workflow.
- Merge conflicts you can't untangle → push the branch, ask for help.
