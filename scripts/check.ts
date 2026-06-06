#!/usr/bin/env node
/**
 * Setup sanity check — confirms your .env.local connects to the shared Supabase
 * DB and that the real World Cup data is present. Run: `npm run check`.
 *
 * Loads .env.local, queries a few counts via Prisma. Prints a clear pass/fail.
 */
// db.ts loads .env.local itself; import it for the shared Prisma singleton.
import { db } from "../src/lib/db";

const EXPECT = { teams: 48, players: 1000, fixtures: 72 }; // players is a floor (squads ~1248)

(async () => {
  try {
    const [teams, players, fixtures, gameweeks] = await Promise.all([
      db.team.count(),
      db.player.count(),
      db.fixture.count(),
      db.gameweek.count(),
    ]);

    console.log(
      `\n  teams ${teams} · players ${players} · fixtures ${fixtures} · gameweeks ${gameweeks}\n`,
    );

    const ok =
      teams >= EXPECT.teams &&
      players >= EXPECT.players &&
      fixtures >= EXPECT.fixtures;

    if (ok) {
      console.log("✅ Connected to the shared DB and the World Cup data is present.\n");
    } else {
      console.log("⚠️  Connected, but the data looks thin. Counts below expected.");
      console.log("   Expected at least:", EXPECT);
      console.log("   Ping Youssef — the DB may need a re-sync.\n");
    }
    await db.$disconnect();
    process.exit(ok ? 0 : 1);
  } catch (e) {
    console.error("\n❌ Could not reach the database.\n");
    console.error("   " + (e instanceof Error ? e.message : String(e)) + "\n");
    console.error("   Most common cause: DIRECT_URL must use the POOLER host on");
    console.error("   port 5432 (aws-...pooler.supabase.com), NOT db.<ref>.supabase.co");
    console.error("   (that host is IPv6-only and won't resolve). Ask Youssef for");
    console.error("   the correct .env.local values.\n");
    process.exit(1);
  }
})();
