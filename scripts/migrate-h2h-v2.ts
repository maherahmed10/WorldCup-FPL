// Replaces the AI-based H2HChallenge table with the simplified market-based one.
// Run ONCE: npx tsx scripts/migrate-h2h-v2.ts
import { db } from "../src/lib/db";

async function main() {
  console.log("Running H2H v2 migration…");

  // Drop old table (no real data yet — was just created).
  await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "H2HChallenge";`);
  // Recreate enum (may have been implicitly dropped with the table).
  await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "H2HStatus";`);
  await db.$executeRawUnsafe(`CREATE TYPE "H2HStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED','SETTLED','CANCELLED');`);
  console.log("✓ Dropped old H2HChallenge table, recreated H2HStatus enum");

  await db.$executeRawUnsafe(`
    CREATE TABLE "H2HChallenge" (
      "id"         TEXT             NOT NULL,
      "creatorId"  UUID             NOT NULL,
      "opponentId" UUID             NOT NULL,
      "fixtureId"  TEXT             NOT NULL,
      "selection"  TEXT             NOT NULL,
      "multiplier" DOUBLE PRECISION NOT NULL,
      "pickLabel"  TEXT             NOT NULL,
      "stake"      INTEGER          NOT NULL,
      "status"     "H2HStatus"      NOT NULL DEFAULT 'PENDING',
      "winnerId"   UUID,
      "settledAt"  TIMESTAMP(3),
      "createdAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "H2HChallenge_pkey" PRIMARY KEY ("id")
    );
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "H2HChallenge"
      ADD CONSTRAINT "H2HChallenge_creatorId_fkey"
        FOREIGN KEY ("creatorId")  REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      ADD CONSTRAINT "H2HChallenge_opponentId_fkey"
        FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      ADD CONSTRAINT "H2HChallenge_winnerId_fkey"
        FOREIGN KEY ("winnerId")   REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      ADD CONSTRAINT "H2HChallenge_fixtureId_fkey"
        FOREIGN KEY ("fixtureId")  REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  `);

  await db.$executeRawUnsafe(`CREATE INDEX "H2HChallenge_creatorId_idx"  ON "H2HChallenge"("creatorId");`);
  await db.$executeRawUnsafe(`CREATE INDEX "H2HChallenge_opponentId_idx" ON "H2HChallenge"("opponentId");`);
  await db.$executeRawUnsafe(`CREATE INDEX "H2HChallenge_status_idx"     ON "H2HChallenge"("status");`);
  await db.$executeRawUnsafe(`CREATE INDEX "H2HChallenge_fixtureId_idx"  ON "H2HChallenge"("fixtureId");`);

  console.log("✓ New H2HChallenge table created");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
