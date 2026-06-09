// ─────────────────────────────────────────────────────────────────────────
// Simulate a matchday for TESTING — no real games / no API calls needed.
//
//   npx tsx scripts/simulate-matchday.ts "Group MD1"               # simulate
//   npx tsx scripts/simulate-matchday.ts "Group MD1" --seed-bets   # + place test bets first
//   npx tsx scripts/simulate-matchday.ts all                       # every gameweek
//   npx tsx scripts/simulate-matchday.ts "Group MD1" --reset       # revert (re-open bets)
//   npx tsx scripts/simulate-matchday.ts "Group MD1" --reset --hard # revert + reset wallets
//
// What it does (simulate mode):
//   1. For each SCHEDULED fixture in the gameweek, invents a realistic scoreline.
//   2. Writes a PlayerMatchStat row per player (minutes/goals/assists/cards/saves),
//      computing fantasyPoints via the REAL scoreMatch() — identical to live settlement.
//   3. Writes MatchEvent / MatchStatistic / MatchLineup so the fixture-detail view fills.
//   4. Marks the fixture FINISHED with the score.
//   5. Settles every OPEN bet / parlay leg / H2H challenge on the fixture (DB-only
//      settlement functions — same code path as production; credits wallets).
//
// Deterministic: per-fixture RNG seeded from apiFixtureId, so re-runs are identical
// and the upserts make it idempotent.
// ─────────────────────────────────────────────────────────────────────────

import { db } from "../src/lib/db";
import { scoreMatch, type MatchStatLine, type Position } from "../src/lib/scoring";
import {
  settleFixtureBets,
  settlePlayerPropBets,
  settleParlayLegs,
} from "../src/jobs/settle";
import { settleH2HChallenges } from "../src/lib/h2h";
import {
  STARTING_MONEY,
  scorerMultiplier,
  assistMultiplier,
} from "../src/lib/betting";

// How far to pull a simulated gameweek's dates into the PAST so the app's
// date-based gates (deadline lock, rival-squad unlock, banner advance, transfer
// window) behave as if the matches really happened. Reset shifts back by the
// same amount. Guarded so re-running sim without reset never double-shifts.
const BACKDATE_MS = 120 * 24 * 60 * 60 * 1000; // 120 days

// ── seeded RNG (mulberry32) ──────────────────────────────────────────────
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];
const between = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

// Weighted scoreline: mostly 0–3, occasional 4. Returns goals for one side.
function sampleGoals(r: () => number): number {
  const x = r();
  if (x < 0.22) return 0;
  if (x < 0.5) return 1;
  if (x < 0.76) return 2;
  if (x < 0.92) return 3;
  return 4;
}

type PlayerLite = { id: string; apiPlayerId: number; name: string; position: Position };

// Build a per-player MatchStatLine set for ONE team, given how many goals/assists
// that team scored and how many it conceded. Guarantees goals sum exactly to `scored`.
function simulateTeam(
  r: () => number,
  players: PlayerLite[],
  scored: number,
  conceded: number,
): Map<string, MatchStatLine & { sub: boolean }> {
  const out = new Map<string, MatchStatLine & { sub: boolean }>();

  // Choose a starting XI (prefer a balanced shape) and a few subs.
  const gks = players.filter((p) => p.position === "GK");
  const defs = players.filter((p) => p.position === "DEF");
  const mids = players.filter((p) => p.position === "MID");
  const fwds = players.filter((p) => p.position === "FWD");
  const take = <T>(arr: T[], n: number) => arr.slice(0, n);
  const starters: PlayerLite[] = [
    ...take(gks, 1),
    ...take(defs, 4),
    ...take(mids, 3),
    ...take(fwds, 3),
  ];
  // Pad to 11 from whatever's left if a position was short.
  const leftover = players.filter((p) => !starters.includes(p));
  while (starters.length < 11 && leftover.length) starters.push(leftover.shift()!);
  const starterIds = new Set(starters.map((p) => p.id));
  const subs = leftover.slice(0, 3); // a few came off the bench

  // Base lines: starters 90', subs short minutes, the rest DNP.
  for (const p of players) {
    const isStarter = starterIds.has(p.id);
    const isSub = subs.includes(p);
    const minutes = isStarter ? 90 : isSub ? between(r, 12, 35) : 0;
    out.set(p.id, {
      sub: isSub,
      position: p.position,
      minutes,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      saves: 0,
      penaltiesSaved: 0,
      penaltiesMissed: 0,
      // GK + outfielders who played the bulk get the conceded count (drives clean sheets).
      goalsConceded: minutes >= 60 ? conceded : 0,
      ownGoals: 0,
    });
  }

  // GK saves — a handful, scaled by how much they conceded.
  const gk = starters.find((p) => p.position === "GK");
  if (gk) out.get(gk.id)!.saves = between(r, 1, 6);

  // Goal scorers — weight FWD > MID > DEF. Pull from players who played.
  const played = starters.concat(subs);
  const scorerPool = (pos: Position[]) => played.filter((p) => pos.includes(p.position));
  for (let g = 0; g < scored; g++) {
    const w = r();
    const pool =
      w < 0.6 ? scorerPool(["FWD"]) :
      w < 0.9 ? scorerPool(["MID"]) :
      scorerPool(["DEF"]);
    const scorer = (pool.length ? pick(r, pool) : pick(r, played));
    out.get(scorer.id)!.goals += 1;
    // ~65% of goals get an assist from a different (MID-weighted) player.
    if (r() < 0.65) {
      const aPool = played.filter((p) => p.id !== scorer.id);
      const midPool = aPool.filter((p) => p.position === "MID");
      const assister = (r() < 0.6 && midPool.length) ? pick(r, midPool) : (aPool.length ? pick(r, aPool) : null);
      if (assister) out.get(assister.id)!.assists += 1;
    }
  }

  // Cards — 1–3 yellows DEF/MID-weighted, rare red.
  const yellows = between(r, 1, 3);
  for (let c = 0; c < yellows; c++) {
    const pool = played.filter((p) => p.position === "DEF" || p.position === "MID");
    const target = pool.length ? pick(r, pool) : pick(r, played);
    out.get(target.id)!.yellowCards = Math.min(2, out.get(target.id)!.yellowCards + 1);
  }
  if (r() < 0.12) {
    const target = pick(r, played);
    out.get(target.id)!.redCards = 1;
  }

  return out;
}

const POS_LETTER: Record<Position, string> = { GK: "G", DEF: "D", MID: "M", FWD: "F" };

async function simulateGameweek(label: string) {
  const gw = await db.gameweek.findFirst({ where: { label } });
  if (!gw) { console.error(`✗ no gameweek "${label}"`); return; }

  const fixtures = await db.fixture.findMany({
    where: { gameweekId: gw.id, status: "SCHEDULED" },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
    },
  });
  if (!fixtures.length) { console.log(`  (no SCHEDULED fixtures in "${label}" — already simulated?)`); return; }

  console.log(`\n▶ Simulating "${label}" — ${fixtures.length} fixtures`);
  for (const f of fixtures) {
    const r = rng(f.apiFixtureId);
    const homeGoals = sampleGoals(r);
    const awayGoals = sampleGoals(r);

    const homePlayers: PlayerLite[] = f.homeTeam.players.map((p) => ({ id: p.id, apiPlayerId: p.apiPlayerId, name: p.name, position: p.position as Position }));
    const awayPlayers: PlayerLite[] = f.awayTeam.players.map((p) => ({ id: p.id, apiPlayerId: p.apiPlayerId, name: p.name, position: p.position as Position }));

    const homeLines = simulateTeam(r, homePlayers, homeGoals, awayGoals);
    const awayLines = simulateTeam(r, awayPlayers, awayGoals, homeGoals);

    // ── write PlayerMatchStat for both teams ──
    let written = 0;
    for (const [pid, line] of [...homeLines, ...awayLines]) {
      const fantasyPoints = scoreMatch(line);
      const rating = line.minutes > 0 ? Math.round((6 + r() * 2.5) * 10) / 10 : null;
      await db.playerMatchStat.upsert({
        where: { playerId_fixtureId: { playerId: pid, fixtureId: f.id } },
        update: { ...statRow(line), rating, fantasyPoints },
        create: { playerId: pid, fixtureId: f.id, ...statRow(line), rating, fantasyPoints },
      });
      written++;
    }

    // ── match-stats view rows (lineups / events / statistics) ──
    await writeMatchStatsRows(f, homePlayers, awayPlayers, homeLines, awayLines, r);

    // ── mark fixture finished + backdate its kickoff into the past so the app
    //    treats it as already played (only shift if still in the future) ──
    const newKickoff = f.kickoff.getTime() > Date.now() - BACKDATE_MS
      ? new Date(f.kickoff.getTime() - BACKDATE_MS)
      : f.kickoff;
    await db.fixture.update({
      where: { id: f.id },
      data: { status: "FINISHED", homeScore: homeGoals, awayScore: awayGoals, kickoff: newKickoff },
    });

    // ── settle wagers on this fixture (DB-only, same as production) ──
    const b = await settleFixtureBets(f.id);
    const pp = await settlePlayerPropBets(f.id);
    const pl = await settleParlayLegs(f.id);
    const h = await settleH2HChallenges(f.id);

    console.log(`  ✓ ${f.homeTeam.name} ${homeGoals}-${awayGoals} ${f.awayTeam.name}  ·  ${written} stats · settled ${b} bets / ${pp} props / ${pl} parlays / ${h} H2H`);
  }

  // ── backdate the gameweek's DEADLINE into the past (only if still future) so
  //    rival squads unlock, the banner advances, and the round reads as played ──
  if (gw.deadline.getTime() > Date.now() - BACKDATE_MS) {
    await db.gameweek.update({
      where: { id: gw.id },
      data: { deadline: new Date(gw.deadline.getTime() - BACKDATE_MS) },
    });
    console.log(`  ✓ backdated "${label}" deadline into the past (rival squads now unlock, banner advances)`);
  }
}

// PlayerMatchStat has no `position`/`sub` columns (position is only for scoreMatch).
// Strip both before writing the DB row.
function statRow(line: MatchStatLine & { sub?: boolean }) {
  const { position: _pos, sub: _sub, ...rest } = line as MatchStatLine & { sub?: boolean };
  return rest;
}

async function writeMatchStatsRows(
  f: { id: string; homeTeamId: string; awayTeamId: string },
  homePlayers: PlayerLite[],
  awayPlayers: PlayerLite[],
  homeLines: Map<string, MatchStatLine & { sub: boolean }>,
  awayLines: Map<string, MatchStatLine & { sub: boolean }>,
  r: () => number,
) {
  // MatchEvent has no unique key → clear before writing so re-runs don't duplicate.
  await db.matchEvent.deleteMany({ where: { fixtureId: f.id } });

  const sides: Array<{ teamId: string; players: PlayerLite[]; lines: Map<string, MatchStatLine & { sub: boolean }> }> = [
    { teamId: f.homeTeamId, players: homePlayers, lines: homeLines },
    { teamId: f.awayTeamId, players: awayPlayers, lines: awayLines },
  ];

  for (const side of sides) {
    // Lineups (upsert) — formation 4-3-3, starters vs subs.
    for (const p of side.players) {
      const line = side.lines.get(p.id)!;
      const played = line.minutes > 0;
      if (!played && !line.sub) {
        // benched & unused → still list as a substitute for completeness
      }
      await db.matchLineup.upsert({
        where: { fixtureId_teamId_playerApiId: { fixtureId: f.id, teamId: side.teamId, playerApiId: p.apiPlayerId } },
        update: { playerName: p.name, pos: POS_LETTER[p.position], isSubstitute: line.minutes < 90, formation: "4-3-3" },
        create: { fixtureId: f.id, teamId: side.teamId, playerApiId: p.apiPlayerId, playerName: p.name, pos: POS_LETTER[p.position], isSubstitute: line.minutes < 90, formation: "4-3-3" },
      });
    }

    // Events — one per goal, one per card.
    for (const p of side.players) {
      const line = side.lines.get(p.id)!;
      for (let g = 0; g < line.goals; g++) {
        await db.matchEvent.create({
          data: { fixtureId: f.id, teamId: side.teamId, playerApiId: p.apiPlayerId, playerName: p.name, minute: between(r, 1, 90), type: "Goal", detail: "Normal Goal" },
        });
      }
      if (line.yellowCards > 0) {
        await db.matchEvent.create({
          data: { fixtureId: f.id, teamId: side.teamId, playerApiId: p.apiPlayerId, playerName: p.name, minute: between(r, 1, 90), type: "Card", detail: "Yellow Card" },
        });
      }
      if (line.redCards > 0) {
        await db.matchEvent.create({
          data: { fixtureId: f.id, teamId: side.teamId, playerApiId: p.apiPlayerId, playerName: p.name, minute: between(r, 1, 90), type: "Card", detail: "Red Card" },
        });
      }
    }

    // Team statistics (upsert).
    const poss = between(r, 38, 62);
    const stats: Array<[string, string]> = [
      ["Ball Possession", `${poss}%`],
      ["Total Shots", String(between(r, 6, 18))],
      ["Shots on Goal", String(between(r, 2, 8))],
      ["Corner Kicks", String(between(r, 1, 9))],
      ["Fouls", String(between(r, 6, 16))],
    ];
    for (const [key, value] of stats) {
      await db.matchStatistic.upsert({
        where: { fixtureId_teamId_key: { fixtureId: f.id, teamId: side.teamId, key } },
        update: { value },
        create: { fixtureId: f.id, teamId: side.teamId, key, value },
      });
    }
  }
}

// ── --seed-bets: place deterministic test wagers so a fresh DB has things to settle ──
async function seedBets(label: string) {
  const gw = await db.gameweek.findFirst({ where: { label } });
  if (!gw) return;
  const fixtures = await db.fixture.findMany({
    where: { gameweekId: gw.id, status: "SCHEDULED" },
    include: { homeTeam: { include: { players: true } }, awayTeam: true },
    take: 3,
    orderBy: { kickoff: "asc" },
  });
  if (fixtures.length < 1) { console.log("  (no scheduled fixtures to bet on)"); return; }

  const users = await db.user.findMany({ take: 2, orderBy: { createdAt: "asc" } });
  if (!users.length) { console.log("  (no users to bet)"); return; }
  const [u1, u2] = [users[0], users[1] ?? users[0]];

  console.log(`\n▶ Seeding test bets for "${label}"`);

  // Wipe any prior OPEN test bets so this is idempotent.
  await db.parlayLeg.deleteMany({ where: { parlay: { userId: { in: users.map((u) => u.id) } } } });
  await db.parlay.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await db.bet.deleteMany({ where: { userId: { in: users.map((u) => u.id) }, status: "OPEN" } });
  await db.h2HChallenge.deleteMany({ where: { OR: [{ creatorId: u1.id }, { opponentId: u1.id }] }, });

  const STAKE = 200_000;

  // 1) two singles for u1 — a match result + an anytime scorer.
  const f0 = fixtures[0];
  const topScorer = f0.homeTeam.players
    .filter((p) => p.position === "FWD" || p.position === "MID")
    .sort((a, b) => b.price - a.price)[0];
  const singles = [
    { fixtureId: f0.id, marketType: "MATCH_RESULT" as const, selection: "HOME", multiplier: 2.1 },
    ...(topScorer ? [{ fixtureId: f0.id, marketType: "PLAYER_SCORER" as const, selection: `scorer:${topScorer.id}`, multiplier: scorerMultiplier(topScorer.position as Position, topScorer.price) }] : []),
  ];
  for (const s of singles) {
    await db.bet.create({ data: { userId: u1.id, gameweekId: gw.id, fixtureId: s.fixtureId, marketType: s.marketType, selection: s.selection, stake: STAKE, multiplier: s.multiplier } });
  }
  await db.user.update({ where: { id: u1.id }, data: { bettingBalance: { decrement: STAKE * singles.length } } });

  // 2) one 2-leg parlay for u1 (over 2.5 on two fixtures, if available).
  const parlayFx = fixtures.slice(0, 2);
  if (parlayFx.length === 2) {
    const legs = parlayFx.map((f) => ({ fixtureId: f.id, marketType: "OVER_UNDER" as const, selection: "OVER_2.5", pick: "Over 2.5", multiplier: 2.0 }));
    const combo = legs.reduce((p, l) => p * l.multiplier, 1);
    await db.parlay.create({ data: { userId: u1.id, stake: STAKE, multiplier: combo, legs: { create: legs } } });
    await db.user.update({ where: { id: u1.id }, data: { bettingBalance: { decrement: STAKE } } });
  }

  // 3) one H2H between u1 and u2 (ACCEPTED so it settles) on the first fixture.
  if (u2.id !== u1.id) {
    const H2H_STAKE = 200_000;
    await db.h2HChallenge.create({
      data: {
        creatorId: u1.id, opponentId: u2.id, fixtureId: f0.id,
        selection: "HOME", multiplier: 2.1, pickLabel: f0.homeTeam.name,
        stake: H2H_STAKE, status: "ACCEPTED",
      },
    });
    await db.user.update({ where: { id: u1.id }, data: { bettingBalance: { decrement: H2H_STAKE } } });
    await db.user.update({ where: { id: u2.id }, data: { bettingBalance: { decrement: H2H_STAKE } } });
  }

  console.log(`  ✓ placed ${singles.length} singles + 1 parlay + 1 H2H (stakes deducted)`);
  void assistMultiplier; // referenced for parity; not used in the minimal seed
}

// ── --reset [--hard]: revert a gameweek to pre-match state ──
async function resetGameweek(label: string, hard: boolean) {
  const gw = await db.gameweek.findFirst({ where: { label } });
  if (!gw) { console.error(`✗ no gameweek "${label}"`); return; }
  const fixtures = await db.fixture.findMany({ where: { gameweekId: gw.id }, select: { id: true } });
  const fixtureIds = fixtures.map((f) => f.id);
  if (!fixtureIds.length) return;

  console.log(`\n▶ Resetting "${label}"${hard ? " (hard — wallets too)" : ""}`);

  // 1) delete simulated match data
  await db.matchEvent.deleteMany({ where: { fixtureId: { in: fixtureIds } } });
  await db.matchStatistic.deleteMany({ where: { fixtureId: { in: fixtureIds } } });
  await db.matchLineup.deleteMany({ where: { fixtureId: { in: fixtureIds } } });
  await db.playerMatchStat.deleteMany({ where: { fixtureId: { in: fixtureIds } } });

  // 2) fixtures back to SCHEDULED + un-backdate kickoffs (shift forward by the
  //    same amount the sim shifted them back). Guard: only shift fixtures that
  //    look backdated (kickoff sits in the far past), so reset is idempotent.
  await db.fixture.updateMany({ where: { id: { in: fixtureIds } }, data: { status: "SCHEDULED", homeScore: null, awayScore: null } });
  const cutoff = new Date(Date.now() - BACKDATE_MS + 14 * 24 * 60 * 60 * 1000); // backdated → before this
  const backdatedFx = await db.fixture.findMany({ where: { id: { in: fixtureIds }, kickoff: { lt: cutoff } }, select: { id: true, kickoff: true } });
  for (const f of backdatedFx) {
    await db.fixture.update({ where: { id: f.id }, data: { kickoff: new Date(f.kickoff.getTime() + BACKDATE_MS) } });
  }
  // un-backdate the gameweek deadline if it was shifted
  if (gw.deadline < cutoff) {
    await db.gameweek.update({ where: { id: gw.id }, data: { deadline: new Date(gw.deadline.getTime() + BACKDATE_MS) } });
  }

  // 3) re-open wagers touching these fixtures
  await db.bet.updateMany({ where: { fixtureId: { in: fixtureIds }, status: { in: ["WON", "LOST", "VOID"] } }, data: { status: "OPEN", payout: null } });
  // parlay legs → OPEN, then re-open any parent parlay whose legs touched these fixtures
  const affectedParlayIds = (await db.parlayLeg.findMany({ where: { fixtureId: { in: fixtureIds } }, select: { parlayId: true } })).map((l) => l.parlayId);
  await db.parlayLeg.updateMany({ where: { fixtureId: { in: fixtureIds } }, data: { status: "OPEN" } });
  if (affectedParlayIds.length) {
    await db.parlay.updateMany({ where: { id: { in: affectedParlayIds } }, data: { status: "OPEN", payout: null } });
  }
  await db.h2HChallenge.updateMany({ where: { fixtureId: { in: fixtureIds }, status: "SETTLED" }, data: { status: "ACCEPTED", winnerId: null, settledAt: null } });

  // 4) hard → reset every user's wallet to the stipend (clean slate)
  if (hard) {
    await db.user.updateMany({ data: { bettingBalance: STARTING_MONEY } });
  }

  console.log(`  ✓ reverted ${fixtureIds.length} fixtures, re-opened bets/parlays/H2H${hard ? `, wallets → £${STARTING_MONEY.toLocaleString("en-GB")}` : ""}`);
}

// ── main ──
async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const target = args.find((a) => !a.startsWith("--")) ?? "Group MD1";
  const reset = flags.has("--reset");
  const hard = flags.has("--hard");
  const doSeed = flags.has("--seed-bets");

  // resolve which gameweek labels to process
  let labels: string[];
  if (target === "all") {
    labels = (await db.gameweek.findMany({ orderBy: { startsAt: "asc" }, select: { label: true } })).map((g) => g.label);
  } else {
    labels = [target];
  }

  if (reset) {
    for (const l of labels) await resetGameweek(l, hard);
    console.log("\n✓ reset complete.\n");
    return;
  }

  for (const l of labels) {
    if (doSeed) await seedBets(l);
    await simulateGameweek(l);
  }
  console.log("\n✓ simulation complete — open /team, the leaderboard, /predict (My Bets), and /fixtures/<id>.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error("✗ simulate failed:", e); process.exit(1); });
