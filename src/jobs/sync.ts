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
import { apiFootball, type ApiFixture } from "@/lib/api-football";
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

// ── Players: paginated pool. Price is left at 0 — pricing is a manual step. ──
export async function syncPlayers() {
  const teamIdByApi = new Map(
    (await db.team.findMany()).map((t) => [t.apiTeamId, t.id]),
  );
  let page = 1;
  let total = 0;
  for (;;) {
    const entries = await apiFootball.playersPage(page);
    if (entries.length === 0) break;
    for (const e of entries) {
      const stat = e.statistics?.[0];
      const teamId = stat ? teamIdByApi.get(stat.team.id) : undefined;
      if (!teamId) continue;
      const pos = normalizePosition(stat?.games.position);
      await db.player.upsert({
        where: { apiPlayerId: e.player.id },
        update: { name: e.player.name, position: pos, photoUrl: e.player.photo ?? null, teamId },
        create: {
          apiPlayerId: e.player.id,
          name: e.player.name,
          position: pos,
          price: 0, // TODO: set via pricing step before launch
          photoUrl: e.player.photo ?? null,
          teamId,
        },
      });
      total++;
    }
    page++;
    if (page > 50) break; // safety cap
  }
  console.log(`✓ players: ${total} (price=0 until pricing step)`);
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

export async function fullSync() {
  await syncGameweeks();
  await syncTeams();
  await syncFixtures();
  await syncPlayers();
  console.log("✓ full sync complete");
}

// CLI entrypoint: `npm run sync -- [teams|fixtures|players|gameweeks]`
if (process.argv[1]?.endsWith("sync.ts") || process.argv[1]?.endsWith("sync.js")) {
  const which = process.argv[2];
  const run =
    which === "teams" ? syncTeams
    : which === "fixtures" ? syncFixtures
    : which === "players" ? syncPlayers
    : which === "gameweeks" ? syncGameweeks
    : fullSync;
  run()
    .then(() => process.exit(0))
    .catch((e) => { console.error("✗ sync failed:", e.message); process.exit(1); });
}
