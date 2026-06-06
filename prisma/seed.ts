// ─────────────────────────────────────────────────────────────────────────
// Seed / stub data (build-plan §10 step 1: "stub fake data so no one is
// blocked on the live feed"). Run: `npm run seed`.
//
// Creates gameweek buckets, a handful of teams + priced players, a couple of
// fixtures, a demo league, and one squad — enough to build the picker, scoring,
// betting, and leaderboard UIs against real-shaped data before the API is wired.
//
// Idempotent-ish: clears the stub tables first, then re-inserts.
// ─────────────────────────────────────────────────────────────────────────

import { PrismaClient, type Position } from "@prisma/client";
import { GAMEWEEK_DEFS } from "../src/lib/gameweeks";

const db = new PrismaClient();

// price is integer tenths-of-a-million: 130 = 13.0M (see schema note).
const TEAMS = [
  { apiTeamId: 9001, name: "Argentina", country: "Argentina" },
  { apiTeamId: 9002, name: "France", country: "France" },
  { apiTeamId: 9003, name: "Brazil", country: "Brazil" },
  { apiTeamId: 9004, name: "England", country: "England" },
  { apiTeamId: 9005, name: "Spain", country: "Spain" },
  { apiTeamId: 9006, name: "USA", country: "USA" },
];

// A few recognisable names per position so the picker looks real.
const PLAYERS: Array<{ name: string; position: Position; price: number; team: number }> = [
  { name: "Emiliano Martínez", position: "GK", price: 55, team: 9001 },
  { name: "Lionel Messi", position: "FWD", price: 120, team: 9001 },
  { name: "Julián Álvarez", position: "FWD", price: 95, team: 9001 },
  { name: "Mike Maignan", position: "GK", price: 50, team: 9002 },
  { name: "Kylian Mbappé", position: "FWD", price: 130, team: 9002 },
  { name: "Aurélien Tchouaméni", position: "MID", price: 75, team: 9002 },
  { name: "Alisson", position: "GK", price: 55, team: 9003 },
  { name: "Vinícius Júnior", position: "FWD", price: 115, team: 9003 },
  { name: "Rodrygo", position: "MID", price: 85, team: 9003 },
  { name: "Jordan Pickford", position: "GK", price: 48, team: 9004 },
  { name: "Jude Bellingham", position: "MID", price: 105, team: 9004 },
  { name: "Harry Kane", position: "FWD", price: 110, team: 9004 },
  { name: "Unai Simón", position: "GK", price: 45, team: 9005 },
  { name: "Rodri", position: "MID", price: 90, team: 9005 },
  { name: "Lamine Yamal", position: "FWD", price: 100, team: 9005 },
  { name: "Matt Turner", position: "GK", price: 42, team: 9006 },
  { name: "Christian Pulisic", position: "MID", price: 80, team: 9006 },
  { name: "Antonee Robinson", position: "DEF", price: 50, team: 9006 },
  // a few defenders so a valid XI is buildable
  { name: "Nicolás Otamendi", position: "DEF", price: 50, team: 9001 },
  { name: "William Saliba", position: "DEF", price: 60, team: 9002 },
  { name: "Marquinhos", position: "DEF", price: 58, team: 9003 },
  { name: "John Stones", position: "DEF", price: 55, team: 9004 },
  { name: "Aymeric Laporte", position: "DEF", price: 52, team: 9005 },
];

async function main() {
  console.log("🌱 Seeding stub data…");

  // Clear in FK-safe order.
  await db.bet.deleteMany();
  await db.squadPlayer.deleteMany();
  await db.squad.deleteMany();
  await db.playerMatchStat.deleteMany();
  await db.fixture.deleteMany();
  await db.player.deleteMany();
  await db.leagueMember.deleteMany();
  await db.league.deleteMany();
  await db.team.deleteMany();
  await db.gameweek.deleteMany();
  await db.user.deleteMany();

  // Gameweeks
  for (const g of GAMEWEEK_DEFS) {
    const startsAt = new Date(`${g.startsAt}T00:00:00Z`);
    await db.gameweek.create({
      data: {
        id: g.label,
        label: g.label,
        roundType: g.roundType,
        startsAt,
        deadline: startsAt,
        endsAt: new Date(`${g.endsAt}T23:59:59Z`),
        isKnockout: g.isKnockout,
      },
    });
  }

  // Teams
  const teamIdByApi = new Map<number, string>();
  for (const t of TEAMS) {
    const row = await db.team.create({ data: t });
    teamIdByApi.set(t.apiTeamId, row.id);
  }

  // Players
  let apiPlayerId = 100000;
  const playerRows = [];
  for (const p of PLAYERS) {
    const row = await db.player.create({
      data: {
        apiPlayerId: apiPlayerId++,
        name: p.name,
        position: p.position,
        price: p.price,
        teamId: teamIdByApi.get(p.team)!,
      },
    });
    playerRows.push(row);
  }

  // A couple of fixtures in Group MD1
  const md1 = "Group MD1";
  await db.fixture.create({
    data: {
      apiFixtureId: 500001,
      kickoff: new Date("2026-06-11T19:00:00Z"),
      status: "SCHEDULED",
      venue: "Estadio Azteca",
      gameweekId: md1,
      homeTeamId: teamIdByApi.get(9006)!,
      awayTeamId: teamIdByApi.get(9005)!,
    },
  });
  await db.fixture.create({
    data: {
      apiFixtureId: 500002,
      kickoff: new Date("2026-06-12T19:00:00Z"),
      status: "SCHEDULED",
      venue: "MetLife Stadium",
      gameweekId: md1,
      homeTeamId: teamIdByApi.get(9001)!,
      awayTeamId: teamIdByApi.get(9003)!,
    },
  });

  // Demo user + league + a starter squad (so leaderboard has something).
  const demoUser = await db.user.create({
    data: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "demo@worldcup-fpl.test",
      name: "Demo Manager",
    },
  });
  const league = await db.league.create({
    data: { name: "The Friends League", joinCode: "WC2026", ownerId: demoUser.id },
  });
  await db.leagueMember.create({ data: { leagueId: league.id, userId: demoUser.id } });

  const squad = await db.squad.create({
    data: { userId: demoUser.id, gameweekId: md1, captainId: playerRows[1].id }, // Messi (c)
  });
  // First 11 starting, rest bench — not a valid-formation enforcement, just stub.
  for (let i = 0; i < Math.min(15, playerRows.length); i++) {
    await db.squadPlayer.create({
      data: { squadId: squad.id, playerId: playerRows[i].id, isStarting: i < 11 },
    });
  }

  console.log(`✓ ${TEAMS.length} teams, ${playerRows.length} players, 2 fixtures, 1 league, 1 squad`);
  console.log("✓ seed complete — run `npm run db:studio` to browse.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("✗ seed failed:", e);
    await db.$disconnect();
    process.exit(1);
  });
