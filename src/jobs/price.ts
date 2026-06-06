// ─────────────────────────────────────────────────────────────────────────
// Player pricing job (build-plan §6). Pulls each player's PRIOR-SEASON club
// production from API-Football, runs the pure pricing model, and (optionally)
// writes Player.price. Follows the architecture rule: API → this job → our DB.
//
//   npm run price                 → DRY RUN: fetch, price, print tiers, write nothing
//   npm run price -- --write      → persist Player.price to the DB
//   npm run price -- --limit 60   → only the first 60 players (fast sample)
//   npm run price -- --write --limit 60
//
// Prices in the DB are read by every lane, so the default is a safe dry run.
// ─────────────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { apiFootball } from "@/lib/api-football";
import {
  computePrices,
  teamTierFor,
  type PlayerProduction,
  type Position,
} from "@/lib/pricing";
import { leagueWeight, DEFAULT_WEIGHT } from "@/lib/league-strength";

// Seasons to try, newest first — take the first one with real stats.
const SEASONS = [2025, 2024, 2023];
const CONCURRENCY = 4; // overlaps network latency; the rate gate caps throughput

// API-Football Pro allows ~300 req/min. Space request STARTS to stay safely
// under that (concurrency alone would burst far past it → 429s silently eaten).
const MIN_INTERVAL_MS = 240; // ~250/min
const MAX_RETRIES = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let nextSlot = 0;
async function rateGate() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait) await sleep(wait);
}

const isRateLimit = (e: unknown) => /429|rate ?limit|too many/i.test((e as Error)?.message ?? "");

// One throttled, retry-on-rate-limit call. Non-rate-limit errors propagate.
async function playerSeasonThrottled(playerId: number, season: number) {
  for (let attempt = 0; ; attempt++) {
    await rateGate();
    try {
      return await apiFootball.playerSeason(playerId, season);
    } catch (e) {
      if (isRateLimit(e) && attempt < MAX_RETRIES) {
        await sleep(1500 * (attempt + 1)); // back off, then retry
        continue;
      }
      throw e;
    }
  }
}

interface Aggregate {
  // Raw totals (for the human-readable report).
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null;
  season: number | null;
  // League-strength-weighted totals (what pricing actually uses).
  wMinutes: number;
  wGoals: number;
  wAssists: number;
  wRating: number | null;
}

// Competitions that fell to the neutral default weight — surfaced at the end so
// the league table can be tightened.
const defaultedLeagues = new Map<string, number>();

// Weight a player's per-competition stats by league strength, then sum across
// all competitions in the first non-empty season.
async function fetchProduction(apiPlayerId: number): Promise<Aggregate> {
  for (const season of SEASONS) {
    let rows;
    try {
      rows = await playerSeasonThrottled(apiPlayerId, season);
    } catch {
      continue; // genuine error after retries — try the next season
    }
    const stats = rows[0]?.statistics ?? [];
    if (stats.length === 0) continue;

    let minutes = 0, goals = 0, assists = 0, ratingMin = 0, ratingSum = 0;
    let wMinutes = 0, wGoals = 0, wAssists = 0, wRatingMin = 0, wRatingSum = 0;
    for (const s of stats) {
      const m = s.games.minutes ?? 0;
      const g = s.goals.total ?? 0;
      const a = s.goals.assists ?? 0;
      const w = leagueWeight(s.league.name, s.league.country);
      if (m > 0 && w === DEFAULT_WEIGHT) {
        const key = `${s.league.name} (${s.league.country ?? "?"})`;
        defaultedLeagues.set(key, (defaultedLeagues.get(key) ?? 0) + 1);
      }
      minutes += m; goals += g; assists += a;
      wMinutes += m * w; wGoals += g * w; wAssists += a * w;
      const r = s.games.rating ? parseFloat(s.games.rating) : NaN;
      if (!Number.isNaN(r) && m > 0) {
        ratingSum += r * m; ratingMin += m;
        wRatingSum += r * m * w; wRatingMin += m * w;
      }
    }
    if (minutes === 0) continue;
    return {
      minutes, goals, assists, rating: ratingMin ? ratingSum / ratingMin : null, season,
      wMinutes, wGoals, wAssists, wRating: wRatingMin ? wRatingSum / wRatingMin : null,
    };
  }
  return { minutes: 0, goals: 0, assists: 0, rating: null, season: null, wMinutes: 0, wGoals: 0, wAssists: 0, wRating: null };
}

// Run an async mapper over items with a small concurrency cap.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function pricePlayers(opts: { write: boolean; limit?: number }) {
  const players = await db.player.findMany({
    select: { id: true, apiPlayerId: true, name: true, position: true, team: { select: { name: true } } },
    orderBy: { name: "asc" },
    ...(opts.limit ? { take: opts.limit } : {}),
  });
  console.log(`Pricing ${players.length} players${opts.limit ? ` (limited)` : ""} · ${opts.write ? "WRITE" : "DRY RUN"}`);

  let done = 0;
  const inputs = await mapLimit(players, CONCURRENCY, async (p) => {
    const agg = await fetchProduction(p.apiPlayerId);
    if (++done % 100 === 0) console.log(`  …fetched ${done}/${players.length}`);
    const input: PlayerProduction = {
      id: p.id,
      position: p.position as Position,
      // League-strength-weighted production drives the price.
      minutes: agg.wMinutes,
      goals: agg.wGoals,
      assists: agg.wAssists,
      rating: agg.wRating,
      teamTier: teamTierFor(p.team.name),
    };
    return { input, name: p.name, team: p.team.name, agg };
  });

  const priced = computePrices(inputs.map((x) => x.input));
  const priceById = new Map(priced.map((p) => [p.id, p.price]));
  const metaById = new Map(inputs.map((x) => [x.input.id, x]));

  // ── Report: distribution per position + the headline names ──
  const rows = inputs
    .map((x) => ({ ...x, price: priceById.get(x.input.id) ?? 0 }))
    .sort((a, b) => b.price - a.price || b.agg.goals - a.agg.goals);

  console.log("\nTop 15 by price:");
  for (const r of rows.slice(0, 15)) {
    console.log(
      `  £${(r.price / 10).toFixed(1).padStart(4)}m  ${r.input.position}  ${r.name.padEnd(22)} ${r.team.padEnd(14)} ` +
        `(${r.agg.season ?? "—"}: ${r.agg.goals}g ${r.agg.assists}a ${r.agg.minutes}m r${r.agg.rating?.toFixed(2) ?? "—"})`,
    );
  }

  console.log("\nPer-position price spread:");
  for (const pos of ["GK", "DEF", "MID", "FWD"] as Position[]) {
    const ps = priced.filter((p) => metaById.get(p.id)?.input.position === pos).map((p) => p.price);
    if (!ps.length) continue;
    const min = Math.min(...ps), max = Math.max(...ps);
    const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
    const noStats = priced.filter((p) => metaById.get(p.id)?.input.position === pos && (metaById.get(p.id)?.agg.season == null)).length;
    console.log(`  ${pos}: n=${ps.length}  £${(min / 10).toFixed(1)}–${(max / 10).toFixed(1)}m  avg £${(avg / 10).toFixed(1)}m  (no prior stats: ${noStats})`);
  }

  // Competitions that hit the neutral default weight — top offenders to triage.
  if (defaultedLeagues.size) {
    const top = [...defaultedLeagues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log(`\nLeagues using DEFAULT weight (${DEFAULT_WEIGHT}) — ${defaultedLeagues.size} distinct, top 20 by frequency:`);
    for (const [name, n] of top) console.log(`  ${String(n).padStart(4)}×  ${name}`);
  }

  if (!opts.write) {
    console.log("\nDRY RUN — nothing written. Re-run with `-- --write` to persist.");
    return;
  }

  // Persist in batches.
  let written = 0;
  for (const p of priced) {
    await db.player.update({ where: { id: p.id }, data: { price: p.price } });
    if (++written % 100 === 0) console.log(`  …wrote ${written}/${priced.length}`);
  }
  console.log(`\n✓ wrote prices for ${written} players.`);
}

// CLI: `npm run price -- [--write] [--limit N]`
if (process.argv[1]?.endsWith("price.ts") || process.argv[1]?.endsWith("price.js")) {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const li = args.indexOf("--limit");
  const limit = li >= 0 ? parseInt(args[li + 1], 10) : undefined;
  pricePlayers({ write, limit })
    .then(() => process.exit(0))
    .catch((e) => { console.error("✗ pricing failed:", e.message); process.exit(1); });
}
