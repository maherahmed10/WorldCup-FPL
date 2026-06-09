// Migrate: add H2HChallenge table, H2HStatus enum, update bettingBalance default.
// Run ONCE: npx tsx scripts/migrate-h2h.ts
import { db } from "../src/lib/db";

async function main() {
  console.log("Running H2H migration…");

  await db.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'H2HStatus') THEN
      CREATE TYPE "H2HStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED','SETTLED','CANCELLED');
    END IF;
  END $$;`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "H2HChallenge" (
      "id"             TEXT          NOT NULL,
      "creatorId"      UUID          NOT NULL,
      "opponentId"     UUID          NOT NULL,
      "text"           TEXT          NOT NULL,
      "interpretation" TEXT          NOT NULL,
      "probability"    DOUBLE PRECISION NOT NULL,
      "multiplier"     DOUBLE PRECISION NOT NULL,
      "confidence"     TEXT          NOT NULL,
      "aiReasoning"    TEXT          NOT NULL,
      "creatorStake"   INTEGER       NOT NULL,
      "opponentStake"  INTEGER       NOT NULL,
      "fixtureId"      TEXT,
      "status"         "H2HStatus"   NOT NULL DEFAULT 'PENDING',
      "winnerId"       UUID,
      "settledAt"      TIMESTAMP(3),
      "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "H2HChallenge_pkey" PRIMARY KEY ("id")
    );
  `);

  // Foreign keys (idempotent via DO $$ … IF NOT EXISTS)
  await db.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'H2HChallenge_creatorId_fkey'
    ) THEN
      ALTER TABLE "H2HChallenge"
        ADD CONSTRAINT "H2HChallenge_creatorId_fkey"
        FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$;`);

  await db.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'H2HChallenge_opponentId_fkey'
    ) THEN
      ALTER TABLE "H2HChallenge"
        ADD CONSTRAINT "H2HChallenge_opponentId_fkey"
        FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$;`);

  await db.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'H2HChallenge_winnerId_fkey'
    ) THEN
      ALTER TABLE "H2HChallenge"
        ADD CONSTRAINT "H2HChallenge_winnerId_fkey"
        FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$;`);

  await db.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'H2HChallenge_fixtureId_fkey'
    ) THEN
      ALTER TABLE "H2HChallenge"
        ADD CONSTRAINT "H2HChallenge_fixtureId_fkey"
        FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$;`);

  // Indexes
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "H2HChallenge_creatorId_idx"  ON "H2HChallenge"("creatorId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "H2HChallenge_opponentId_idx" ON "H2HChallenge"("opponentId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "H2HChallenge_status_idx"     ON "H2HChallenge"("status");`);

  // Update bettingBalance default + reset all users to £5,000,000
  await db.$executeRawUnsafe(`ALTER TABLE "User" ALTER COLUMN "bettingBalance" SET DEFAULT 5000000;`);
  const updated = await db.$executeRawUnsafe(`UPDATE "User" SET "bettingBalance" = 5000000;`);
  console.log(`✓ H2HChallenge table ready`);
  console.log(`✓ User.bettingBalance default → 5,000,000; reset ${updated} user(s)`);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
