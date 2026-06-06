// Prisma 7+ config — connection URLs and migration settings live here
// (no longer in schema.prisma). https://pris.ly/d/config
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Used by migration/introspection CLI commands — must be the DIRECT
    // connection (Supabase port 5432), since migrations can't run over pgbouncer.
    // Falls back to DATABASE_URL for local Docker where there's only one URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
