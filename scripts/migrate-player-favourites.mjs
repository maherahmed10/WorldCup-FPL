import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS "PlayerFavourite" (
    "userId"    UUID        NOT NULL,
    "playerId"  TEXT        NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY ("userId", "playerId"),
    FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE CASCADE,
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE
  );
`);
await client.query(`CREATE INDEX IF NOT EXISTS "PlayerFavourite_userId_idx" ON "PlayerFavourite"("userId");`);

console.log("PlayerFavourite table ready.");
await client.end();
