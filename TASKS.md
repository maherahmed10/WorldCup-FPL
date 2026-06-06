# Tasks — first assignments

Three of us. The app is split into three ownership lanes that barely overlap, so
we can all push in parallel. Each lane has a clear design reference, the DB
models it touches, and acceptance criteria for the first milestone.

> Foundation already done (on `main`): Next.js + Prisma + Supabase, the full data
> model, the API-Football sync + settlement jobs, the FPL scoring core (tested),
> and the design ported into `globals.css`. Everyone builds on top of this.

## Shared setup (everyone does this first, ~15 min)

```bash
git clone https://github.com/maherahmed10/WorldCup-FPL.git
cd WorldCup-FPL
npm install
cp .env.example .env.local      # paste the shared Supabase + API keys (group chat)
npm run db:generate
npm run seed                    # stub data so you're not blocked on the live feed
npm run dev                     # http://localhost:3000
```

Open `design/index.html` in a browser to see the clickable target design.

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

---

## Cross-cutting (whoever finishes first / pairs up)

- **Settlement → points pipeline:** `src/jobs/settle.ts` already computes
  per-player `fantasyPoints`. Next: aggregate to per-user GW totals + a
  leaderboard query. Touches everyone — pair on it.
- **Real API wiring:** run `npm run verify-api`, then `npm run sync` once the key
  + plan are confirmed (see README "Will the API work?").
- **Player pricing:** the sync sets `price=0`; we hand-tier prices before launch
  (build plan §6).

## Coordination rules

- Stay in your routes/components. Shared files (`schema.prisma`, `globals.css`,
  `layout.tsx`, app shell, `src/components/*`) → flag in chat before editing.
- See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branch/merge workflow.
- Merge conflicts you can't untangle → push the branch, ask for help.
