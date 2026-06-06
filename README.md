# WorldCup-FPL

An FPL-style fantasy game for the 2026 World Cup with a points-only prediction
layer. Pick a 15-player squad inside a 100M budget, captain scores double,
squads lock through the group stage then open for one transfer window per
knockout round. Plus side-bets settled from real match stats.

> Money/points are virtual. This is a prediction game, not a sportsbook.

See [`world-cup-fantasy-build-plan.md`](world-cup-fantasy-build-plan.md) for the full design.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 16** (App Router, TS, Tailwind) | One full-stack framework, one deploy (Vercel) |
| DB | **Postgres via Supabase** | Relational data + built-in Auth (deletes the auth workstream) |
| ORM | **Prisma 7** | `schema.prisma` is the shared "hour-one" data contract; `prisma studio` = free admin GUI |
| Auth | **Supabase Auth** | Magic-link / Google, zero auth code |
| Data feed | **API-Football** | Background job pulls → our DB. Nothing calls the API per user request. |

## Architecture rule (non-negotiable)

```
API-Football  →  background job (src/jobs)  →  our Postgres  →  every user request reads the DB
```

Never call API-Football on a per-user request. This keeps us inside the rate
limit and stops the app falling over when everyone opens it during a match.

## Quick start

```bash
# 1. Install
npm install

# 2. Env
cp .env.example .env.local      # then fill in Supabase + API-Football values

# 3. Confirm the API works on your plan (Step Zero)
npm run verify-api              # needs APISPORTS_KEY in env

# 4. Create the schema in your DB
npm run db:push                 # or: npm run db:migrate  (for tracked migrations)

# 5. Stub fake data so you're not blocked on the live feed
npm run seed

# 6. Run
npm run dev                     # http://localhost:3000
npm run db:studio               # browse the DB
```

### Don't have a DB yet? Two options

- **Shared Supabase (recommended)** — one person creates a free project at
  [supabase.com](https://supabase.com), shares the connection strings; everyone
  uses the same DB so leaderboards/leagues work across the team.
- **Local Docker (offline fallback)**:
  ```bash
  docker compose up -d
  # set DATABASE_URL and DIRECT_URL both to:
  #   postgresql://wcfpl:wcfpl@localhost:5432/wcfpl
  npm run db:push && npm run seed
  ```

## ⚠️ Will the API work? Run Step Zero first

`npm run verify-api` checks that the 2026 World Cup data (`league=1, season=2026`)
is live and reachable **on your plan**. Key caveats:

- The free tier (100 req/day) usually **excludes current-season paid leagues** —
  the World Cup likely needs a paid plan (~$19/mo). The verify script prints your
  plan + quota so you'll know immediately.
- **Player rosters fill in toward kickoff.** Teams + fixtures are live now; if
  `/players` returns empty, build the data layer but **delay player pricing**.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run verify-api` | Step Zero — confirm API key/plan reaches 2026 data |
| `npm run db:push` | Push schema to DB (no migration history) |
| `npm run db:migrate` | Create + apply a tracked migration |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run seed` | Stub fake teams/players/fixtures/league/squad |
| `npm run sync` | Background job: API-Football → DB (`-- teams\|fixtures\|players\|gameweeks` for one) |
| `npm run settle` | Post-match settlement: compute FPL points (`-- <apiFixtureId>` for one) |
| `npm test` | Run unit tests (scoring core) |

## Project layout

```
prisma/
  schema.prisma          # THE data model — agree changes here first (§9)
  seed.ts                # stub data so nobody waits on the live feed
src/
  lib/
    db.ts                # Prisma client singleton
    api-football.ts      # thin provider wrapper (the ONLY API surface)
    scoring.ts           # FPL scoring core (pure, unit-tested) (§3)
    scoring.test.ts      # `npm test`
    gameweeks.ts         # date-bucket gameweeks + transfer windows (§4)
    supabase/            # server + browser auth clients
  jobs/
    sync.ts              # API → DB caching job
    settle.ts            # post-match FPL settlement
scripts/
  verify-api.mjs         # Step Zero API check
```

## Build order (weekend flow, §10)

1. **Hour 1 (all 5):** agree `schema.prisma`, run `npm run seed`, everyone unblocked.
2. Data layer is done (this scaffold). In parallel:
   - **squad picker** — reads `Player` (price, position, country for max-3 rule)
   - **scoring/settlement** — extend `src/jobs/settle.ts`, bet settlement
   - **betting UI** — `Bet` model + market types in `schema.prisma`
   - **auth/leagues/leaderboard** — Supabase Auth + `League`/`LeagueMember`
3. Settlement runs as post-match jobs (cron / Vercel Cron calling `npm run settle`).

**Protect the core:** sign up → pick a budget squad → place a couple predictions
→ see points + leaderboard update after each match day.
