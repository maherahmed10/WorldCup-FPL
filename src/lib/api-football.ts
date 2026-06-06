// ─────────────────────────────────────────────────────────────────────────
// Thin provider wrapper around API-Football (build-plan §11).
//
// ARCHITECTURE RULE (§5, non-negotiable): NOTHING in the app calls this on a
// per-user request. Only the background caching job (src/jobs/sync.ts) calls
// it. Every user request reads from OUR database. Keeping the surface small
// here means we can swap providers by rewriting this one file.
// ─────────────────────────────────────────────────────────────────────────

const BASE = "https://v3.football.api-sports.io";
export const WORLD_CUP_LEAGUE = 1;
export const SEASON = 2026;

function key(): string {
  const k = process.env.APISPORTS_KEY;
  if (!k) throw new Error("APISPORTS_KEY is not set — see .env.example");
  return k;
}

// Generic typed GET. API-Football wraps everything in { response, errors, ... }.
async function get<T>(path: string): Promise<T[]> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key() },
    // Server-side job only; never cache the upstream call itself.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API-Football ${path} → HTTP ${res.status}`);
  }
  const json = (await res.json()) as { response?: T[]; errors?: unknown };
  const errors = json.errors;
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : errors && Object.keys(errors).length > 0;
  if (hasErrors) {
    // Often a plan-tier limitation rather than a hard failure — surface it.
    throw new Error(`API-Football ${path} → errors: ${JSON.stringify(errors)}`);
  }
  return json.response ?? [];
}

// ── Raw response shapes (only the fields we consume) ──

export interface ApiTeam {
  team: { id: number; name: string; country?: string; logo?: string };
}

export interface ApiFixture {
  fixture: {
    id: number;
    date: string; // ISO UTC
    venue?: { name?: string | null };
    status: { short: string };
  };
  league: { round: string };
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
}

export interface ApiPlayerEntry {
  player: { id: number; name: string; photo?: string };
  statistics: Array<{
    team: { id: number };
    games: { position?: string | null };
  }>;
}

// Per-player match stats — settles fantasy AND bets (§5).
export interface ApiFixturePlayerStat {
  player: { id: number; name: string };
  statistics: Array<{
    games: { minutes: number | null; rating: string | null };
    goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
    penalty: { saved: number | null; missed: number | null };
    cards: { yellow: number | null; red: number | null };
  }>;
}

export interface ApiFixturePlayers {
  team: { id: number };
  players: ApiFixturePlayerStat[];
}

// ── Endpoint methods (the only API surface the job uses) ──

export const apiFootball = {
  teams: () => get<ApiTeam>(`/teams?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`),

  fixtures: () =>
    get<ApiFixture>(`/fixtures?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`),

  rounds: () =>
    get<string>(`/fixtures/rounds?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`),

  // Player pool is paginated — caller loops pages until empty.
  playersPage: (page: number) =>
    get<ApiPlayerEntry>(
      `/players?league=${WORLD_CUP_LEAGUE}&season=${SEASON}&page=${page}`,
    ),

  // Per-fixture player stats — the settlement feed.
  fixturePlayers: (fixtureId: number) =>
    get<ApiFixturePlayers>(`/fixtures/players?fixture=${fixtureId}`),
};
