#!/usr/bin/env node
// One-time migration: creates MatchEvent, MatchStatistic, MatchLineup tables.
// Run: `node scripts/migrate-match-stats.mjs`
//
// IMPORTANT: uses the DIRECT connection (port 5432), NOT the pooled one (6543).
// DDL like CREATE TABLE does NOT reliably persist over Supabase pgbouncer
// in transaction mode. Always use DIRECT_URL for schema changes.
import "dotenv/config";
import pg from "pg";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DATABASE_URL) not set — see .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

// ── MatchEvent ────────────────────────────────────────────────────────────────
await client.query(`
  CREATE TABLE IF NOT EXISTS "MatchEvent" (
    "id"          TEXT NOT NULL,
    "fixtureId"   TEXT NOT NULL,
    "teamId"      TEXT NOT NULL,
    "playerApiId" INTEGER,
    "playerName"  TEXT NOT NULL,
    "assistApiId" INTEGER,
    "assistName"  TEXT,
    "minute"      INTEGER NOT NULL,
    "extraMinute" INTEGER,
    "type"        TEXT NOT NULL,
    "detail"      TEXT NOT NULL,
    "comments"    TEXT,
    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
  );`);
console.log("✓ MatchEvent table");

await client.query(`CREATE INDEX IF NOT EXISTS "MatchEvent_fixtureId_idx" ON "MatchEvent"("fixtureId");`);
await client.query(`CREATE INDEX IF NOT EXISTS "MatchEvent_teamId_idx" ON "MatchEvent"("teamId");`);

await client.query(`DO $$ BEGIN
  ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_fixtureId_fkey"
    FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
await client.query(`DO $$ BEGIN
  ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
console.log("✓ MatchEvent indexes + FK");

// ── MatchStatistic ────────────────────────────────────────────────────────────
await client.query(`
  CREATE TABLE IF NOT EXISTS "MatchStatistic" (
    "id"        TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "teamId"    TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    CONSTRAINT "MatchStatistic_pkey" PRIMARY KEY ("id")
  );`);
console.log("✓ MatchStatistic table");

await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "MatchStatistic_fixtureId_teamId_key_key"
  ON "MatchStatistic"("fixtureId","teamId","key");`);
await client.query(`CREATE INDEX IF NOT EXISTS "MatchStatistic_fixtureId_idx" ON "MatchStatistic"("fixtureId");`);

await client.query(`DO $$ BEGIN
  ALTER TABLE "MatchStatistic" ADD CONSTRAINT "MatchStatistic_fixtureId_fkey"
    FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
await client.query(`DO $$ BEGIN
  ALTER TABLE "MatchStatistic" ADD CONSTRAINT "MatchStatistic_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
console.log("✓ MatchStatistic indexes + FK");

// ── MatchLineup ───────────────────────────────────────────────────────────────
await client.query(`
  CREATE TABLE IF NOT EXISTS "MatchLineup" (
    "id"            TEXT NOT NULL,
    "fixtureId"     TEXT NOT NULL,
    "teamId"        TEXT NOT NULL,
    "formation"     TEXT,
    "playerApiId"   INTEGER NOT NULL,
    "playerName"    TEXT NOT NULL,
    "playerNumber"  INTEGER,
    "pos"           TEXT,
    "grid"          TEXT,
    "isSubstitute"  BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MatchLineup_pkey" PRIMARY KEY ("id")
  );`);
console.log("✓ MatchLineup table");

await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "MatchLineup_fixtureId_teamId_playerApiId_key"
  ON "MatchLineup"("fixtureId","teamId","playerApiId");`);
await client.query(`CREATE INDEX IF NOT EXISTS "MatchLineup_fixtureId_idx" ON "MatchLineup"("fixtureId");`);
await client.query(`CREATE INDEX IF NOT EXISTS "MatchLineup_teamId_idx" ON "MatchLineup"("teamId");`);

await client.query(`DO $$ BEGIN
  ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_fixtureId_fkey"
    FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
await client.query(`DO $$ BEGIN
  ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
console.log("✓ MatchLineup indexes + FK");

const counts = await client.query(`
  SELECT
    (SELECT count(*)::int FROM "MatchEvent") AS events,
    (SELECT count(*)::int FROM "MatchStatistic") AS statistics,
    (SELECT count(*)::int FROM "MatchLineup") AS lineups;
`);
const { events, statistics, lineups } = counts.rows[0];
console.log(`✓ migration complete — MatchEvent:${events}  MatchStatistic:${statistics}  MatchLineup:${lineups}`);
await client.end();
