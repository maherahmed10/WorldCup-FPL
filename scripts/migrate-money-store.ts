#!/usr/bin/env node
// One-time migration: adds bettingBalance to User, creates StoreItem + UserPerk
// tables, and seeds the store catalogue.
// Run: npx tsx scripts/migrate-money-store.ts
import { db } from "../src/lib/db";

async function main() {
  console.log("Running migration: money economy + store tables…");

  await db.$executeRawUnsafe(`
    ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "bettingBalance" INTEGER NOT NULL DEFAULT 1000;
  `);
  console.log("✓ User.bettingBalance column");

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StoreItem" (
      "id"          TEXT    NOT NULL,
      "name"        TEXT    NOT NULL,
      "description" TEXT    NOT NULL,
      "cost"        INTEGER NOT NULL,
      "effectKey"   TEXT    NOT NULL,
      CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
    );
  `);
  console.log("✓ StoreItem table");

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserPerk" (
      "id"          TEXT        NOT NULL,
      "userId"      UUID        NOT NULL,
      "storeItemId" TEXT        NOT NULL,
      "gameweekId"  TEXT,
      "usedAt"      TIMESTAMP(3),
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserPerk_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "UserPerk_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "UserPerk_storeItemId_fkey"
        FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);
  console.log("✓ UserPerk table");

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserPerk_userId_idx" ON "UserPerk"("userId");
  `);
  console.log("✓ UserPerk index");

  // Seed catalogue items (idempotent — ON CONFLICT DO NOTHING).
  await db.$executeRawUnsafe(`
    INSERT INTO "StoreItem" ("id", "name", "description", "cost", "effectKey") VALUES
      ('perk_country_slot',
       '+1 Country Slot',
       'Raise the max players per country in your squad from 3 to 4.',
       500, 'country_slot'),
      ('perk_extra_captain',
       'Extra Captain',
       'Your captain scores triple points for one gameweek.',
       300, 'extra_captain'),
      ('perk_extra_transfer',
       'Extra Transfer',
       'One free transfer outside the normal transfer window.',
       200, 'extra_transfer'),
      ('perk_bench_boost',
       'Bench Boost',
       'Your bench players'' points count for one full gameweek.',
       250, 'bench_boost')
    ON CONFLICT ("id") DO NOTHING;
  `);
  console.log("✓ Store catalogue seeded (4 items)");

  await db.$executeRawUnsafe(`
    ALTER TABLE "Squad"
      ADD COLUMN IF NOT EXISTS "transfersUsed" INTEGER NOT NULL DEFAULT 0;
  `);
  console.log("✓ Squad.transfersUsed column");

  await db.$disconnect();
  console.log("Migration complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
