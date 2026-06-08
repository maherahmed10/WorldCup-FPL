// ─────────────────────────────────────────────────────────────────────────
// Post-match settlement job (build-plan §4, §10 — "post-match, not live").
// For each FINISHED fixture: pull /fixtures/players, write PlayerMatchStat,
// compute fantasyPoints. Bet settlement reads the same stats (added later).
//
//   npm run settle              → settle all newly-finished fixtures
//   npm run settle -- <apiId>   → re-settle one fixture by API id
// ─────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { apiFootball } from "@/lib/api-football";
import { scoreMatch, type MatchStatLine, type Position } from "@/lib/scoring";
import { parsePlayerProp, settlePlayerProp, payout } from "@/lib/betting";

function n(v: number | null | undefined): number {
  return v ?? 0;
}

// Resolve OPEN player-prop bets on a fixture from the just-written PlayerMatchStat
// rows (ROADMAP 3.4). Idempotent — only touches OPEN bets, so re-running is safe.
// Match-market settlement (HOME/OVER_2.5/…) is ROADMAP 1.1.
async function settlePlayerPropBets(fixtureId: string): Promise<number> {
  const bets = await db.bet.findMany({
    where: {
      fixtureId,
      status: "OPEN",
      marketType: { in: ["PLAYER_SCORER", "PLAYER_ASSIST", "PLAYER_CARD"] },
    },
  });
  let settled = 0;
  for (const bet of bets) {
    const parsed = parsePlayerProp(bet.selection);
    if (!parsed) continue;
    const stat = await db.playerMatchStat.findUnique({
      where: { playerId_fixtureId: { playerId: parsed.playerId, fixtureId } },
      select: { minutes: true, goals: true, assists: true, yellowCards: true, redCards: true },
    });
    const status = settlePlayerProp(parsed.kind, stat);
    await db.bet.update({
      where: { id: bet.id },
      data: { status, payout: payout(bet.stake, bet.multiplier, status) },
    });
    settled++;
  }
  return settled;
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
  const propBets = await settlePlayerPropBets(fixture.id);
  console.log(
    `✓ settled fixture ${apiFixtureId}: ${written} player stat rows, ${propBets} player-prop bets`,
  );
  return written;
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

if (process.argv[1]?.endsWith("settle.ts") || process.argv[1]?.endsWith("settle.js")) {
  const one = process.argv[2];
  const run = one ? () => settleFixture(Number(one)) : settleAllFinished;
  run()
    .then(() => process.exit(0))
    .catch((e) => { console.error("✗ settle failed:", e.message); process.exit(1); });
}
