// Pure helpers for leagues + group standings. No DB, no API — unit-testable.
// See src/lib/leagues.test.ts for coverage.
import { randomBytes } from "crypto";

// "GAF-XXXX" format. Excludes visually confusable chars (0/O, 1/I).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
  const bytes = randomBytes(4);
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return `GAF-${suffix}`;
}

export interface GroupTableRow {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/** Sort group table rows: points → goal difference → goals for. */
export function sortGroupStandings(rows: GroupTableRow[]): GroupTableRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

export interface LeagueStandingRow {
  userId: string;
  name: string;
  gwPoints: number;
  totalPoints: number;
}

/** Sort fantasy league standings: total points → GW points as tiebreaker. */
export function sortLeagueStandings(rows: LeagueStandingRow[]): LeagueStandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return b.gwPoints - a.gwPoints;
  });
}

// ── Group clustering ─────────────────────────────────────────────────────────
// Derives which teams share a group from group-stage fixture pairings (who plays
// whom). Uses union-find so we never need to store group labels in the DB.

export interface FixtureForGroup {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // "FINISHED" | other
}

export interface GroupStandings {
  label: string; // "Group A", "Group B", …
  rows: GroupTableRow[];
}

export function computeGroupsFromFixtures(fixtures: FixtureForGroup[]): GroupStandings[] {
  const parent = new Map<string, string>();
  const teamNames = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // path compression
    let cur = x;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  function union(x: string, y: string) {
    const px = find(x);
    const py = find(y);
    if (px !== py) parent.set(px, py);
  }

  for (const f of fixtures) {
    teamNames.set(f.homeTeamId, f.homeTeamName);
    teamNames.set(f.awayTeamId, f.awayTeamName);
    union(f.homeTeamId, f.awayTeamId);
  }

  // Cluster teams by root
  const clusters = new Map<string, string[]>();
  for (const teamId of teamNames.keys()) {
    const root = find(teamId);
    const list = clusters.get(root) ?? [];
    list.push(teamId);
    clusters.set(root, list);
  }

  // Compute W/D/L/GF/GA from FINISHED fixtures
  const stats = new Map<string, GroupTableRow>();
  const getStats = (id: string, name: string): GroupTableRow =>
    stats.get(id) ?? { teamId: id, teamName: name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

  for (const f of fixtures) {
    if (f.status !== "FINISHED" || f.homeScore == null || f.awayScore == null) continue;
    for (const [id, name, gf, ga] of [
      [f.homeTeamId, f.homeTeamName, f.homeScore, f.awayScore],
      [f.awayTeamId, f.awayTeamName, f.awayScore, f.homeScore],
    ] as [string, string, number, number][]) {
      const s = { ...getStats(id, name) };
      s.played++;
      s.goalsFor += gf;
      s.goalsAgainst += ga;
      if (gf > ga) { s.won++; s.points += 3; }
      else if (gf === ga) { s.drawn++; s.points += 1; }
      else s.lost++;
      stats.set(id, s);
    }
  }

  // Sort groups by alphabetically earliest team name for deterministic labeling
  const groups = Array.from(clusters.values())
    .map((ids) =>
      ids.map((id) => stats.get(id) ?? getStats(id, teamNames.get(id) ?? id))
    )
    .sort((a, b) => {
      const minA = [...a].sort((x, y) => x.teamName.localeCompare(y.teamName))[0].teamName;
      const minB = [...b].sort((x, y) => x.teamName.localeCompare(y.teamName))[0].teamName;
      return minA.localeCompare(minB);
    });

  const LABELS = "ABCDEFGHIJKL";
  return groups.map((rows, i) => ({
    label: `Group ${LABELS[i] ?? String(i + 1)}`,
    rows: sortGroupStandings(rows),
  }));
}
