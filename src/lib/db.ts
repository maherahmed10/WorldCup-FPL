// Prisma client singleton (Prisma 7 + pg driver adapter).
//
// Prisma 7's default engine requires a driver adapter; we use @prisma/adapter-pg
// pointed at DATABASE_URL (Supabase transaction pooler, port 6543). The singleton
// avoids exhausting connections during Next.js hot-reload.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Standalone CLI scripts (sync/settle/seed) need .env.local loaded; in Next.js
// the framework already injects env, and this import is a harmless no-op there.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
