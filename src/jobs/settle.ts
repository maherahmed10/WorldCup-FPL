// ─────────────────────────────────────────────────────────────────────────
// Post-match settlement job (build-plan §4, §10 — "post-match, not live").
// For each FINISHED fixture: pull /fixtures/players, write PlayerMatchStat +
// compute fantasyPoints, THEN settle every OPEN bet on that fixture.
//
//   npm run settle              → settle all newly-finished fixtures (stats + bets)
//   npm run settle -- <apiId>   → re-settle one fixture by API id
//   npm run settle -- bets      → settle bets only (stats already written)
// ─────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { apiFootball } from "@/lib/api-football";
import { scoreMatch, type MatchStatLine, type Position } from "@/lib/scoring";
import { settleBetSelection, payout, type MatchResult } from "@/lib/betting";

function n(v: number | null | undefined): number {
  return v ?? 0;
}

export async function settleFixture(apiFixtureId: number) {
  const fixture = await db.fixture.findUnique({ where: { apiFixtureId } });
  if (!fixture) throw new Error(`fixture ${apiFixtureId} not in DB`);

  const teams = await apiFootball.fixturePlayers(apiFixtureId);
  const playerByApi = new Map(
    (await db.player.findMany()).map((p) => [p.apiPlayerId, p]),
  );

  let written = 0;
  for (const team of teams) {
    for (const entry of team.players) {
      const player = playerByApi.get(entry.player.id);
      if (!player) continue; // not in our pool
      const st = entry.statistics?.[0];
      if (!st) continue;

      const line: MatchStatLine = {
        position: player.position as Position,
        minutes: n(st.games.minutes),
        goals: n(st.goals.total),
        assists: n(st.goals.assists),
        yellowCards: n(st.cards.yellow),
        redCards: n(st.cards.red),
        saves: n(st.goals.saves),
        penaltiesSaved: n(st.penalty.saved),
        penaltiesMissed: n(st.penalty.missed),
        goalsConceded: n(st.goals.conceded),
        ownGoals: 0, // not in this feed slice; refine from /fixtures/events later
      };
      const fantasyPoints = scoreMatch(line);

      await db.playerMatchStat.upsert({
        where: { playerId_fixtureId: { playerId: player.id, fixtureId: fixture.id } },
        update: { ...line, rating: st.games.rating ? Number(st.games.rating) : null, fantasyPoints },
        create: {
          playerId: player.id,
          fixtureId: fixture.id,
          ...line,
          rating: st.games.rating ? Number(st.games.rating) : null,
          fantasyPoints,
        },
      });
      written++;
    }
  }
  console.log(`✓ settled fixture ${apiFixtureId}: ${written} player stat rows`);

  // After stats are written, settle any OPEN bets on this fixture.
  await settleFixtureBets(fixture.id);
  return written;
}

/**
 * Settle every OPEN bet on one fixture (by our internal Fixture.id). Builds the
 * MatchResult (final score + scorer ids) from our own DB, resolves each bet via
 * the pure settleBetSelection(), and writes status + payout. Idempotent: only
 * touches OPEN bets, so re-running never double-pays.
 */
export async function settleFixtureBets(fixtureId: string): Promise<number> {
  const fixture = await db.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) throw new Error(`fixture ${fixtureId} not in DB`);
  if (fixture.homeScore == null || fixture.awayScore == null) {
    // No final score yet — can't settle. (syncFixtures fills these for FINISHED.)
    return 0;
  }

  // Scorers: players with at least one goal in this fixture's stats.
  const scorerRows = await db.playerMatchStat.findMany({
    where: { fixtureId, goals: { gt: 0 } },
    select: { playerId: true },
  });
  const result: MatchResult = {
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    scorerIds: new Set(scorerRows.map((r) => r.playerId)),
  };

  const openBets = await db.bet.findMany({
    where: { fixtureId, status: "OPEN" },
  });

  let settled = 0;
  for (const bet of openBets) {
    const status = settleBetSelection(bet.selection, result);
    await db.bet.update({
      where: { id: bet.id },
      data: { status, payout: payout(bet.stake, bet.multiplier, status) },
    });
    settled++;
  }
  if (settled) console.log(`  ✓ bets: settled ${settled} on fixture ${fixture.apiFixtureId}`);
  return settled;
}

/** Settle bets for every finished fixture (stats assumed already written). */
export async function settleAllBets(): Promise<void> {
  const finished = await db.fixture.findMany({ where: { status: "FINISHED" } });
  let total = 0;
  for (const f of finished) {
    try {
      total += await settleFixtureBets(f.id);
    } catch (e) {
      console.error(`✗ bets fixture ${f.apiFixtureId}:`, (e as Error).message);
    }
  }
  console.log(`✓ bet settlement: ${total} bets across ${finished.length} finished fixtures`);
}

export async function settleAllFinished() {
  const finished = await db.fixture.findMany({ where: { status: "FINISHED" } });
  for (const f of finished) {
    try {
      await settleFixture(f.apiFixtureId);
    } catch (e) {
      console.error(`✗ fixture ${f.apiFixtureId}:`, (e as Error).message);
    }
  }
  console.log(`✓ settlement pass over ${finished.length} finished fixtures`);
}

// Run the CLI only when this file is the entrypoint — match the exact basename
// so other scripts that merely import it (e.g. *-settle.ts) don't trigger it.
if (/(^|\/)settle\.(ts|js)$/.test(process.argv[1] ?? "")) {
  const arg = process.argv[2];
  const run =
    arg === "bets" ? settleAllBets
    : arg ? () => settleFixture(Number(arg))
    : settleAllFinished;
  run()
    .then(() => process.exit(0))
    .catch((e) => { console.error("✗ settle failed:", e.message); process.exit(1); });
}
