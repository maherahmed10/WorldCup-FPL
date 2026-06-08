#!/usr/bin/env node
// One-time migration: creates the GameweekPick table (per-gameweek captain +
// vice). Run: `node scripts/migrate-gameweek-pick.mjs`.
//
// IMPORTANT: uses the DIRECT connection (port 5432), NOT the pooled one (6543).
// DDL like CREATE TABLE does NOT reliably persist over Supabase's pgbouncer
// pooler in transaction mode — it can appear to succeed but not commit. Always
// run schema changes through DIRECT_URL.
import "dotenv/config";
import pg from "pg";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DATABASE_URL) not set — see .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS "GameweekPick" (
    "id"         TEXT NOT NULL,
    "userId"     UUID NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "captainId"  TEXT NOT NULL,
    "viceId"     TEXT NOT NULL,
    CONSTRAINT "GameweekPick_pkey" PRIMARY KEY ("id")
  );`);
console.log("✓ GameweekPick table");

await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "GameweekPick_userId_gameweekId_key" ON "GameweekPick"("userId","gameweekId");`);
await client.query(`CREATE INDEX IF NOT EXISTS "GameweekPick_userId_idx" ON "GameweekPick"("userId");`);
console.log("✓ indexes");

await client.query(`DO $$ BEGIN
  ALTER TABLE "GameweekPick" ADD CONSTRAINT "GameweekPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
await client.query(`DO $$ BEGIN
  ALTER TABLE "GameweekPick" ADD CONSTRAINT "GameweekPick_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
console.log("✓ foreign keys");

const r = await client.query(`SELECT count(*)::int AS n FROM "GameweekPick";`);
console.log(`✓ migration complete — GameweekPick rows: ${r.rows[0].n}`);
await client.end();
