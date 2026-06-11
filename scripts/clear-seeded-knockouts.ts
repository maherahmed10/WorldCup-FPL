// One-off cleanup: remove ALL simulation-seeded knockout fixtures (synthetic
// apiFixtureId >= 9_000_000, created by scripts/seed-knockouts.ts) so the
// knockout rounds fall back to "to be decided" until the real API-Football
// fixtures arrive as the tournament progresses.
//
// Any wagers placed against these fake fixtures are refunded to the wallet
// (OPEN bets/parlays) or the accepted H2H stakes returned to both sides, then
// the wagers and fixtures are deleted. Real (group-stage) fixtures are untouched.
//
// Run: npx tsx scripts/clear-seeded-knockouts.ts        (dry run — prints plan)
//      npx tsx scripts/clear-seeded-knockouts.ts --apply (executes)

import { db } from "@/lib/db";

const KO_BASE = 9_000_000;
const APPLY = process.argv.includes("--apply");

async function main() {
  const seeded = await db.fixture.findMany({
    where: { apiFixtureId: { gte: KO_BASE } },
    select: { id: true, apiFixtureId: true },
  });
  const ids = seeded.map((f) => f.id);
  console.log(`Seeded knockout fixtures to remove: ${ids.length}`);
  if (ids.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // ── Refund + collect wagers tied to these fixtures ──
  const bets = await db.bet.findMany({
    where: { fixtureId: { in: ids } },
    select: { id: true, userId: true, stake: true, status: true, payout: true },
  });
  const legs = await db.parlayLeg.findMany({
    where: { fixtureId: { in: ids } },
    select: { parlayId: true },
  });
  const parlayIds = [...new Set(legs.map((l) => l.parlayId))];
  const parlays = await db.parlay.findMany({
    where: { id: { in: parlayIds } },
    select: { id: true, userId: true, stake: true, status: true, payout: true },
  });
  const h2h = await db.h2HChallenge.findMany({
    where: { fixtureId: { in: ids } },
    select: { id: true, creatorId: true, opponentId: true, stake: true, status: true },
  });

  // Refund map: userId -> pounds to credit back.
  const refund = new Map<string, number>();
  const add = (uid: string | null, amt: number) => {
    if (!uid || amt <= 0) return;
    refund.set(uid, (refund.get(uid) ?? 0) + amt);
  };

  // Single bets: OPEN → refund stake. WON → already paid; claw back the payout,
  // refund nothing (net zero). LOST/VOID handled by payout (VOID already refunded).
  for (const b of bets) {
    if (b.status === "OPEN") add(b.userId, b.stake);
  }
  // Parlays: same rule.
  for (const p of parlays) {
    if (p.status === "OPEN") add(p.userId, p.stake);
  }
  // H2H: ACCEPTED means both sides' stakes are locked → refund both.
  for (const c of h2h) {
    if (c.status === "ACCEPTED" || c.status === "PENDING") {
      add(c.creatorId, c.stake);
      if (c.status === "ACCEPTED") add(c.opponentId, c.stake);
    }
  }

  console.log(`\nWagers tied to seeded fixtures: ${bets.length} bets, ${parlays.length} parlays, ${h2h.length} H2H`);
  console.log("Refunds to apply:");
  for (const [uid, amt] of refund) console.log(`  user ${uid.slice(0, 8)}… +£${amt.toLocaleString()}`);

  if (!APPLY) {
    console.log("\n(dry run — re-run with --apply to execute)");
    return;
  }

  await db.$transaction(async (tx) => {
    // Refund wallets.
    for (const [uid, amt] of refund) {
      await tx.user.update({ where: { id: uid }, data: { bettingBalance: { increment: amt } } });
    }
    // Delete wagers (legs cascade with parlay; delete explicitly to be safe).
    await tx.parlayLeg.deleteMany({ where: { fixtureId: { in: ids } } });
    if (parlayIds.length) await tx.parlay.deleteMany({ where: { id: { in: parlayIds } } });
    await tx.bet.deleteMany({ where: { fixtureId: { in: ids } } });
    await tx.h2HChallenge.deleteMany({ where: { fixtureId: { in: ids } } });
    // Any match data (should be 0 post-reset, but be thorough).
    await tx.playerMatchStat.deleteMany({ where: { fixtureId: { in: ids } } });
    await tx.matchEvent.deleteMany({ where: { fixtureId: { in: ids } } });
    await tx.matchStatistic.deleteMany({ where: { fixtureId: { in: ids } } });
    await tx.matchLineup.deleteMany({ where: { fixtureId: { in: ids } } });
    await tx.fixtureOdds.deleteMany({ where: { fixtureId: { in: ids } } });
    // Finally the fake fixtures themselves.
    await tx.fixture.deleteMany({ where: { id: { in: ids } } });
  });

  console.log(`\n✓ removed ${ids.length} seeded knockout fixtures + refunded ${refund.size} user(s).`);
  console.log("Knockout rounds will now show 'to be decided' until real API fixtures arrive.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
