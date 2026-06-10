// ─────────────────────────────────────────────────────────────────────────
// Nations — country-based fan leagues. Users explicitly pick their nation
// (User.supportedNation), NOT derived from their captain. Each nation is ranked
// by average bankroll; stats include pts, bankroll, H2H record, manager count.
//
// Computation is cached 60s (same cadence as the leaderboard). Reuses
// cachedBoards for season-pts data to avoid re-running getUserSeasonTotal.
// ─────────────────────────────────────────────────────────────────────────

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { cachedBoards } from "@/lib/leaderboard";

// ── Public types ───────────────────────────────────────────────────────────

export interface NationStats {
  country: string;
  memberCount: number;
  avgPts: number;
  totalPts: number;
  avgBankroll: number;   // actual £ value (same units as User.bettingBalance)
  totalBankroll: number;
  topPts: number;
  topBankroll: number;
  topTeamName: string;   // top scorer's team
  topManagerName: string;
  h2hWins: number;
  h2hLosses: number;
  h2hTotal: number;      // all accepted/settled challenges involving this nation
  nationRank: number;    // 1 = highest avgBankroll
}

export interface NationMemberRow {
  rank: number;
  userId: string;
  teamName: string;
  managerName: string;
  pts: number;
  bankroll: number;
  isYou: boolean;
}

export interface NationLeaguesPayload {
  myNation: string | null;
  myStats: NationStats | null;
  nations: NationStats[];      // all nations with ≥1 member, sorted by avgBankroll
  allCountries: string[];      // every WC nation (for the picker)
  gameweekLabel: string;
  totalManagers: number;       // users who have picked a nation
  rivalries: Array<{
    country: string;
    diff: number; // positive = they lead (higher avgBankroll), negative = you lead
  }>;
  highlights: {
    mostManagers: NationStats | null;
    topBankroll: NationStats | null;
    topPts: NationStats | null;
    mostH2H: NationStats | null;
  };
}

// ── Internal cached payload ────────────────────────────────────────────────

interface CachedNations {
  nations: NationStats[];
  allCountries: string[];
  gameweekLabel: string;
  membersByNation: Record<string, MemberData[]>;
}

interface MemberData {
  userId: string;
  teamName: string;
  managerName: string;
  pts: number;
  bankroll: number;
}

async function computeNations(gameweekId: string): Promise<CachedNations> {
  const [gw, teams, nationUsers, boards, settledH2H, activeH2H] = await Promise.all([
    db.gameweek.findUnique({ where: { id: gameweekId }, select: { label: true, roundType: true } }),
    db.team.findMany({ select: { country: true }, distinct: ["country"], orderBy: { country: "asc" } }),
    db.user.findMany({
      where: { supportedNation: { not: null } },
      select: { id: true, name: true, teamName: true, supportedNation: true, bettingBalance: true },
    }),
    cachedBoards(gameweekId),
    db.h2HChallenge.findMany({
      where: { status: "SETTLED" },
      select: { winnerId: true, creatorId: true, opponentId: true },
    }),
    db.h2HChallenge.findMany({
      where: { status: { in: ["ACCEPTED", "SETTLED"] } },
      select: { creatorId: true, opponentId: true },
    }),
  ]);

  const gwLabel = gw
    ? gw.roundType === "GROUP"
      ? `Group Stage · ${gw.label.replace(/^Group\s*/, "")}`
      : gw.label
    : "";

  const allCountries = teams.map((t) => t.country);

  // Season pts from cached boards (avoids redundant getUserSeasonTotal calls)
  const ptsMap = new Map<string, number>();
  for (const row of boards.overall) ptsMap.set(row.userId, row.pts);

  // userId → supportedNation for H2H join
  const nationByUser = new Map<string, string>();
  for (const u of nationUsers) {
    if (u.supportedNation) nationByUser.set(u.id, u.supportedNation);
  }

  // H2H wins / losses per nation
  const winsMap = new Map<string, number>();
  const lossMap = new Map<string, number>();
  for (const ch of settledH2H) {
    if (!ch.winnerId) continue;
    const winNation = nationByUser.get(ch.winnerId);
    const loserId = ch.creatorId === ch.winnerId ? ch.opponentId : ch.creatorId;
    const loseNation = nationByUser.get(loserId);
    if (winNation) winsMap.set(winNation, (winsMap.get(winNation) ?? 0) + 1);
    if (loseNation) lossMap.set(loseNation, (lossMap.get(loseNation) ?? 0) + 1);
  }

  // H2H total per nation (active or settled)
  const totalH2HMap = new Map<string, number>();
  for (const ch of activeH2H) {
    const cn = nationByUser.get(ch.creatorId);
    const on = nationByUser.get(ch.opponentId);
    if (cn) totalH2HMap.set(cn, (totalH2HMap.get(cn) ?? 0) + 1);
    if (on) totalH2HMap.set(on, (totalH2HMap.get(on) ?? 0) + 1);
  }

  // Group users by nation
  const byNation = new Map<string, typeof nationUsers>();
  for (const u of nationUsers) {
    if (!u.supportedNation) continue;
    const list = byNation.get(u.supportedNation) ?? [];
    list.push(u);
    byNation.set(u.supportedNation, list);
  }

  const membersByNation: CachedNations["membersByNation"] = {};
  const rawStats: Omit<NationStats, "nationRank">[] = [];

  for (const [country, members] of byNation.entries()) {
    const memberData: MemberData[] = members.map((u) => ({
      userId: u.id,
      teamName: u.teamName ?? u.name,
      managerName: u.name,
      pts: ptsMap.get(u.id) ?? 0,
      bankroll: u.bettingBalance,
    }));
    membersByNation[country] = memberData;

    const totalPts = memberData.reduce((s, m) => s + m.pts, 0);
    const totalBankroll = memberData.reduce((s, m) => s + m.bankroll, 0);
    const sortedByPts = [...memberData].sort((a, b) => b.pts - a.pts);
    const sortedByBank = [...memberData].sort((a, b) => b.bankroll - a.bankroll);

    rawStats.push({
      country,
      memberCount: members.length,
      avgPts: members.length > 0 ? Math.round(totalPts / members.length) : 0,
      totalPts,
      avgBankroll: members.length > 0 ? Math.round(totalBankroll / members.length) : 0,
      totalBankroll,
      topPts: sortedByPts[0]?.pts ?? 0,
      topBankroll: sortedByBank[0]?.bankroll ?? 0,
      topTeamName: sortedByPts[0]?.teamName ?? "",
      topManagerName: sortedByPts[0]?.managerName ?? "",
      h2hWins: winsMap.get(country) ?? 0,
      h2hLosses: lossMap.get(country) ?? 0,
      h2hTotal: totalH2HMap.get(country) ?? 0,
    });
  }

  const nations = [...rawStats]
    .sort((a, b) => b.avgBankroll - a.avgBankroll || a.country.localeCompare(b.country))
    .map((n, i) => ({ ...n, nationRank: i + 1 }));

  return { nations, allCountries, gameweekLabel: gwLabel, membersByNation };
}

function cachedNations(gameweekId: string): Promise<CachedNations> {
  return unstable_cache(() => computeNations(gameweekId), ["nations", gameweekId], {
    revalidate: 60,
    tags: ["nations"],
  })();
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getNationStats(
  userId: string,
  gameweekId: string,
): Promise<NationLeaguesPayload> {
  const [data, me] = await Promise.all([
    cachedNations(gameweekId),
    db.user.findUnique({ where: { id: userId }, select: { supportedNation: true } }),
  ]);

  const myNation = me?.supportedNation ?? null;
  const myStats = myNation ? (data.nations.find((n) => n.country === myNation) ?? null) : null;

  // Closest rivals: nations ranked ±1 from user's nation (by avgBankroll)
  const rivalries: NationLeaguesPayload["rivalries"] = [];
  if (myStats) {
    const myRank = myStats.nationRank;
    const above = data.nations.find((n) => n.nationRank === myRank - 1);
    const below = data.nations.find((n) => n.nationRank === myRank + 1);
    if (above) rivalries.push({ country: above.country, diff: above.avgBankroll - myStats.avgBankroll });
    if (below) rivalries.push({ country: below.country, diff: below.avgBankroll - myStats.avgBankroll });
  }

  const highlights: NationLeaguesPayload["highlights"] = {
    mostManagers:
      [...data.nations].sort((a, b) => b.memberCount - a.memberCount)[0] ?? null,
    topBankroll:
      [...data.nations].sort((a, b) => b.avgBankroll - a.avgBankroll)[0] ?? null,
    topPts:
      [...data.nations].sort((a, b) => b.avgPts - a.avgPts)[0] ?? null,
    mostH2H:
      [...data.nations].sort((a, b) => b.h2hWins - a.h2hWins).find((n) => n.h2hWins > 0) ?? null,
  };

  return {
    myNation,
    myStats,
    nations: data.nations,
    allCountries: data.allCountries,
    gameweekLabel: data.gameweekLabel,
    totalManagers: data.nations.reduce((s, n) => s + n.memberCount, 0),
    rivalries,
    highlights,
  };
}

export async function getNationMembersData(
  country: string,
  userId: string,
  gameweekId: string,
): Promise<NationMemberRow[]> {
  const data = await cachedNations(gameweekId);
  const members = data.membersByNation[country] ?? [];
  return [...members]
    .sort((a, b) => b.bankroll - a.bankroll || b.pts - a.pts || a.managerName.localeCompare(b.managerName))
    .map((m, i) => ({
      rank: i + 1,
      userId: m.userId,
      teamName: m.teamName,
      managerName: m.managerName,
      pts: m.pts,
      bankroll: m.bankroll,
      isYou: m.userId === userId,
    }));
}
