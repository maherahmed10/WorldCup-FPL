// Adds User.supportedNation column (TEXT, nullable).
// Run with: node scripts/migrate-supported-nation.mjs
// Uses DIRECT_URL (port 5432) — DDL silently fails over the pooler (port 6543).

import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const { Client } = pg;
const client = new Client({ connectionString: process.env.DIRECT_URL });

await client.connect();
try {
  await client.query(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "supportedNation" TEXT;
  `);
  console.log('✓ Added "supportedNation" to User table');
} finally {
  await client.end();
}
