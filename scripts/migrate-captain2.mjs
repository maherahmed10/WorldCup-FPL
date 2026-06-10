// Adds GameweekPick.captain2Id column (TEXT, nullable) — the SECOND captain
// enabled by the Extra Captain perk (both captains score ×2).
// Run with: node scripts/migrate-captain2.mjs
// Uses DIRECT_URL (port 5432) — DDL silently fails over the pooler (port 6543).

import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const { Client } = pg;
const client = new Client({ connectionString: process.env.DIRECT_URL });

await client.connect();
try {
  await client.query(`
    ALTER TABLE "GameweekPick"
    ADD COLUMN IF NOT EXISTS "captain2Id" TEXT;
  `);
  console.log('✓ Added "captain2Id" to GameweekPick table');
} finally {
  await client.end();
}
