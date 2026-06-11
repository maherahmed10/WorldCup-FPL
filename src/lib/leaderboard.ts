// ─────────────────────────────────────────────────────────────────────────
// Global leaderboard — ranks EVERY entered user (≥1 Squad) two ways:
//   • GAMEDAY  — this gameweek's squad total (captain ×2 / vice auto-sub).
//   • OVERALL  — season total across all gameweeks.
// Reuses the existing scoring helpers (squad-points) and the EXACT tie rule +
// movement-delta logic from leagues.ts (rankStandings / standard competition
// ranking). Reads only our DB — never API-Football.
//
// PERF: this is O(users) per request. The global computation is wrapped in a
// 60s server cache keyed by gameweekId so it isn't recomputed per request; the
// cheap per-user view (your rank / "near" slice) is derived outside the cache.
// TODO(scale): materialize per-user gameweek totals in the settlement job
//   (src/jobs/settle.ts) so this becomes an O(1) read instead of O(users).
// ─────────────────────────────────────────────────────────────────────────

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getActiveSquad } from "@/lib/squad-data";
import {
  getGameweekPlayerPoints,
  getGameweekMinutes,
  squadGameweekTotal,
  getUserSeasonTotal,
} from "@/lib/squad-points";
import { rankStandings, type LeagueStandingRow } from "@/lib/leagues";

export interface LeaderboardRow {
  userId: string;
  rank: number;
  delta: number | null; // places moved: + climbed, − fell, 0 same; null = no movement chip
  teamName: string;
  managerName: string;
  country: string | null;
  pts: number;
  isYou: boolean;
}

export interface LeaderCard {
  teamName: string;
  managerName: string;
  country: string | null;
  pts: number;
}

export interface BoardView {
  rank: number | null; // viewer's rank (null = not ranked / no squad)
  pts: number;
  delta: number | null;
  percentile: number; // viewer's percentile, e.g. 12.5 (= top 12.5%)
  percentileLabel: string; // "Top 12%" / "Top 0.4%" / "" when unranked
  barFill: number; // 100 − percentile, clamped ≥ 2 (0 when unranked)
  top: LeaderboardRow[]; // top 10
  near: LeaderboardRow[]; // 2 above + you + 2 below (empty when unranked)
}

export interface GlobalLeaderboard {
  teamName: string; // the viewing user's team name
  managerName: string; // the viewing user's name (for the footer row)
  country: string | null; // the viewing user's flag (captain's nation)
  totalManagers: number;
  gameweekLabel: string; // e.g. "Group Stage · MD3"
  hasPrevGameweek: boolean; // false → omit the gameday movement chips
  leaders: { gameday: LeaderCard | null; overall: LeaderCard | null };
  gameday: BoardView;
  overall: BoardView;
  me: {
    gameday: { rank: number | null; pts: number; delta: number | null };
    overall: { rank: number | null; pts: number; delta: number | null };
  };
}

// ── per-user gameweek total (points only; the flag comes from the user's
//    chosen Nation, set in computeBoards) ──
async function userGameweek(
  userId: string,
  gameweekId: string,
): Promise<{ pts: number } | null> {
  const squad = await getActiveSquad(userId, gameweekId);
  if (!squad) return null;
  const ids = squad.players.map((p) => p.id);
  const [points, minutes, pick] = await Promise.all([
    getGameweekPlayerPoints(ids, gameweekId),
    getGameweekMinutes(ids, gameweekId),
    db.gameweekPick.findUnique({
      where: { userId_gameweekId: { userId, gameweekId } },
      select: { captainId: true, viceId: true, captain2Id: true },
    }),
  ]);
  const captainId = pick?.captainId ?? squad.captainId;
  const viceId = pick?.viceId ?? null;
  const pts = squadGameweekTotal(squad.players, captainId, points, viceId, minutes, pick?.captain2Id ?? null);
  return { pts };
}

/** Standard competition ranking by a single descending score (ties share a rank). */
function rankByScore(entries: Array<{ userId: string; score: number }>): Map<string, number> {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const map = new Map<string, number>();
  let lastScore: number | null = null;
  let lastRank = 0;
  sorted.forEach((e, i) => {
    if (e.score === lastScore) map.set(e.userId, lastRank);
    else {
      lastRank = i + 1;
      lastScore = e.score;
      map.set(e.userId, lastRank);
    }
  });
  return map;
}

function gameweekLabel(roundType: string, label: string): string {
  return roundType === "GROUP" ? `Group Stage · ${label.replace(/^Group\s*/, "")}` : label;
}

// ── the expensive, cacheable global computation (no per-user view) ──
export interface ComputedBoards {
  totalManagers: number;
  gameweekLabel: string;
  hasPrevGameweek: boolean;
  overall: LeaderboardRow[]; // ranked + sorted (rank/delta/pts = season)
  gameday: LeaderboardRow[]; // ranked + sorted (rank/delta/pts = this GW)
  leaders: { gameday: LeaderCard | null; overall: LeaderCard | null };
}

async function computeBoards(gameweekId: string): Promise<ComputedBoards> {
  const gw = await db.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gw) {
    return {
      totalManagers: 0,
      gameweekLabel: "",
      hasPrevGameweek: false,
      overall: [],
      gameday: [],
      leaders: { gameday: null, overall: null },
    };
  }

  // Previous COMPLETED gameweek (for the gameday movement delta).
  const prevGw = await db.gameweek.findFirst({
    where: { startsAt: { lt: gw.startsAt }, endsAt: { lte: new Date() } },
    orderBy: { startsAt: "desc" },
  });
  const hasPrev = !!prevGw;

  // Every entered user (≥ 1 squad).
  const users = await db.user.findMany({
    where: { squads: { some: {} } },
    select: { id: true, name: true, teamName: true, supportedNation: true },
  });

  const base = await Promise.all(
    users.map(async (u) => {
      const [cur, season, prev] = await Promise.all([
        userGameweek(u.id, gameweekId),
        getUserSeasonTotal(u.id),
        hasPrev ? userGameweek(u.id, prevGw!.id) : Promise.resolve(null),
      ]);
      return {
        userId: u.id,
        managerName: u.name,
        teamName: u.teamName ?? u.name,
        // Flag = ONLY the nation the manager picked in Nations. No fallback —
        // no nation chosen → no flag.
        country: u.supportedNation ?? null,
        currentPts: cur?.pts ?? 0,
        seasonPts: season,
        prevPts: prev?.pts ?? 0,
      };
    }),
  );
  const byId = new Map(base.map((b) => [b.userId, b]));

  // OVERALL — reuse rankStandings: rank by season total, GW tiebreak; delta vs
  // (total − this GW). Exactly the overall movement rule.
  const overallRanked = rankStandings(
    base.map<LeagueStandingRow>((b) => ({
      userId: b.userId,
      name: b.managerName,
      gwPoints: b.currentPts,
      totalPoints: b.seasonPts,
    })),
  );
  const overall: LeaderboardRow[] = overallRanked.map((r) => {
    const b = byId.get(r.userId)!;
    return {
      userId: r.userId,
      rank: r.rank,
      delta: r.delta,
      teamName: b.teamName,
      managerName: b.managerName,
      country: b.country,
      pts: b.seasonPts,
      isYou: false,
    };
  });

  // GAMEDAY — rank by this GW's points; delta = prevRank − currentRank.
  const curRank = rankByScore(base.map((b) => ({ userId: b.userId, score: b.currentPts })));
  const prevRank = hasPrev
    ? rankByScore(base.map((b) => ({ userId: b.userId, score: b.prevPts })))
    : null;
  const gameday: LeaderboardRow[] = [...base]
    .sort((a, b) => b.currentPts - a.currentPts || a.managerName.localeCompare(b.managerName))
    .map((b) => {
      const rank = curRank.get(b.userId)!;
      const delta = prevRank ? prevRank.get(b.userId)! - rank : null;
      return {
        userId: b.userId,
        rank,
        delta,
        teamName: b.teamName,
        managerName: b.managerName,
        country: b.country,
        pts: b.currentPts,
        isYou: false,
      };
    });

  const toLeader = (r: LeaderboardRow | undefined): LeaderCard | null =>
    r ? { teamName: r.teamName, managerName: r.managerName, country: r.country, pts: r.pts } : null;

  return {
    totalManagers: base.length,
    gameweekLabel: gameweekLabel(gw.roundType, gw.label),
    hasPrevGameweek: hasPrev,
    overall,
    gameday,
    leaders: { gameday: toLeader(gameday[0]), overall: toLeader(overall[0]) },
  };
}

// 60s cache, keyed by gameweekId — global lists are the same for everyone.
export function cachedBoards(gameweekId: string): Promise<ComputedBoards> {
  return unstable_cache(() => computeBoards(gameweekId), ["global-leaderboard", gameweekId], {
    revalidate: 60,
    tags: ["leaderboard"],
  })();
}

function percentileFor(rank: number | null, total: number) {
  if (!rank || total === 0) return { percentile: 0, percentileLabel: "", barFill: 0 };
  const percentile = (rank / total) * 100;
  const percentileLabel =
    "Top " + (percentile < 1 ? percentile.toFixed(1) : String(Math.round(percentile))) + "%";
  const barFill = Math.max(2, 100 - percentile);
  return { percentile, percentileLabel, barFill };
}

/** Slice a ranked list around the viewer: top 10 + the 2-above/you/2-below window. */
function viewFor(
  rows: LeaderboardRow[],
  userId: string,
  total: number,
): BoardView & { found: LeaderboardRow | null } {
  const idx = rows.findIndex((r) => r.userId === userId);
  const found = idx >= 0 ? rows[idx] : null;
  const withYou = rows.map((r) => ({ ...r, isYou: r.userId === userId }));
  const top = withYou.slice(0, 10);
  const near = idx >= 0 ? withYou.slice(Math.max(0, idx - 2), idx + 3) : [];
  const pct = percentileFor(found?.rank ?? null, total);
  return {
    rank: found?.rank ?? null,
    pts: found?.pts ?? 0,
    delta: found?.delta ?? 0,
    ...pct,
    top,
    near,
    found,
  };
}

/**
 * The full leaderboard payload for one viewer — global ranked lists (cached)
 * plus the viewer's own rank / percentile / "near" window. Pass into <RankBoard>;
 * the modal needs no client fetch.
 */
export async function getGlobalLeaderboard({
  userId,
  gameweekId,
}: {
  userId: string;
  gameweekId: string;
}): Promise<GlobalLeaderboard> {
  const boards = await cachedBoards(gameweekId);

  const overall = viewFor(boards.overall, userId, boards.totalManagers);
  const gameday = viewFor(boards.gameday, userId, boards.totalManagers);

  // Viewer's identity even if unranked (no squad yet). Prefer their own ranked
  // row (carries the derived flag); fall back to the User record.
  const meRow = boards.overall.find((r) => r.userId === userId);
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, teamName: true, supportedNation: true },
  });
  const teamName = meRow?.teamName ?? me?.teamName ?? me?.name ?? "My Team";
  const managerName = meRow?.managerName ?? me?.name ?? "You";
  // Flag = ONLY the nation picked in Nations (no nation → no flag).
  const country = me?.supportedNation ?? null;

  return {
    teamName,
    managerName,
    country,
    totalManagers: boards.totalManagers,
    gameweekLabel: boards.gameweekLabel,
    hasPrevGameweek: boards.hasPrevGameweek,
    leaders: boards.leaders,
    gameday: stripFound(gameday),
    overall: stripFound(overall),
    me: {
      gameday: { rank: gameday.rank, pts: gameday.pts, delta: gameday.delta },
      overall: { rank: overall.rank, pts: overall.pts, delta: overall.delta },
    },
  };
}

function stripFound(v: BoardView & { found: LeaderboardRow | null }): BoardView {
  const { found: _found, ...rest } = v;
  void _found;
  return rest;
}

