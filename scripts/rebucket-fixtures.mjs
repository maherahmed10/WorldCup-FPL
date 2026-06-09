// Reassign specific fixtures to the correct matchday bucket.
// Run with: node scripts/rebucket-fixtures.mjs
//
// Uses DIRECT_URL (port 5432) per project migration pattern.
import pg from "pg";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";

// Load .env.local
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  dotenv.populate(process.env, Object.fromEntries(
    raw.split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  ));
} catch { /* already in env */ }

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) { console.error("No DIRECT_URL or DATABASE_URL"); process.exit(1); }

const client = new pg.Client({ connectionString: url });
await client.connect();

// Find Colombia (co) and Uzbekistan (uz) teams, Congo DR (cd) team
const { rows: teams } = await client.query(`
  SELECT id, country, name FROM "Team"
  WHERE country IN ('co', 'uz', 'cd')
`);
console.log("Teams found:", teams.map(t => `${t.name} (${t.country})`).join(", "));

const byCountry = Object.fromEntries(teams.map(t => [t.country, t.id]));
const colombiaId = byCountry["co"];
const uzbekistanId = byCountry["uz"];
const congoId = byCountry["cd"];

if (!colombiaId) { console.error("Colombia not found"); process.exit(1); }
if (!uzbekistanId) { console.error("Uzbekistan not found"); process.exit(1); }
if (!congoId) { console.error("Congo DR not found"); process.exit(1); }

// Colombia vs Uzbekistan → MD1
const { rowCount: r1 } = await client.query(`
  UPDATE "Fixture"
  SET "gameweekId" = 'Group MD1'
  WHERE (
    ("homeTeamId" = $1 AND "awayTeamId" = $2)
    OR ("homeTeamId" = $2 AND "awayTeamId" = $1)
  )
`, [colombiaId, uzbekistanId]);
console.log(`Colombia vs Uzbekistan → Group MD1 (${r1} row updated)`);

// Congo DR vs Colombia → MD2
const { rowCount: r2 } = await client.query(`
  UPDATE "Fixture"
  SET "gameweekId" = 'Group MD2'
  WHERE (
    ("homeTeamId" = $3 AND "awayTeamId" = $1)
    OR ("homeTeamId" = $1 AND "awayTeamId" = $3)
  )
`, [colombiaId, uzbekistanId, congoId]);
console.log(`Congo DR vs Colombia → Group MD2 (${r2} row updated)`);

await client.end();
console.log("Done.");
