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

## Quick start — joining the team (most people)

The shared Supabase DB is **already set up and loaded with real World Cup data**
(48 teams · 1,248 players · 72 fixtures). You just connect and build — no Docker,
no seed, no sync.

```bash
npm install
cp .env.example .env.local      # paste the shared values the maintainer sends you (DM)
npm run db:generate             # generate the Prisma client
npm run check                   # ✅ confirms you're connected: teams 48 · players 1248 · ...
npm run dev                     # http://localhost:3000
npm run db:studio               # optional: browse the real data
```

`.env.local` values come **privately** from the maintainer — they're not in the
repo (`.env.local` is git-ignored). Never commit secrets or paste them into a
logged channel.

> Every `Player.price` is currently **0** — pricing is a pre-launch step (§6).
> Build against price=0; real prices backfill later.

See [`TASKS.md`](TASKS.md) for who owns what + the per-lane test checklists.

## Maintainer setup — first-time / refresh (one person)

Only needed to stand up the DB or pull fresh data. Already done for the shared DB.

```bash
npm run verify-api      # confirm the API key + PRO plan reach season=2026
npm run db:push         # create tables from the schema
npm run sync            # pull real data: API-Football → DB (teams/fixtures/players)
npm run settle          # after matches: compute FPL points from /fixtures/players
```

> ⚠️ **API plan:** the World Cup (`season=2026`) requires a **paid plan** (Pro,
> ~$19/mo). The free tier is hard-blocked ("Free plans do not have access to this
> season"). `npm run verify-api` prints your plan + quota.
>
> ⚠️ **Roster source:** use `/players/squads?team=X` per team (done in the sync
> job) — `/players?league=...` returns 0 pre-tournament because it's stats-driven.
>
> ⚠️ **Supabase `DIRECT_URL`:** must use the **pooler** host on port 5432
> (`aws-...pooler.supabase.com`), NOT `db.<ref>.supabase.co` (IPv6-only, won't
> resolve on most networks). `DATABASE_URL` = same pooler host, port 6543.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run check` | Confirm your `.env.local` connects to the real shared DB |
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
