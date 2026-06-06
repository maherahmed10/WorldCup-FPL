// ─────────────────────────────────────────────────────────────────────────
// Player pricing (build-plan §6). The API gives NO projected points, so price
// is OUR formula. Pure + unit-tested; the job (src/jobs/price.ts) feeds in each
// player's prior-season club production and writes the result to Player.price.
//
// Model:
//   1. productionScore — an FPL-flavoured estimate of last season's output
//      (appearances + goals×position-weight + assists + rating bonus). Totals,
//      not per-90, so a 20-goal striker outranks a 1-goal cameo.
//   2. × team-tier nudge — a hand-coded nation strength bucket (§6 allows
//      hand-tiering); modest (0.9–1.15) so stats dominate.
//   3. → per-position price band by percentile rank, rounded to 0.5M steps.
//      Bands mirror the design tiers and make a full-strength XV cost >100M,
//      so the budget bites.
// ─────────────────────────────────────────────────────────────────────────

export type Position = "GK" | "DEF" | "MID" | "FWD";

// Goal weight by position (same shape as the FPL scoring core).
const GOAL_W: Record<Position, number> = { GK: 6, DEF: 6, MID: 5, FWD: 4 };

export interface ProductionInput {
  position: Position;
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null; // season avg, 0–10; null when unknown
}

/** Rough "if last season were FPL, how many points" — totals-based. */
export function productionScore(p: ProductionInput): number {
  const minutes = Math.max(0, p.minutes);
  const nineties = minutes / 90;
  const appearance = nineties * 2; // ~2 pts per full match played
  const goals = Math.max(0, p.goals) * GOAL_W[p.position];
  const assists = Math.max(0, p.assists) * 3;
  // Reward a high rating sustained across many minutes (not a one-game fluke).
  const rating = p.rating ?? 6.5;
  const ratingBonus = Math.max(0, rating - 6.5) * nineties * 1.5;
  return appearance + goals + assists + ratingBonus;
}

// ── Hand-coded nation strength tiers (keyed by Team.name as stored in our DB) ──
// Default is 1.0 for any nation not listed, so the table never blocks pricing.
const TEAM_TIER: Record<string, number> = {
  // Tier 1 — top contenders
  Argentina: 1.15, France: 1.15, Brazil: 1.15, England: 1.15,
  Spain: 1.15, Portugal: 1.15, Netherlands: 1.15, Germany: 1.15,
  // Tier 2 — strong
  Belgium: 1.07, Croatia: 1.07, Uruguay: 1.07, Colombia: 1.07,
  Morocco: 1.07, Switzerland: 1.07, Japan: 1.07, USA: 1.07,
  Mexico: 1.07, Senegal: 1.07, Norway: 1.07, "South Korea": 1.07,
  Ecuador: 1.07, Austria: 1.07,
  // Tier 4 — weakest of the field
  "New Zealand": 0.9, Haiti: 0.9, "Curaçao": 0.9, "Cape Verde Islands": 0.9,
  "Congo DR": 0.9, Jordan: 0.9, Iraq: 0.9, Uzbekistan: 0.9, Panama: 0.9,
  "South Africa": 0.9, Qatar: 0.9, "Saudi Arabia": 0.9, "Bosnia & Herzegovina": 0.9,
  // everything else (Australia, Canada, Czech Republic, Egypt, Türkiye,
  // Scotland, Ivory Coast, Ghana, Algeria, Tunisia, Paraguay, Iran, Sweden) → 1.0
};

export function teamTierFor(teamName: string): number {
  return TEAM_TIER[teamName] ?? 1.0;
}

// Per-position price bands in TENTHS of a million (Player.price unit).
// e.g. [50, 130] = £5.0m … £13.0m.
export const POSITION_BANDS: Record<Position, [number, number]> = {
  GK: [40, 60],
  DEF: [40, 70],
  MID: [50, 110],
  FWD: [50, 130],
};

/** Round a price (tenths) to the nearest 0.5M = nearest 5 tenths. */
function roundToHalf(tenths: number): number {
  return Math.round(tenths / 5) * 5;
}

export interface PlayerProduction extends ProductionInput {
  id: string;
  teamTier: number;
}

export interface PricedPlayer {
  id: string;
  /** Price in tenths of a million (e.g. 125 = £12.5m). */
  price: number;
  /** The team-tier-adjusted production score it was ranked on. */
  score: number;
}

/**
 * Price the whole pool. Cross-position price comes from the bands; within a
 * position, players are ranked by tier-adjusted score and mapped across the
 * band by percentile, then rounded to 0.5M.
 */
export function computePrices(players: PlayerProduction[]): PricedPlayer[] {
  const scored = players.map((p) => ({ id: p.id, position: p.position, score: productionScore(p) * p.teamTier }));

  const out: PricedPlayer[] = [];
  for (const pos of Object.keys(POSITION_BANDS) as Position[]) {
    const [lo, hi] = POSITION_BANDS[pos];
    const group = scored.filter((s) => s.position === pos).sort((a, b) => a.score - b.score);
    const n = group.length;
    group.forEach((s, i) => {
      const pct = n <= 1 ? 1 : i / (n - 1); // lone player in a position → top of band
      const price = roundToHalf(lo + pct * (hi - lo));
      out.push({ id: s.id, price, score: s.score });
    });
  }
  return out;
}
