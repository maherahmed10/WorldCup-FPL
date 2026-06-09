// ─────────────────────────────────────────────────────────────────────────
// Player view-model + pure filter/sort (Lane 2). The DB `Player` row has no
// pts/ppg/form — those are DERIVED from PlayerMatchStat so the list lights up
// once the settlement job fills fantasyPoints. Before the tournament starts the
// derived numbers are all 0 / empty, which renders fine.
//
// `PlayerView` is the shared prop shape: the Players market AND Youssef's squad
// picker both render <PlayerRow> against it (TASKS.md coordination note).
// ─────────────────────────────────────────────────────────────────────────

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface PlayerView {
  id: string;
  name: string;
  position: Position;
  /** Millions, e.g. 12.5. DB stores tenths (130 = 13.0M); 0 until pricing lands. */
  price: number;
  /** Team display name (drives the max-3 rule elsewhere). */
  country: string;
  /** Team crest from API-Football; may be null. */
  logoUrl: string | null;
  /** Total fantasy points across settled matches. */
  pts: number;
  /** Points per game (0 when no games played). */
  ppg: number;
  /** Last few match scores, oldest→newest, for the sparkline. */
  form: number[];
}

/** How many recent matches feed the form sparkline. */
const FORM_WINDOW = 5;

// The minimal shape we read off a Prisma player (with team + matchStats).
interface PlayerRecord {
  id: string;
  name: string;
  position: Position;
  price: number; // tenths of a million (judgement-based hand-tiering)
  team: { country: string; name: string; logoUrl: string | null };
  matchStats: Array<{ fantasyPoints: number | null; fixture: { kickoff: Date } }>;
}

/** Map a DB player (with team + matchStats) to the view-model. */
export function toPlayerView(p: PlayerRecord): PlayerView {
  // Only matches that have been settled (fantasyPoints set) count.
  const settled = p.matchStats
    .filter((s) => s.fantasyPoints != null)
    .sort((a, b) => a.fixture.kickoff.getTime() - b.fixture.kickoff.getTime());

  const scores = settled.map((s) => s.fantasyPoints as number);
  const pts = scores.reduce((sum, n) => sum + n, 0);
  const games = scores.length;
  const ppg = games ? pts / games : 0;

  return {
    id: p.id,
    name: p.name,
    position: p.position,
    price: p.price / 10,
    // Use the clean team name for display + Flag (Team.country holds hyphenated
    // variants like "South-Africa"); both resolve to a flag, the name reads better.
    country: p.team.name,
    logoUrl: p.team.logoUrl,
    pts,
    ppg,
    form: scores.slice(-FORM_WINDOW),
  };
}

export type PlayerSort = "pts" | "ppg" | "price-d" | "price-a" | "name";

export interface PlayerFilter {
  pos: Position | "ALL";
  country: string; // "ALL" or a country/team name
  sort: PlayerSort;
  q: string;
  maxPrice: number; // millions
  favouritesOnly: boolean;
}

export const DEFAULT_FILTER: PlayerFilter = {
  pos: "ALL",
  country: "ALL",
  sort: "pts",
  q: "",
  maxPrice: 13,
  favouritesOnly: false,
};

const SORTERS: Record<PlayerSort, (a: PlayerView, b: PlayerView) => number> = {
  pts: (a, b) => b.pts - a.pts,
  ppg: (a, b) => b.ppg - a.ppg,
  "price-d": (a, b) => b.price - a.price,
  "price-a": (a, b) => a.price - b.price,
  name: (a, b) => a.name.localeCompare(b.name),
};

/** Pure filter + sort, mirroring design/playerlist.jsx `usePlayerFilter`. */
export function filterAndSortPlayers(
  players: PlayerView[],
  f: PlayerFilter,
  favouriteIds?: Set<string>,
): PlayerView[] {
  const q = f.q.trim().toLowerCase();
  const out = players.filter((p) => {
    if (f.pos !== "ALL" && p.position !== f.pos) return false;
    if (f.country !== "ALL" && p.country !== f.country) return false;
    if (p.price > f.maxPrice + 0.001) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (f.favouritesOnly && !favouriteIds?.has(p.id)) return false;
    return true;
  });
  return out.sort(SORTERS[f.sort] ?? SORTERS.pts);
}
