// ─────────────────────────────────────────────────────────────────────────
// Seed a knockout bracket for TESTING (the real qualifiers don't exist until
// the group stage finishes upstream). Picks 32 qualifiers from the simulated
// group standings — top 2 per group (24) + the 8 best third-placed teams — and
// creates the R32 fixtures, plus placeholder fixtures for R16/QF/SF/Final that
// fill in as winners advance (see simulate-matchday.ts knockout advancement).
//
//   npx tsx scripts/seed-knockouts.ts          # seed the bracket
//   npx tsx scripts/seed-knockouts.ts --reset  # delete all knockout fixtures
//
// Requires the group stage to be simulated first (FINISHED with scores).
// Uses synthetic apiFixtureId in the 9_000_000+ range to avoid colliding with
// real synced fixtures. Re-runnable: wipes any prior synthetic KO fixtures first.
// ─────────────────────────────────────────────────────────────────────────

import { db } from "../src/lib/db";
import { computeGroupsFromFixtures, sortGroupStandings, type FixtureForGroup } from "../src/lib/leagues";

const KO_API_BASE = 9_000_000; // synthetic apiFixtureId base for seeded KO fixtures
const KO_LABELS = ["Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final & 3rd place"] as const;

// A KO fixture's two slots reference either a real teamId (R32, known qualifiers)
// or a placeholder "winner of match N" that the simulator resolves as it plays.
// We store placeholder pairings as MatchEvent-free fixtures with both teams set
// to a TBD sentinel team until the prior round is simulated. To keep the schema
// happy (homeTeamId/awayTeamId are required), later rounds reuse the qualifiers'
// team ids as placeholders and the simulator OVERWRITES them with real winners.

async function resetKnockouts() {
  const koGws = await db.gameweek.findMany({ where: { isKnockout: true }, select: { id: true } });
  const ids = koGws.map((g) => g.id);
  const fx = await db.fixture.findMany({ where: { gameweekId: { in: ids } }, select: { id: true } });
  const fxIds = fx.map((f) => f.id);
  if (fxIds.length) {
    await db.matchEvent.deleteMany({ where: { fixtureId: { in: fxIds } } });
    await db.matchStatistic.deleteMany({ where: { fixtureId: { in: fxIds } } });
    await db.matchLineup.deleteMany({ where: { fixtureId: { in: fxIds } } });
    await db.playerMatchStat.deleteMany({ where: { fixtureId: { in: fxIds } } });
    await db.bet.deleteMany({ where: { fixtureId: { in: fxIds } } });
    await db.parlayLeg.deleteMany({ where: { fixtureId: { in: fxIds } } });
    await db.fixture.deleteMany({ where: { id: { in: fxIds } } });
  }
  console.log(`✓ deleted ${fxIds.length} knockout fixtures`);
}

async function seed() {
  // ── 1. group standings from the simulated group-stage fixtures ──
  const groupFixtures = await db.fixture.findMany({
    where: { gameweek: { roundType: "GROUP" }, status: "FINISHED" },
    include: { homeTeam: true, awayTeam: true },
  });
  if (groupFixtures.length === 0) {
    console.error("✗ no FINISHED group fixtures — simulate the group stage first (npm run simulate -- all).");
    return;
  }
  const forGroup: FixtureForGroup[] = groupFixtures.map((f) => ({
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeTeamName: f.homeTeam.name,
    awayTeamName: f.awayTeam.name,
    homeTeamGroup: f.homeTeam.group,
    awayTeamGroup: f.awayTeam.group,
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    status: f.status,
  }));
  const groups = computeGroupsFromFixtures(forGroup).sort((a, b) => a.label.localeCompare(b.label));

  // ── 2. pick 32 qualifiers: top 2 per group + 8 best third-placed ──
  const winners: string[] = []; // group winners (seed 1)
  const runnersUp: string[] = [];
  const thirds: Array<{ teamId: string; points: number; gd: number; gf: number }> = [];
  for (const g of groups) {
    const rows = sortGroupStandings(g.rows);
    if (rows[0]) winners.push(rows[0].teamId);
    if (rows[1]) runnersUp.push(rows[1].teamId);
    if (rows[2]) thirds.push({ teamId: rows[2].teamId, points: rows[2].points, gd: rows[2].goalsFor - rows[2].goalsAgainst, gf: rows[2].goalsFor });
  }
  const best8Thirds = thirds
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
    .slice(0, 8)
    .map((t) => t.teamId);

  // 32 qualifiers, ordered: winners, runners-up, best thirds.
  const qualifiers = [...winners, ...runnersUp, ...best8Thirds].slice(0, 32);
  if (qualifiers.length < 32) {
    console.error(`✗ only ${qualifiers.length} qualifiers — need 32. Did the full group stage finish?`);
    return;
  }
  const teamName = new Map(groupFixtures.flatMap((f) => [[f.homeTeamId, f.homeTeam.name], [f.awayTeamId, f.awayTeam.name]] as const));
  console.log(`✓ 32 qualifiers: ${winners.length} winners, ${runnersUp.length} runners-up, ${best8Thirds.length} best thirds`);

  // ── 3. seed R32 fixtures (16 matches): pair 1-vs-32, 2-vs-31, … (simple bracket) ──
  await resetKnockouts(); // clean slate

  const gwByLabel = new Map(
    (await db.gameweek.findMany({ where: { isKnockout: true } })).map((g) => [g.label, g]),
  );
  let apiId = KO_API_BASE;
  // base kickoff: just inside each round's window (use the gameweek startsAt).
  const r32 = gwByLabel.get("Round of 32")!;
  const r32Pairs: Array<[string, string]> = [];
  for (let i = 0; i < 16; i++) {
    const home = qualifiers[i];
    const away = qualifiers[31 - i];
    r32Pairs.push([home, away]);
  }
  for (let i = 0; i < r32Pairs.length; i++) {
    const [home, away] = r32Pairs[i];
    await db.fixture.create({
      data: {
        apiFixtureId: apiId++,
        kickoff: new Date(r32.startsAt.getTime() + i * 3 * 60 * 60 * 1000), // spread 3h apart
        status: "SCHEDULED",
        venue: "Knockout Stadium",
        gameweekId: r32.id,
        homeTeamId: home,
        awayTeamId: away,
      },
    });
  }
  console.log(`✓ seeded ${r32Pairs.length} Round of 32 fixtures`);

  // ── 4. seed placeholder fixtures for later rounds (R16→Final) ──
  // Each later round halves the match count: R16=8, QF=4, SF=2, Final=1 (+3rd place=1).
  // Placeholders use the first two qualifiers as stand-in teams; the simulator
  // OVERWRITES home/away with the real winners as each prior round is played.
  const placeholderHome = qualifiers[0];
  const placeholderAway = qualifiers[1];
  const laterCounts: Record<string, number> = { "Round of 16": 8, "Quarter-finals": 4, "Semi-finals": 2, "Final & 3rd place": 2 };
  for (const label of ["Round of 16", "Quarter-finals", "Semi-finals", "Final & 3rd place"]) {
    const gw = gwByLabel.get(label)!;
    const n = laterCounts[label];
    for (let i = 0; i < n; i++) {
      await db.fixture.create({
        data: {
          apiFixtureId: apiId++,
          kickoff: new Date(gw.startsAt.getTime() + i * 3 * 60 * 60 * 1000),
          status: "SCHEDULED",
          venue: "Knockout Stadium",
          gameweekId: gw.id,
          homeTeamId: placeholderHome,
          awayTeamId: placeholderAway,
        },
      });
    }
    console.log(`✓ seeded ${n} ${label} placeholder fixtures`);
  }

  console.log(`\n✓ bracket seeded. Sample R32: ${r32Pairs.slice(0, 3).map(([h, a]) => `${teamName.get(h)} v ${teamName.get(a)}`).join(", ")}`);
  console.log("Next: simulate Round of 32 — winners advance into the R16 fixtures.");
}

async function main() {
  if (process.argv.includes("--reset")) {
    await resetKnockouts();
  } else {
    await seed();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("✗ seed-knockouts failed:", e); process.exit(1); });

void KO_LABELS;
