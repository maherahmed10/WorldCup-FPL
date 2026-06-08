// Adds squadBudgetBonus column to User table.
// Run ONCE after group-stage conversion feature is deployed:
//   node scripts/migrate-squad-budget-bonus.mjs
//
// Uses DIRECT_URL (port 5432) — DDL must NOT go through the pooler (6543).

import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

await client.query(`
  ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "squadBudgetBonus" INTEGER NOT NULL DEFAULT 0;
`);

console.log('✓ Added squadBudgetBonus to User (tenths of £M, default 0)');
await client.end();
