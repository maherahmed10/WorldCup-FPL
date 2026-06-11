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
import {
  apiFootball,
  type ApiFixture,
  type ApiStanding,
  type ApiMatchEvent,
  type ApiTeamStatistic,
  type ApiTeamLineup,
} from "@/lib/api-football";
import {
  GAMEWEEK_DEFS,
  bucketForKickoff,
  deadlineForFirstKickoff,
} from "@/lib/gameweeks";
import type { Position } from "@prisma/client";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
        gameweekId: bucket.label,
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

  // Set each gameweek deadline to 90 min before its first kickoff.
  for (const [label, firstKickoff] of earliestByGw) {
    await db.gameweek.update({
      where: { id: label },
      data: { deadline: deadlineForFirstKickoff(firstKickoff) },
    });
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

// Aggregate a player's season stats ACROSS all competitions (league + cups +
// continental) into one line. season=2026 only has sparse internationals, so we
// read the most recent full club season — but the API splits it into one block
// per competition (La Liga, UCL, …). Sum the counters; minutes-weight the rating.
type StatBlock = {
  games: { appearences: number | null; minutes: number | null; rating: string | null };
  goals: { total: number | null; assists: number | null };
};
function aggregateStats(blocks: StatBlock[] | undefined) {
  // Track sums AND whether any block actually had a non-null value, so we can
  // distinguish a true 0 (e.g. a striker with 0 goals) from "the API has no data"
  // (common for smaller leagues — render those as "—", not "0").
  let apps = 0, minutes = 0, goals = 0, assists = 0;
  let hasApps = false, hasMinutes = false, hasGoals = false, hasAssists = false;
  let ratingWeighted = 0, ratingMinutes = 0;
  for (const b of blocks ?? []) {
    if (b.games.appearences != null) { apps += b.games.appearences; hasApps = true; }
    if (b.games.minutes != null) { minutes += b.games.minutes; hasMinutes = true; }
    if (b.goals.total != null) { goals += b.goals.total; hasGoals = true; }
    if (b.goals.assists != null) { assists += b.goals.assists; hasAssists = true; }
    const r = b.games.rating ? Number(b.games.rating) : null;
    const mins = b.games.minutes ?? 0;
    if (r && mins > 0) {
      ratingWeighted += r * mins;
      ratingMinutes += mins;
    }
  }
  return {
    apps: hasApps ? apps : null,
    minutes: hasMinutes ? minutes : null,
    goals: hasGoals ? goals : null,
    assists: hasAssists ? assists : null,
    rating: ratingMinutes > 0 ? Math.round((ratingWeighted / ratingMinutes) * 100) / 100 : null,
  };
}

// ── Player profiles: bio + aggregated CLUB-season stats, queried PER PLAYER by
// id (/players?id=X&season=2025). Club stats live under the player's club id, so
// a national-team query misses them — we query each player individually and sum
// across all their competitions. ~1 request/player → ~1,248 for the full pool.
// One-time / occasional; safe to re-run. Optionally pass a price floor to only
// enrich notable players (npm run sync -- profiles 100  → price >= 100 = £10m).
export async function syncPlayerProfiles(minPriceTenths = 0) {
  const players = await db.player.findMany({
    where: minPriceTenths > 0 ? { price: { gte: minPriceTenths } } : undefined,
    select: { id: true, apiPlayerId: true },
  });
  let updated = 0;
  let i = 0;
  for (const p of players) {
    i++;
    // Rate-limit: Pro plan allows ~300 req/min. Pace at ~4/sec (250ms) and
    // retry on 429 (per-minute limit) with backoff so the run completes.
    let resp;
    let attempt = 0;
    for (;;) {
      try {
        resp = await apiFootball.playerProfileById(p.apiPlayerId);
        break;
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("429") && attempt < 4) {
          attempt++;
          await sleep(2000 * attempt); // 2s, 4s, 6s, 8s backoff
          continue;
        }
        console.error(`  ✗ profile ${p.apiPlayerId}:`, msg);
        resp = null;
        break;
      }
    }
    await sleep(250); // pace requests (~4/sec, well under 300/min)
    if (!resp) continue;
    const entry = resp[0];
    if (!entry) continue; // no record this season
    const s = aggregateStats(entry.statistics);
    await db.player.update({
      where: { id: p.id },
      data: {
        age: entry.player.age,
        nationality: entry.player.nationality,
        heightCm: parseUnit(entry.player.height),
        weightKg: parseUnit(entry.player.weight),
        injured: entry.player.injured ?? false,
        seasonAppearances: s.apps,
        seasonMinutes: s.minutes,
        seasonGoals: s.goals,
        seasonAssists: s.assists,
        seasonRating: s.rating,
      },
    });
    updated++;
    if (i % 100 === 0) console.log(`  …${i}/${players.length}`);
  }
  console.log(`✓ player profiles: ${updated}/${players.length} enriched (aggregated club-season stats)`);
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

// ── Match stats: events + statistics + lineups for FINISHED fixtures. ──
// Fetches 3 endpoints per fixture (~240 calls for the full 80-game tournament).
// Idempotent: skips fixtures that already have statistics rows.
export async function syncMatchStats() {
  const teamIdByApi = new Map(
    (await db.team.findMany({ select: { id: true, apiTeamId: true } })).map(
      (t) => [t.apiTeamId, t.id],
    ),
  );

  const fixtures = await db.fixture.findMany({
    where: {
      status: "FINISHED",
      matchStatistics: { none: {} }, // only fixtures not yet enriched
    },
    select: { id: true, apiFixtureId: true },
  });

  let synced = 0;
  for (const f of fixtures) {
    try {
      await syncOneFixtureStats(f.id, f.apiFixtureId, teamIdByApi);
      synced++;
    } catch (e) {
      console.error(`  ✗ match stats fixture ${f.apiFixtureId}:`, (e as Error).message);
    }
    await sleep(350); // pace: ~3 batches/sec (3 API calls per iteration)
  }
  console.log(`✓ match stats: ${synced}/${fixtures.length} fixtures enriched`);
}

async function syncOneFixtureStats(
  fixtureDbId: string,
  apiFixtureId: number,
  teamIdByApi: Map<number, string>,
) {
  const [eventsRaw, statsRaw, lineupsRaw] = await Promise.all([
    apiFootball.fixtureEvents(apiFixtureId),
    apiFootball.fixtureStatistics(apiFixtureId),
    apiFootball.fixtureLineups(apiFixtureId),
  ]);

  // ── Events ──
  for (const ev of eventsRaw as ApiMatchEvent[]) {
    const teamId = teamIdByApi.get(ev.team.id);
    if (!teamId) continue;
    await db.matchEvent.create({
      data: {
        fixtureId: fixtureDbId,
        teamId,
        playerApiId: ev.player.id ?? null,
        playerName: ev.player.name ?? "",
        assistApiId: ev.assist.id ?? null,
        assistName: ev.assist.name ?? null,
        minute: ev.time.elapsed,
        extraMinute: ev.time.extra ?? null,
        type: ev.type,
        detail: ev.detail,
        comments: ev.comments ?? null,
      },
    });
  }

  // ── Statistics ──
  for (const ts of statsRaw as ApiTeamStatistic[]) {
    const teamId = teamIdByApi.get(ts.team.id);
    if (!teamId) continue;
    for (const s of ts.statistics) {
      await db.matchStatistic.upsert({
        where: { fixtureId_teamId_key: { fixtureId: fixtureDbId, teamId, key: s.type } },
        update: { value: s.value != null ? String(s.value) : "" },
        create: {
          fixtureId: fixtureDbId,
          teamId,
          key: s.type,
          value: s.value != null ? String(s.value) : "",
        },
      });
    }
  }

  // ── Lineups ──
  for (const tl of lineupsRaw as ApiTeamLineup[]) {
    const teamId = teamIdByApi.get(tl.team.id);
    if (!teamId) continue;
    const formation = tl.formation ?? null;

    const upsert = (p: ApiTeamLineup["startXI"][number]["player"], isSub: boolean) =>
      db.matchLineup.upsert({
        where: { fixtureId_teamId_playerApiId: { fixtureId: fixtureDbId, teamId, playerApiId: p.id } },
        update: {},
        create: {
          fixtureId: fixtureDbId,
          teamId,
          formation,
          playerApiId: p.id,
          playerName: p.name,
          playerNumber: p.number ?? null,
          pos: p.pos ?? null,
          grid: p.grid ?? null,
          isSubstitute: isSub,
        },
      });

    for (const { player: p } of tl.startXI) await upsert(p, false);
    for (const { player: p } of tl.substitutes) await upsert(p, true);
  }
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
  // `npm run sync -- profiles [minPriceTenths]` → only enrich players ≥ that price.
  const profilesArg = () => syncPlayerProfiles(Number(process.argv[3]) || 0);
  const run =
    which === "teams" ? syncTeams
    : which === "fixtures" ? syncFixtures
    : which === "players" ? syncPlayers
    : which === "profiles" ? profilesArg
    : which === "gameweeks" ? syncGameweeks
    : which === "standings" ? syncStandings
    : which === "odds" ? syncOdds
    : which === "matchstats" ? syncMatchStats
    : fullSync;
  run()
    .then(() => process.exit(0))
    .catch((e) => { console.error("✗ sync failed:", e.message); process.exit(1); });
}
