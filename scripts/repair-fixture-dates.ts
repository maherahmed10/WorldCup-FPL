// ─────────────────────────────────────────────────────────────────────────
// One-time repair for fixtures/gameweeks left in a half-backdated state by the
// simulator's --reset (it shifted by a single 120-day step, so fixtures that
// were backdated more than once — or whose gameweek window drifted out of sync
// with its fixtures — never fully recovered).
//
// The backdating is ALWAYS a whole multiple of 120 days, so this restoration is
// EXACT (not a guess): for each fixture we add the unique k×120 days that lands
// its kickoff back inside its gameweek's real calendar window (GAMEWEEK_DEFS).
// We also scrub any leftover simulated state so the result is a clean pre-match
// slate, matching what `--reset --hard` was supposed to produce.
//
//   npx tsx scripts/repair-fixture-dates.ts            # apply
//   npx tsx scripts/repair-fixture-dates.ts --dry-run  # report only, no writes
// ─────────────────────────────────────────────────────────────────────────

import { db } from "../src/lib/db";
import { GAMEWEEK_DEFS, DEADLINE_LEAD_MS } from "../src/lib/gameweeks";

const BACKDATE_MS = 120 * 24 * 60 * 60 * 1000; // matches simulate-matchday.ts
const MAX_K = 5; // most backdate steps we'll try to undo
// Late North-American kickoffs roll past midnight UTC, so a fixture can sit a
// few hours outside its bucket's calendar day. Pad the k-search window so those
// still resolve. 120-day spacing means no adjacent window can collide.
const PAD_MS = 2 * 24 * 60 * 60 * 1000; // ±2 days

const dryRun = process.argv.includes("--dry-run");

function windowFor(label: string): { start: Date; end: Date } | null {
  const def = GAMEWEEK_DEFS.find((g) => g.label === label);
  if (!def) return null;
  return {
    start: new Date(`${def.startsAt}T00:00:00Z`),
    end: new Date(`${def.endsAt}T23:59:59Z`),
  };
}

// Smallest k≥0 such that kickoff + k·120d falls inside the padded window.
function correctedKickoff(kickoff: Date, start: Date, end: Date): Date | null {
  const lo = start.getTime() - PAD_MS;
  const hi = end.getTime() + PAD_MS;
  for (let k = 0; k <= MAX_K; k++) {
    const t = kickoff.getTime() + k * BACKDATE_MS;
    if (t >= lo && t <= hi) return new Date(t);
  }
  return null;
}

async function main() {
  console.log(dryRun ? "▶ DRY RUN — no writes\n" : "▶ Repairing fixture/gameweek dates\n");

  let fixturesShifted = 0;
  let fixturesUnfinished = 0;
  let unresolved = 0;
  const touchedFixtureIds: string[] = [];

  for (const def of GAMEWEEK_DEFS) {
    const win = windowFor(def.label)!;
    const gw = await db.gameweek.findFirst({ where: { label: def.label } });
    if (!gw) continue;

    const fixtures = await db.fixture.findMany({ where: { gameweekId: gw.id } });
    if (fixtures.length === 0) continue;

    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const f of fixtures) {
      const fixed = correctedKickoff(f.kickoff, win.start, win.end);
      if (!fixed) {
        console.warn(`  ⚠ ${def.label}: cannot place fixture ${f.apiFixtureId} (kickoff ${f.kickoff.toISOString()}) in window`);
        unresolved++;
        continue;
      }
      if (!earliest || fixed < earliest) earliest = fixed;
      if (!latest || fixed > latest) latest = fixed;

      const needsShift = fixed.getTime() !== f.kickoff.getTime();
      const needsUnfinish = f.status !== "SCHEDULED" || f.homeScore != null || f.awayScore != null;
      if (!needsShift && !needsUnfinish) continue;

      touchedFixtureIds.push(f.id);
      if (needsShift) {
        fixturesShifted++;
        console.log(`  ${def.label}: ${f.kickoff.toISOString()} → ${fixed.toISOString()}  (${f.apiFixtureId})`);
      }
      if (needsUnfinish) fixturesUnfinished++;

      if (!dryRun) {
        await db.fixture.update({
          where: { id: f.id },
          data: { kickoff: fixed, status: "SCHEDULED", homeScore: null, awayScore: null },
        });
      }
    }

    // Restore the gameweek window to its canonical calendar range (widening
    // endsAt to cover any late-UTC kickoff), and set the deadline to 90 min
    // before the corrected first kickoff.
    const startsAt = win.start;
    const endsAt = latest && latest > win.end ? latest : win.end;
    const deadline = earliest ? new Date(earliest.getTime() - DEADLINE_LEAD_MS) : gw.deadline;
    const windowChanged =
      gw.startsAt.getTime() !== startsAt.getTime() ||
      gw.endsAt.getTime() !== endsAt.getTime() ||
      gw.deadline.getTime() !== deadline.getTime();
    if (windowChanged) {
      console.log(
        `  ${def.label}: window/deadline → ${startsAt.toISOString()} … ${endsAt.toISOString()} | deadline ${deadline.toISOString()}`,
      );
      if (!dryRun) {
        await db.gameweek.update({
          where: { id: gw.id },
          data: { startsAt, endsAt, deadline },
        });
      }
    }
  }

  // Scrub leftover simulated match data + re-open wagers for any fixture we touched.
  if (touchedFixtureIds.length && !dryRun) {
    const where = { fixtureId: { in: touchedFixtureIds } };
    await db.matchEvent.deleteMany({ where });
    await db.matchStatistic.deleteMany({ where });
    await db.matchLineup.deleteMany({ where });
    await db.playerMatchStat.deleteMany({ where });

    await db.bet.updateMany({ where: { ...where, status: { in: ["WON", "LOST", "VOID"] } }, data: { status: "OPEN", payout: null } });
    const parlayIds = (await db.parlayLeg.findMany({ where, select: { parlayId: true } })).map((l) => l.parlayId);
    await db.parlayLeg.updateMany({ where, data: { status: "OPEN" } });
    if (parlayIds.length) await db.parlay.updateMany({ where: { id: { in: parlayIds } }, data: { status: "OPEN", payout: null } });
    await db.h2HChallenge.updateMany({ where: { ...where, status: "SETTLED" }, data: { status: "ACCEPTED", winnerId: null, settledAt: null } });
  }

  console.log(
    `\n${dryRun ? "(dry run) would have" : "✓"} shifted ${fixturesShifted} fixture date(s), unfinished ${fixturesUnfinished}, scrubbed sim data for ${touchedFixtureIds.length} fixture(s)` +
      (unresolved ? `, ${unresolved} UNRESOLVED` : ""),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error("✗ repair failed:", e); process.exit(1); });
