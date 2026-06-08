// ─────────────────────────────────────────────────────────────────────────
// Background caching job (build-plan §5 architecture rule).
//   API-Football  →  THIS JOB  →  our database  →  every user request reads DB.
//
// Run on a schedule (cron / Vercel Cron). NEVER triggered by a user request.
//   npm run sync          → full sync (gameweeks, teams, fixtures, players)
//   npm run sync -- teams → sync just one entity (teams|fixtures|players|gameweeks)
//
// Idempotent: every write is an upsert keyed on the API id, so re-running is safe.
// ─────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { apiFootball, type ApiFixture, type ApiStanding } from "@/lib/api-football";
import {
  GAMEWEEK_DEFS,
  bucketForKickoff,
} from "@/lib/gameweeks";
import type { Position } from "@prisma/client";

// ── Gameweeks: seed the calendar buckets (§4). Run once; safe to re-run. ──
export async function syncGameweeks() {
  for (const g of GAMEWEEK_DEFS) {
    const startsAt = new Date(`${g.startsAt}T00:00:00Z`);
    const endsAt = new Date(`${g.endsAt}T23:59:59Z`);
    await db.gameweek.upsert({
      where: { id: g.label }, // using label as a stable natural key via id
      update: {},
      create: {
        id: g.label,
        label: g.label,
        roundType: g.roundType,
        startsAt,
        deadline: startsAt, // refined to first-kickoff below in syncFixtures
        endsAt,
        isKnockout: g.isKnockout,
      },
    });
  }
  console.log(`✓ gameweeks: ${GAMEWEEK_DEFS.length} buckets`);
}

// ── Teams: the 48 nations. ──
export async function syncTeams() {
  const teams = await apiFootball.teams();
  for (const t of teams) {
    await db.team.upsert({
      where: { apiTeamId: t.team.id },
      update: { name: t.team.name, country: t.team.country ?? t.team.name, logoUrl: t.team.logo ?? null },
      create: {
        apiTeamId: t.team.id,
        name: t.team.name,
        country: t.team.country ?? t.team.name,
        logoUrl: t.team.logo ?? null,
      },
    });
  }
  console.log(`✓ teams: ${teams.length}`);
}

const STATUS_MAP: Record<string, "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED"> = {
  TBD: "SCHEDULED", NS: "SCHEDULED",
  "1H": "LIVE", HT: "LIVE", "2H": "LIVE", ET: "LIVE", P: "LIVE", LIVE: "LIVE",
  FT: "FINISHED", AET: "FINISHED", PEN: "FINISHED",
  PST: "POSTPONED", CANC: "CANCELLED", ABD: "CANCELLED",
};

// ── Fixtures: full schedule, bucketed into gameweeks by calendar range. ──
export async function syncFixtures() {
  const fixtures = await apiFootball.fixtures();
  const teamIdByApi = new Map(
    (await db.team.findMany()).map((t) => [t.apiTeamId, t.id]),
  );
  const earliestByGw = new Map<string, Date>();

  let synced = 0;
  for (const f of fixtures as ApiFixture[]) {
    const kickoff = new Date(f.fixture.date);
    const bucket = bucketForKickoff(kickoff);
    if (!bucket) continue; // outside known windows; skip
    const homeId = teamIdByApi.get(f.teams.home.id);
    const awayId = teamIdByApi.get(f.teams.away.id);
    if (!homeId || !awayId) continue; // team not synced yet

    await db.fixture.upsert({
      where: { apiFixtureId: f.fixture.id },
      update: {
        kickoff,
        status: STATUS_MAP[f.fixture.status.short] ?? "SCHEDULED",
        homeScore: f.goals.home,
        awayScore: f.goals.away,
      },
      create: {
        apiFixtureId: f.fixture.id,
        kickoff,
        status: STATUS_MAP[f.fixture.status.short] ?? "SCHEDULED",
        venue: f.fixture.venue?.name ?? null,
        gameweekId: bucket.label,
        homeTeamId: homeId,
        awayTeamId: awayId,
      },
    });
    const cur = earliestByGw.get(bucket.label);
    if (!cur || kickoff < cur) earliestByGw.set(bucket.label, kickoff);
    synced++;
  }

  // Set each gameweek deadline to its first kickoff.
  for (const [label, deadline] of earliestByGw) {
    await db.gameweek.update({ where: { id: label }, data: { deadline } });
  }
  console.log(`✓ fixtures: ${synced} (of ${fixtures.length} returned)`);
}

// ── Players: loop the 48 teams and pull each official 26-man squad.
// NOTE: /players?league=...&season=... returns 0 before any match is played
// (it's stats-driven), so we use /players/squads?team=X which is populated now.
// Price is left at 0 — hand-pricing is a manual step before launch (§6).
export async function syncPlayers() {
  const teams = await db.team.findMany();
  let total = 0;
  for (const team of teams) {
    let squads;
    try {
      squads = await apiFootball.squad(team.apiTeamId);
    } catch (e) {
      console.error(`  ✗ squad ${team.name}:`, (e as Error).message);
      continue;
    }
    const players = squads[0]?.players ?? [];
    for (const p of players) {
      const pos = normalizePosition(p.position);
      await db.player.upsert({
        where: { apiPlayerId: p.id },
        update: { name: p.name, position: pos, photoUrl: p.photo ?? null, teamId: team.id },
        create: {
          apiPlayerId: p.id,
          name: p.name,
          position: pos,
          price: 0, // TODO: hand-tier prices before launch (§6)
          photoUrl: p.photo ?? null,
          teamId: team.id,
        },
      });
      total++;
    }
  }
  console.log(`✓ players: ${total} across ${teams.length} squads (price=0 until pricing step)`);
}

function normalizePosition(p?: string | null): Position {
  switch ((p ?? "").toLowerCase()) {
    case "goalkeeper": return "GK";
    case "defender": return "DEF";
    case "midfielder": return "MID";
    case "attacker": return "FWD";
    default: return "MID";
  }
}

// "188 cm" → 188 ; "81 kg" → 81 ; null/garbage → null
function parseUnit(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// ── Player profiles: bio + season stats from /players?team=X (for the player
// detail UI). ~2 pages per team → ~96 requests for all 48. Players must be
// synced first (matches on apiPlayerId). Season stats are 0/null pre-tournament
// and accumulate as matches are played — re-run periodically to refresh.
export async function syncPlayerProfiles() {
  const teams = await db.team.findMany();
  const knownApiIds = new Set((await db.player.findMany({ select: { apiPlayerId: true } })).map((p) => p.apiPlayerId));
  let updated = 0;
  for (const team of teams) {
    for (let page = 1; page <= 3; page++) {
      let profiles;
      try {
        profiles = await apiFootball.playerProfiles(team.apiTeamId, page);
      } catch (e) {
        console.error(`  ✗ profiles ${team.name} p${page}:`, (e as Error).message);
        break;
      }
      if (profiles.length === 0) break; // no more pages
      for (const entry of profiles) {
        if (!knownApiIds.has(entry.player.id)) continue; // not in our pool
        // Pick the World Cup stats block if present, else the first.
        const st = entry.statistics?.[0];
        await db.player.updateMany({
          where: { apiPlayerId: entry.player.id },
          data: {
            age: entry.player.age,
            nationality: entry.player.nationality,
            heightCm: parseUnit(entry.player.height),
            weightKg: parseUnit(entry.player.weight),
            injured: entry.player.injured ?? false,
            seasonAppearances: st?.games.appearences ?? null,
            seasonMinutes: st?.games.minutes ?? null,
            seasonGoals: st?.goals.total ?? null,
            seasonAssists: st?.goals.assists ?? null,
            seasonRating: st?.games.rating ? Number(st.games.rating) : null,
          },
        });
        updated++;
      }
      if (profiles.length < 20) break; // last page
    }
  }
  console.log(`✓ player profiles: ${updated} players enriched (bio + season stats)`);
}

// ── Standings: populate Team.group ("Group A" … "Group L") from /standings. ──
// Run once after the draw; safe to re-run (idempotent updates).
export async function syncStandings() {
  const data = await apiFootball.standings();
  let updated = 0;
  for (const row of data as unknown as ApiStanding[]) {
    for (const group of row.league.standings) {
      for (const entry of group) {
        if (!entry.group.startsWith("Group ")) continue; // skip third-place ranking
        await db.team.updateMany({
          where: { apiTeamId: entry.team.id },
          data: { group: entry.group },
        });
        updated++;
      }
    }
  }
  console.log(`✓ standings: ${updated} team group labels updated`);
}

// ── Odds: pull real match-market odds (/odds) into FixtureOdds. ──
// Maps API bet markets to our betting.ts selection keys:
//   bet 1 Match Winner → HOME / DRAW / AWAY
//   bet 5 Goals O/U    → OVER_2.5 / UNDER_2.5  (only the 2.5 line)
//   bet 8 Both Teams   → BTTS_YES / BTTS_NO
// Odds have a 7-day upstream window, so unscheduled/far fixtures return nothing
// — that's expected; we just skip them. Idempotent upsert per (fixture,selection).
function extractOdds(odds: import("@/lib/api-football").ApiOdds): Record<string, number> {
  const out: Record<string, number> = {};
  const bm = odds.bookmakers?.[0];
  if (!bm) return out;
  const num = (s?: string) => (s ? Number(s) : NaN);
  const get = (betId: number) => bm.bets?.find((b) => b.id === betId);

  const mw = get(1);
  if (mw) {
    for (const v of mw.values) {
      if (v.value === "Home") out.HOME = num(v.odd);
      else if (v.value === "Draw") out.DRAW = num(v.odd);
      else if (v.value === "Away") out.AWAY = num(v.odd);
    }
  }
  const ou = get(5);
  if (ou) {
    for (const v of ou.values) {
      if (v.value === "Over 2.5") out["OVER_2.5"] = num(v.odd);
      else if (v.value === "Under 2.5") out["UNDER_2.5"] = num(v.odd);
    }
  }
  const btts = get(8);
  if (btts) {
    for (const v of btts.values) {
      if (v.value === "Yes") out.BTTS_YES = num(v.odd);
      else if (v.value === "No") out.BTTS_NO = num(v.odd);
    }
  }
  // Drop any NaN entries.
  for (const k of Object.keys(out)) if (!Number.isFinite(out[k])) delete out[k];
  return out;
}

export async function syncOdds() {
  // Only upcoming/unfinished fixtures need odds.
  const fixtures = await db.fixture.findMany({
    where: { status: { in: ["SCHEDULED", "LIVE"] } },
    orderBy: { kickoff: "asc" },
  });
  let priced = 0;
  let rows = 0;
  for (const f of fixtures) {
    let resp;
    try {
      resp = await apiFootball.odds(f.apiFixtureId);
    } catch (e) {
      console.error(`  ✗ odds ${f.apiFixtureId}:`, (e as Error).message);
      continue;
    }
    const odds = resp[0] ? extractOdds(resp[0]) : {};
    const entries = Object.entries(odds);
    if (entries.length === 0) continue; // outside 7-day window / unpriced
    for (const [selection, multiplier] of entries) {
      await db.fixtureOdds.upsert({
        where: { fixtureId_selection: { fixtureId: f.id, selection } },
        update: { multiplier },
        create: { fixtureId: f.id, selection, multiplier },
      });
      rows++;
    }
    priced++;
  }
  console.log(`✓ odds: ${rows} odds rows across ${priced} fixtures (others outside 7-day window)`);
}

export async function fullSync() {
  await syncGameweeks();
  await syncTeams();
  await syncFixtures();
  await syncPlayers();
  await syncStandings();
  await syncOdds();
  console.log("✓ full sync complete");
}

// CLI entrypoint: `npm run sync -- [teams|fixtures|players|gameweeks|standings]`
// Run the CLI only when this file is the entrypoint (exact basename match).
if (/(^|\/)sync\.(ts|js)$/.test(process.argv[1] ?? "")) {
  const which = process.argv[2];
  const run =
    which === "teams" ? syncTeams
    : which === "fixtures" ? syncFixtures
    : which === "players" ? syncPlayers
    : which === "profiles" ? syncPlayerProfiles
    : which === "gameweeks" ? syncGameweeks
    : which === "standings" ? syncStandings
    : which === "odds" ? syncOdds
    : fullSync;
  run()
    .then(() => process.exit(0))
    .catch((e) => { console.error("✗ sync failed:", e.message); process.exit(1); });
}
