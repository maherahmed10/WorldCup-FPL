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
  // RAW season totals (summed across competitions) — the scorer turns these
  // into per-90 rates. Also shown in the report.
  minutes: number;
  goals: number;
  assists: number;
  shotsOn: number;
  keyPasses: number;
  defActions: number;
  saves: number;
  conceded: number;
  rating: number | null;
  season: number | null;
  // Minutes-weighted average competition strength (applied once in the scorer).
  leagueWeight: number;
}

// Competitions that fell to the neutral default weight — surfaced at the end so
// the league table can be tightened.
const defaultedLeagues = new Map<string, number>();

// Sum a player's underlying metrics across all competitions in the first
// non-empty season, and the minutes-weighted average league strength.
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

    let minutes = 0, goals = 0, assists = 0, shotsOn = 0, keyPasses = 0;
    let defActions = 0, saves = 0, conceded = 0;
    let ratingMin = 0, ratingSum = 0, wMinutes = 0;
    for (const s of stats) {
      const m = s.games.minutes ?? 0;
      const w = leagueWeight(s.league.name, s.league.country);
      if (m > 0 && w === DEFAULT_WEIGHT) {
        const key = `${s.league.name} (${s.league.country ?? "?"})`;
        defaultedLeagues.set(key, (defaultedLeagues.get(key) ?? 0) + 1);
      }
      minutes += m;
      goals += s.goals.total ?? 0;
      assists += s.goals.assists ?? 0;
      shotsOn += s.shots?.on ?? 0;
      keyPasses += s.passes?.key ?? 0;
      defActions += (s.tackles?.total ?? 0) + (s.tackles?.interceptions ?? 0) + (s.tackles?.blocks ?? 0);
      saves += s.goals.saves ?? 0;
      conceded += s.goals.conceded ?? 0;
      wMinutes += m * w;
      const r = s.games.rating ? parseFloat(s.games.rating) : NaN;
      if (!Number.isNaN(r) && m > 0) {
        ratingSum += r * m; ratingMin += m;
      }
    }
    if (minutes === 0) continue;
    return {
      minutes, goals, assists, shotsOn, keyPasses, defActions, saves, conceded,
      rating: ratingMin ? ratingSum / ratingMin : null, season,
      leagueWeight: wMinutes / minutes,
    };
  }
  return {
    minutes: 0, goals: 0, assists: 0, shotsOn: 0, keyPasses: 0, defActions: 0,
    saves: 0, conceded: 0, rating: null, season: null, leagueWeight: DEFAULT_WEIGHT,
  };
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
      minutes: agg.minutes,
      goals: agg.goals,
      assists: agg.assists,
      shotsOn: agg.shotsOn,
      keyPasses: agg.keyPasses,
      defActions: agg.defActions,
      saves: agg.saves,
      conceded: agg.conceded,
      rating: agg.rating,
      leagueWeight: agg.leagueWeight,
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
        `(${r.agg.season ?? "—"}: ${r.agg.goals}g ${r.agg.assists}a ${r.agg.shotsOn}sot ${r.agg.keyPasses}kp ${r.agg.minutes}m r${r.agg.rating?.toFixed(2) ?? "—"} lw${r.agg.leagueWeight.toFixed(2)})`,
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
