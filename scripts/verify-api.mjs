#!/usr/bin/env node
/**
 * Step Zero — API-Football verification harness.
 *
 * Confirms the 2026 World Cup data is live and your key/plan can reach it
 * BEFORE anyone prices players or builds on top of the feed.
 *
 * Usage:
 *   APISPORTS_KEY=your_key_here node scripts/verify-api.mjs
 *
 * Get a key: https://dashboard.api-football.com  (or rapidapi.com/api-sports)
 * Note: the World Cup is a paid-league season — the FREE tier (100 req/day)
 * often EXCLUDES current seasons. If you get empty results with a 200 status,
 * that is almost always a plan-tier limitation, not a bug.
 */

const KEY = process.env.APISPORTS_KEY;
const BASE = "https://v3.football.api-sports.io";
const LEAGUE = 1; // World Cup league id in API-Football
const SEASON = 2026;

if (!KEY) {
  console.error("\n❌ No APISPORTS_KEY set.\n   Run: APISPORTS_KEY=your_key node scripts/verify-api.mjs\n");
  process.exit(1);
}

async function call(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: { "x-apisports-key": KEY } });
  const json = await res.json();
  return { status: res.status, json };
}

function summarize(label, { status, json }) {
  const errors = json?.errors;
  const hasErrors = errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length);
  const count = json?.results ?? (Array.isArray(json?.response) ? json.response.length : 0);
  const flag = hasErrors ? "❌" : count > 0 ? "✅" : "⚠️ ";
  console.log(`${flag} ${label.padEnd(34)} status=${status}  results=${count}`);
  if (hasErrors) console.log("     errors:", JSON.stringify(errors));
  return { count, hasErrors };
}

(async () => {
  console.log(`\n🔎 Verifying API-Football  (league=${LEAGUE}, season=${SEASON})\n`);

  // 0. Account status & quota — tells you your plan + remaining requests.
  const status = await call("/status");
  if (status.json?.response) {
    const r = status.json.response;
    console.log(`👤 Account: ${r.account?.firstname ?? "?"}  plan=${r.subscription?.plan ?? "?"}  active=${r.subscription?.active}`);
    console.log(`📊 Requests today: ${r.requests?.current}/${r.requests?.limit_day}\n`);
  } else {
    console.log("⚠️  Could not read /status (key may be invalid or rate-limited).\n");
  }

  // 1. Teams — should be 48 for the 2026 format.
  const teams = summarize("Teams (/teams)", await call(`/teams?league=${LEAGUE}&season=${SEASON}`));

  // 2. Fixtures — full schedule (104 matches expected).
  const fixtures = summarize("Fixtures (/fixtures)", await call(`/fixtures?league=${LEAGUE}&season=${SEASON}`));

  // 3. Rounds — drives gameweek/transfer-window buckets.
  const rounds = summarize("Rounds (/fixtures/rounds)", await call(`/fixtures/rounds?league=${LEAGUE}&season=${SEASON}`));

  // 4. Players page 1 — THE critical one. Rosters fill in toward kickoff.
  const players = summarize("Players page 1 (/players)", await call(`/players?league=${LEAGUE}&season=${SEASON}&page=1`));

  // 5. Standings — empty until matches are played; fine if ⚠️ pre-tournament.
  summarize("Standings (/standings)", await call(`/standings?league=${LEAGUE}&season=${SEASON}`));

  console.log("\n──────────── VERDICT ────────────");
  const fail = (x) => x.hasErrors || x.count === 0;
  if (fail(teams) || fail(fixtures)) {
    console.log("❌ Core data (teams/fixtures) is empty. Likely a PLAN-TIER limit:");
    console.log("   the free tier usually excludes current-season paid leagues.");
    console.log("   → Upgrade to a paid plan, or confirm league/season ids.");
  } else if (fail(players)) {
    console.log("⚠️  Teams & fixtures OK, but PLAYER ROSTERS are not fully populated yet.");
    console.log("   This is expected this far from kickoff. Build the data layer now,");
    console.log("   but DELAY player pricing until /players returns full squads.");
  } else {
    console.log("✅ All green. 2026 World Cup data is live and reachable on your plan.");
    console.log("   Safe to build the data layer AND start pricing players.");
  }
  console.log("─────────────────────────────────\n");
})().catch((e) => {
  console.error("\n❌ Request failed:", e.message);
  console.error("   Check network / key. A 499/403 usually means wrong key or plan.\n");
  process.exit(1);
});
