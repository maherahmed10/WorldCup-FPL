#!/usr/bin/env node
// One-time migration: Parlay + ParlayLeg tables (accumulator bets).
// Run: `node scripts/migrate-parlay.mjs`.
// Uses DIRECT_URL (5432) — DDL does NOT persist over the pgbouncer pooler.
import "dotenv/config";
import pg from "pg";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) { console.error("DIRECT_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS "Parlay" (
    "id"         TEXT NOT NULL,
    "userId"     UUID NOT NULL,
    "stake"      INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "status"     "BetStatus" NOT NULL DEFAULT 'OPEN',
    "payout"     INTEGER,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Parlay_pkey" PRIMARY KEY ("id")
  );`);
console.log("✓ Parlay table");

await client.query(`
  CREATE TABLE IF NOT EXISTS "ParlayLeg" (
    "id"         TEXT NOT NULL,
    "parlayId"   TEXT NOT NULL,
    "fixtureId"  TEXT NOT NULL,
    "marketType" "MarketType" NOT NULL,
    "selection"  TEXT NOT NULL,
    "pick"       TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "status"     "BetStatus" NOT NULL DEFAULT 'OPEN',
    CONSTRAINT "ParlayLeg_pkey" PRIMARY KEY ("id")
  );`);
console.log("✓ ParlayLeg table");

await client.query(`CREATE INDEX IF NOT EXISTS "Parlay_userId_idx" ON "Parlay"("userId");`);
await client.query(`CREATE INDEX IF NOT EXISTS "ParlayLeg_parlayId_idx" ON "ParlayLeg"("parlayId");`);
await client.query(`CREATE INDEX IF NOT EXISTS "ParlayLeg_fixtureId_idx" ON "ParlayLeg"("fixtureId");`);
console.log("✓ indexes");

const fk = async (sql) => {
  await client.query(`DO $$ BEGIN ${sql} EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
};
await fk(`ALTER TABLE "Parlay" ADD CONSTRAINT "Parlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;`);
await fk(`ALTER TABLE "ParlayLeg" ADD CONSTRAINT "ParlayLeg_parlayId_fkey" FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id") ON DELETE CASCADE;`);
await fk(`ALTER TABLE "ParlayLeg" ADD CONSTRAINT "ParlayLeg_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE;`);
console.log("✓ foreign keys");

const r = await client.query(`SELECT count(*)::int AS n FROM "Parlay";`);
console.log(`✓ migration complete — Parlay rows: ${r.rows[0].n}`);
await client.end();
