# GAFFER — World Cup 2026 Fantasy · Handoff Doc

> **For:** next AI continuing this project in Antigravity (or any other agent)
> **Branch:** `feat/leagues-fixtures`
> **Date:** 2026-06-06

---

## What this project is

FPL-style fantasy game for the 2026 World Cup. Three-person sprint, split into lanes:

- **Lane 1 — Auth + App Shell + My Team** (Youssef) — stubs only, NOT started
- **Lane 2 — Players + Predictions** (Teammate B) — stubs only, NOT started
- **Lane 3 — Leagues + Fixtures** (Maher, this branch) — **DONE**, except one active bug (see below)

The shared Supabase DB already has real data: **48 teams · 1,248 players · 72 fixtures · 8 gameweeks**. Do not re-seed or re-sync unless you know what you're doing.

---

## Tech stack

| Thing | Version / detail |
|---|---|
| Next.js | 16.2.7 — App Router, Server Components, Server Actions |
| Prisma | 7 — uses `@prisma/adapter-pg` driver adapter (NOT the default query engine) |
| Database | Supabase PostgreSQL (shared, real data) |
| Auth | Supabase Auth — `@supabase/ssr`, `createClient()` from `@/lib/supabase/server` |
| Tests | `node:test` + `node:assert/strict` — run with `npm test` |
| TypeScript | strict mode (`noImplicitAny: true`) |

**Critical Next.js gotcha:** This is Next.js 16 (cutting-edge). APIs may differ from training data. Read `node_modules/next/dist/docs/` before writing any Next.js-specific code. `export const dynamic = "force-dynamic"` is the correct way to opt out of static generation for DB-dependent pages (NOT `unstable_noStore` from `next/cache` — that module doesn't exist here).

**Critical Prisma gotcha:** `db.ts` uses `PrismaPg` adapter — the generated client must match `prisma/schema.prisma`. After any schema change run `npm run db:generate`. `prisma db push` does NOT work (it loads `.env` via `prisma.config.ts`, but secrets live in `.env.local`). Use raw SQL via `db.$executeRawUnsafe(...)` for direct column changes.

**TypeScript strict mode + Prisma:** `db.findMany()` resolves as `any` under strict mode. The pattern used throughout is:
1. Define local interfaces that mirror the Prisma query shape
2. Cast: `const rows = raw as unknown as MyLocalType[]`
3. Type all `.map()` / `.reduce()` callbacks explicitly

---

## Repo layout (key files)

```
src/
  app/
    fixtures/page.tsx       ← Lane 3 DONE — has active bug (see below)
    leagues/
      page.tsx              ← Lane 3 DONE
      actions.ts            ← Server Actions: createLeague, joinLeague
    players/page.tsx        ← Lane 2 STUB — not started
    predict/page.tsx        ← Lane 2 STUB — not started
    team/
      page.tsx              ← Lane 1 STUB — not started
      squad/page.tsx        ← Lane 1 STUB — not started
      transfers/page.tsx    ← Lane 1 STUB — not started
    layout.tsx              ← NO app shell yet (Lane 1 must add sidebar + tab bar)
  components/
    FixturesClient.tsx      ← Lane 3 DONE — "use client" fixtures UI
    LeaguesClient.tsx       ← Lane 3 DONE — "use client" leagues UI
    Placeholder.tsx         ← dev placeholder for unbuilt pages
  lib/
    leagues.ts              ← pure helpers: generateJoinCode, sortGroupStandings,
                               sortLeagueStandings, computeGroupsFromFixtures
    leagues.test.ts         ← 9 unit tests, all passing
    scoring.ts              ← FPL point scoring logic (existing, complete)
    scoring.test.ts         ← scoring tests (existing, complete)
    db.ts                   ← Prisma singleton with PrismaPg adapter
    api-football.ts         ← API-Football wrapper (background job use only)
    gameweeks.ts            ← gameweek date bucket definitions
  jobs/
    sync.ts                 ← npm run sync [teams|fixtures|players|gameweeks|standings]
    settle.ts               ← npm run settle (post-match stats → fantasy points)
  supabase/
    server.ts               ← createClient() for Supabase Auth in Server Components
prisma/
  schema.prisma             ← full data model (see Models section below)
```

---

## Active bug — `/fixtures` page shows "No fixtures data available"

**Status:** the try/catch in `src/app/fixtures/page.tsx` is silently catching an error and rendering the empty state. Debug logging has been added to the catch block so the error will appear in the Next.js dev server terminal on next page load.

**What's known:**
- Simple DB queries work fine: `db.gameweek.count()` → 8, `db.fixture.count()` → 72
- The complex `findMany` with nested `include` (gameweeks → fixtures → homeTeam/awayTeam with `group` field) fails silently — no output, process exits 0
- The `group` column on `Team` was added via raw SQL (`ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "group" TEXT`) and confirmed populated (48 teams updated by `syncStandings`)
- The Prisma client has been regenerated and knows about `group`

**Most likely causes (investigate in order):**
1. The `group` column name conflicts with a reserved word in PostgreSQL — try quoting or renaming it (`"group"` is technically a reserved word, which may cause issues with the PrismaPg driver adapter even though the column was created)
2. A connection pool / timeout issue specific to the PrismaPg adapter under nested includes
3. The `Team` table has the column under a different case than what Prisma expects

**How to reproduce:** run `npm run dev`, open `http://localhost:3000/fixtures`, check the terminal for the error now that the catch block logs it.

**Fix path:** once the error is visible in terminal, fix accordingly. If it's the `group` reserved word, rename the Prisma field to `groupLabel` or `groupName`, re-run `npm run db:generate`, and update `syncStandings` + `fixtures/page.tsx` + `FixturesClient.tsx` + `leagues.ts` to use the new field name.

---

## Models (Prisma schema — key ones)

```prisma
model Team {
  id         String   @id @default(cuid())
  apiTeamId  Int      @unique
  name       String
  country    String
  logoUrl    String?
  group      String?  // "Group A" … "Group L" — populated by syncStandings()
  eliminated Boolean  @default(false)
  players    Player[]
  homeGames  Fixture[] @relation("HomeTeam")
  awayGames  Fixture[] @relation("AwayTeam")
}

model Gameweek {
  id        String    @id      // uses label as natural key e.g. "Group Stage - 1"
  label     String
  roundType RoundType // GROUP | R32 | R16 | QF | SF | FINAL | THIRD_PLACE
  startsAt  DateTime
  deadline  DateTime
  endsAt    DateTime
  isKnockout Boolean  @default(false)
  fixtures  Fixture[]
  squads    Squad[]
  bets      Bet[]
}

model Fixture {
  id            String        @id @default(cuid())
  apiFixtureId  Int           @unique
  kickoff       DateTime      // UTC — display in browser local time (do NOT force timeZone: "UTC")
  status        FixtureStatus // SCHEDULED | LIVE | FINISHED | POSTPONED | CANCELLED
  venue         String?
  homeScore     Int?
  awayScore     Int?
  gameweekId    String
  homeTeamId    String
  awayTeamId    String
  ...
}

model User {
  id    String @id @db.Uuid  // must match Supabase Auth user id
  email String @unique
  name  String
  squads Squad[]
  bets   Bet[]
  leagueMembers LeagueMember[]
  ownedLeagues  League[]
}

model League {
  id       String @id @default(cuid())
  name     String
  joinCode String @unique  // format: "GAF-XXXX" (generated by generateJoinCode())
  ownerId  String @db.Uuid
  members  LeagueMember[]
}
```

---

## Lane 3 — what was built (DONE)

All acceptance criteria from TASKS.md have been met:

- `src/lib/leagues.ts` — `generateJoinCode()`, `sortGroupStandings()`, `sortLeagueStandings()`, `computeGroupsFromFixtures()`
- `src/lib/leagues.test.ts` — 9 tests, all passing (17/17 total including scoring tests)
- `src/app/leagues/actions.ts` — `createLeague` + `joinLeague` Server Actions
- `src/components/LeaguesClient.tsx` — tabs, standings table, create/join modal with `useActionState`
- `src/app/leagues/page.tsx` — deep DB query, point aggregation per member
- `src/components/FixturesClient.tsx` — round tabs, fixture rows, group standings tables, local timezone display
- `src/app/fixtures/page.tsx` — gameweeks + group standings computation (has active bug)
- `prisma/schema.prisma` — added `Team.group String?`
- `src/lib/api-football.ts` — added `standings()` endpoint
- `src/jobs/sync.ts` — added `syncStandings()`, included in `fullSync()`

---

## Lane 1 — what needs to be built (NOT started)

**Branch when done:** merge into `feat/leagues-fixtures` or open a new branch off main.

**Files to create/edit:**
- `src/app/layout.tsx` — add desktop sidebar + mobile tab bar (design ref: `design/app.jsx`). Currently just `<body>{children}</body>`.
- `src/app/team/page.tsx` — My Team dashboard (design ref: `design/screens_dash.jsx`)
- `src/app/team/squad/page.tsx` — squad picker: 15 players, 100M budget, max-3-per-country, captain (design ref: `design/screens_squad.jsx`)
- `src/app/team/transfers/page.tsx` — transfer window (knockout rounds)
- `src/lib/squad-rules.ts` + `src/lib/squad-rules.test.ts` — pure validation: 15 players (2GK/5DEF/5MID/3FWD), ≤100M, max 3 per country, valid starting XI
- Supabase Auth integration: `supabase.auth.getUser()` → upsert `User` row

**Auth pattern (already in leagues/actions.ts — copy this):**
```typescript
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
```

**User upsert pattern (already in leagues/actions.ts):**
```typescript
await db.user.upsert({
  where: { id: user.id },
  update: { email: user.email ?? "" },
  create: { id: user.id, email: user.email ?? "", name: user.email?.split("@")[0] ?? "User" },
});
```

---

## Lane 2 — what needs to be built (NOT started)

**Files to create/edit:**
- `src/app/players/page.tsx` — player pool: filterable list (position, country, price, search). Design ref: `design/screens_market.jsx`
- `src/app/predict/page.tsx` — predictions page: match markets (1X2, O/U, BTTS), player props (scorer/assist/card), bet slip, open + settled bets. Design ref: `design/screens_predict.jsx`
- `src/components/PlayerRow.tsx` + `src/components/FilterBar.tsx` — reusable, Lane 1 squad picker will use these
- `src/lib/betting.ts` + `src/lib/betting.test.ts` — pure bet math: `payout(stake, multiplier, won)`, can't stake more than balance

**Note on player prices:** all `Player.price` is currently `0` in the DB. Build the UI to handle 0 gracefully; real prices come in a later step.

---

## Running the project

```bash
npm install
# .env.local must exist with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, DATABASE_URL, DIRECT_URL, APISPORTS_KEY
npm run db:generate    # generates Prisma client (always do this after git pull)
npm run dev            # http://localhost:3000
npm test               # 17 tests, all should pass
npm run build          # must pass before any merge to main
npm run check          # confirms DB connection: "teams 48 · players 1248 · fixtures 72"
```

**Sync commands (background jobs — maintainer only, not per-user):**
```bash
npm run sync                 # full sync: gameweeks, teams, fixtures, players, standings
npm run sync -- standings    # just re-sync group labels (Team.group)
npm run sync -- fixtures     # just re-sync fixture scores/statuses
npm run settle               # post-match: compute fantasyPoints from PlayerMatchStat
```

---

## Key patterns used throughout

**Server Component with DB (copy this pattern):**
```typescript
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
// define local interfaces to avoid implicit-any
interface MyRow { id: string; name: string }

export default async function MyPage() {
  let data: MyRow[] = [];
  try {
    const raw = await db.myModel.findMany({ ... });
    data = raw as unknown as MyRow[];
  } catch (err) {
    console.error("[my-page] DB error:", err);
  }
  return <MyClient data={data} />;
}
```

**Server Action (copy this pattern):**
```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ActionResult = { error: string } | { success: true; message: string };

export async function myAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  // ... do DB work ...
  revalidatePath("/my-route");
  return { success: true, message: "Done" };
}
```

**Client Component with Server Action (copy this pattern):**
```typescript
"use client";
import { useActionState } from "react";
import { myAction, type ActionResult } from "./actions";

export function MyForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(myAction, null);
  return (
    <form action={formAction}>
      {state && "error" in state && <p>{state.error}</p>}
      <button disabled={pending}>Submit</button>
    </form>
  );
}
```

**Kickoff date display — always use browser local time:**
```typescript
// CORRECT — browser local timezone
kickoff.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })

// WRONG — forces UTC, breaks for US evening games (9 PM CDT = next calendar day UTC)
kickoff.toLocaleDateString("en-GB", { timeZone: "UTC", ... })
```

---

## Design references

Open `design/index.html` in a browser for the full clickable prototype.

| File | What it shows |
|---|---|
| `design/app.jsx` | App shell: desktop sidebar, mobile tab bar |
| `design/screens_auth.jsx` | Login / sign-up flows |
| `design/screens_dash.jsx` | My Team dashboard |
| `design/screens_squad.jsx` | Squad picker (15-player picker, budget bar) |
| `design/screens_market.jsx` | Player pool + filter bar |
| `design/screens_predict.jsx` | Predictions / bet slip |
| `design/screens_leagues.jsx` | League standings |
| `design/screens_more.jsx` | Fixtures page (what Lane 3 built) |
| `design/squadlib.jsx` | Shared squad/player components |
| `design/playerlist.jsx` | Player row / list components |

---

## Security rules (non-negotiable)

- **Never commit `.env.local`** — it's git-ignored. Secrets come from Youssef privately.
- **Never call API-Football from a user request** — only `src/jobs/sync.ts` may call it. Every user request reads from the DB.
- **Never paste secrets into the repo or a logged channel.**
