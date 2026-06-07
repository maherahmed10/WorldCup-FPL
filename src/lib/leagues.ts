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
  // Real group label from Team.group ("Group A" … "Group L") when available.
  // Falls back to union-find clustering + alphabetical labeling if null.
  homeTeamGroup: string | null;
  awayTeamGroup: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // "FINISHED" | other
}

export interface GroupStandings {
  label: string; // "Group A", "Group B", …
  rows: GroupTableRow[];
}

export function computeGroupsFromFixtures(fixtures: FixtureForGroup[]): GroupStandings[] {
  const teamNames = new Map<string, string>();
  const teamGroups = new Map<string, string>(); // teamId → "Group A" etc.

  for (const f of fixtures) {
    teamNames.set(f.homeTeamId, f.homeTeamName);
    teamNames.set(f.awayTeamId, f.awayTeamName);
    if (f.homeTeamGroup) teamGroups.set(f.homeTeamId, f.homeTeamGroup);
    if (f.awayTeamGroup) teamGroups.set(f.awayTeamId, f.awayTeamGroup);
  }

  // ── Path 1: real group labels from Team.group ────────────────────────────
  const hasRealLabels = teamGroups.size > 0;

  // Build group → teamIds mapping
  const clusters = new Map<string, string[]>();

  if (hasRealLabels) {
    for (const [teamId, label] of teamGroups) {
      const list = clusters.get(label) ?? [];
      list.push(teamId);
      clusters.set(label, list);
    }
    // Also cover any teams present in fixtures but missing a group label
    for (const teamId of teamNames.keys()) {
      if (!teamGroups.has(teamId)) {
        const list = clusters.get("__unknown__") ?? [];
        list.push(teamId);
        clusters.set("__unknown__", list);
      }
    }
  } else {
    // ── Path 2: union-find fallback when group labels absent ───────────────
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      let root = x;
      while (parent.get(root) !== root) root = parent.get(root)!;
      let cur = x;
      while (cur !== root) { const next = parent.get(cur)!; parent.set(cur, root); cur = next; }
      return root;
    };
    for (const f of fixtures) {
      const px = find(f.homeTeamId), py = find(f.awayTeamId);
      if (px !== py) parent.set(px, py);
    }
    for (const teamId of teamNames.keys()) {
      const root = find(teamId);
      const list = clusters.get(root) ?? [];
      list.push(teamId);
      clusters.set(root, list);
    }
  }

  // Compute W/D/L/GF/GA from FINISHED fixtures
  const stats = new Map<string, GroupTableRow>();
  const blank = (id: string, name: string): GroupTableRow => ({
    teamId: id, teamName: name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  });

  for (const f of fixtures) {
    if (f.status !== "FINISHED" || f.homeScore == null || f.awayScore == null) continue;
    for (const [id, name, gf, ga] of [
      [f.homeTeamId, f.homeTeamName, f.homeScore, f.awayScore],
      [f.awayTeamId, f.awayTeamName, f.awayScore, f.homeScore],
    ] as [string, string, number, number][]) {
      const s = { ...(stats.get(id) ?? blank(id, name)) };
      s.played++; s.goalsFor += gf; s.goalsAgainst += ga;
      if (gf > ga) { s.won++; s.points += 3; }
      else if (gf === ga) { s.drawn++; s.points += 1; }
      else s.lost++;
      stats.set(id, s);
    }
  }

  // Sort group entries, label alphabetically when using fallback
  const groupEntries = Array.from(clusters.entries())
    .filter(([label]) => label !== "__unknown__")
    .sort(([a], [b]) => a.localeCompare(b));

  const FALLBACK = "ABCDEFGHIJKL";
  return groupEntries.map(([rawLabel, ids], i) => ({
    label: hasRealLabels ? rawLabel : `Group ${FALLBACK[i] ?? String(i + 1)}`,
    rows: sortGroupStandings(ids.map((id) => stats.get(id) ?? blank(id, teamNames.get(id) ?? id))),
  }));
}
