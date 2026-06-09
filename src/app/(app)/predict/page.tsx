// Predictions (Lane 2). Server component: reads upcoming fixtures + the user's
// bets from our DB, builds the markets (placeholder match odds + our own fixed
// player-prop values), computes the points balance, and hands it to the client.
// Maps to design: screens_predict.jsx.

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  matchMarkets,
  scorerMultiplier,
  assistMultiplier,
  cardMultiplier,
  type BetLike,
  type MarketType,
} from "@/lib/betting";
import { judgementScorerOdds } from "@/lib/scorer-odds";
import { PredictClient, type BetView, type FixtureMarketsView } from "./PredictClient";
import type { H2HChallengeView } from "./H2HClient";

export const dynamic = "force-dynamic";

const MAX_FIXTURES = 10;
const SCORERS_PER_TEAM = 3;
const CARDS_PER_TEAM = 2;

const MARKET_LABEL: Record<MarketType, string> = {
  MATCH_RESULT: "Match Result",
  OVER_UNDER: "Over / Under 2.5 Goals",
  BTTS: "Both Teams To Score",
  CORRECT_SCORE: "Correct Score",
  PLAYER_SCORER: "Anytime Goalscorer",
  PLAYER_ASSIST: "To Assist",
  PLAYER_CARD: "To Be Carded",
};

function formatKickoff(d: Date): string {
  const day = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
  return `${day.replace(/,/g, "")} · ${time}`;
}

// Humanise a stored Bet.selection for display.
function describePick(
  selection: string,
  home: string,
  away: string,
  playerNames: Map<string, string>,
): string {
  switch (selection) {
    case "HOME":
      return home;
    case "AWAY":
      return away;
    case "DRAW":
      return "Draw";
    case "OVER_2.5":
      return "Over 2.5";
    case "UNDER_2.5":
      return "Under 2.5";
    case "BTTS_YES":
      return "Yes";
    case "BTTS_NO":
      return "No";
  }
  const [kind, id] = selection.split(":");
  if (id && (kind === "scorer" || kind === "assist" || kind === "card")) {
    return playerNames.get(id) ?? "Player";
  }
  return selection;
}

export default async function PredictPage() {
  const now = new Date();

  const fixtures = await db.fixture.findMany({
    where: { status: "SCHEDULED", kickoff: { gte: now } },
    orderBy: { kickoff: "asc" },
    take: MAX_FIXTURES,
    include: {
      homeTeam: { select: { id: true, name: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, logoUrl: true } },
      odds: { select: { selection: true, multiplier: true } }, // real /odds, if synced
    },
  });

  // Attacking players for the teams on show → anytime-scorer options.
  // Order by price desc so the priciest (most likely) scorers surface first.
  const teamIds = Array.from(new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId])));
  const attackers = teamIds.length
    ? await db.player.findMany({
        where: { teamId: { in: teamIds }, position: { in: ["FWD", "MID"] } },
        select: { id: true, name: true, teamId: true, position: true, price: true },
        orderBy: [{ price: "desc" }, { name: "asc" }],
      })
    : [];
  type Scorer = { id: string; name: string; position: "FWD" | "MID"; price: number };
  const scorersByTeam = new Map<string, Scorer[]>();
  for (const a of attackers) {
    const list = scorersByTeam.get(a.teamId) ?? [];
    if (list.length < SCORERS_PER_TEAM)
      list.push({ id: a.id, name: a.name, position: a.position as "FWD" | "MID", price: a.price });
    scorersByTeam.set(a.teamId, list);
  }

  // Card-prone candidates (defenders / defensive mids) → "to be carded" market.
  const defenders = teamIds.length
    ? await db.player.findMany({
        where: { teamId: { in: teamIds }, position: { in: ["DEF", "MID"] } },
        select: { id: true, name: true, teamId: true, position: true, price: true },
        orderBy: [{ price: "desc" }, { name: "asc" }],
      })
    : [];
  type CardCand = { id: string; name: string; position: "DEF" | "MID"; price: number };
  const cardsByTeam = new Map<string, CardCand[]>();
  for (const d of defenders) {
    const list = cardsByTeam.get(d.teamId) ?? [];
    if (list.length < CARDS_PER_TEAM)
      list.push({ id: d.id, name: d.name, position: d.position as "DEF" | "MID", price: d.price });
    cardsByTeam.set(d.teamId, list);
  }

  const markets: FixtureMarketsView[] = fixtures.map((f) => {
    // Real per-fixture odds (selection → multiplier); empty until syncOdds runs.
    const oddsMap = Object.fromEntries(f.odds.map((o) => [o.selection, o.multiplier]));
    const groups = matchMarkets(f.homeTeam.name, f.awayTeam.name, oddsMap).map((g) => ({
      marketType: g.marketType,
      label: g.label,
      options: g.options,
    }));
    const scorers = [
      ...(scorersByTeam.get(f.homeTeamId) ?? []),
      ...(scorersByTeam.get(f.awayTeamId) ?? []),
    ];
    if (scorers.length) {
      groups.push({
        marketType: "PLAYER_SCORER",
        label: MARKET_LABEL.PLAYER_SCORER,
        options: scorers.map((s) => ({
          name: s.name,
          selection: `scorer:${s.id}`,
          // Resolution: curated judgement for elite finishers → position/price formula.
          multiplier: judgementScorerOdds(s.name) ?? scorerMultiplier(s.position, s.price),
        })),
      });
      // To Assist — same creative pool, priced per-player by position + price.
      groups.push({
        marketType: "PLAYER_ASSIST",
        label: MARKET_LABEL.PLAYER_ASSIST,
        options: scorers.map((s) => ({
          name: s.name,
          selection: `assist:${s.id}`,
          multiplier: assistMultiplier(s.position, s.price),
        })),
      });
    }
    // To Be Carded — defenders / defensive mids, priced per-player by position + price.
    const cardCandidates = [
      ...(cardsByTeam.get(f.homeTeamId) ?? []),
      ...(cardsByTeam.get(f.awayTeamId) ?? []),
    ];
    if (cardCandidates.length) {
      groups.push({
        marketType: "PLAYER_CARD",
        label: MARKET_LABEL.PLAYER_CARD,
        options: cardCandidates.map((c) => ({
          name: c.name,
          selection: `card:${c.id}`,
          multiplier: cardMultiplier(c.position, c.price),
        })),
      });
    }
    return {
      fixtureId: f.id,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      home: { name: f.homeTeam.name, logoUrl: f.homeTeam.logoUrl },
      away: { name: f.awayTeam.name, logoUrl: f.awayTeam.logoUrl },
      time: formatKickoff(f.kickoff),
      groups,
    };
  });

  // User's bets → balance + display rows. (app)/layout guarantees a session,
  // but guard for null so the page never throws.
  const user = await getCurrentUser();
  const rawBets = user
    ? await db.bet.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          fixture: {
            select: {
              homeTeam: { select: { name: true, logoUrl: true } },
              awayTeam: { select: { name: true, logoUrl: true } },
            },
          },
        },
      })
    : [];

  // Balance comes directly from the persisted User.bettingBalance field.
  const balance = user?.bettingBalance ?? 5000000;

  // Resolve player names referenced by any player-prop selections.
  const propIds = rawBets
    .map((b) => b.selection.split(":"))
    .filter(([kind, id]) => id && (kind === "scorer" || kind === "assist" || kind === "card"))
    .map(([, id]) => id);
  const propPlayers = propIds.length
    ? await db.player.findMany({ where: { id: { in: propIds } }, select: { id: true, name: true } })
    : [];
  const playerNames = new Map(propPlayers.map((p) => [p.id, p.name]));

  const bets: BetView[] = rawBets.map((b) => {
    const home = b.fixture?.homeTeam ?? { name: "—", logoUrl: null };
    const away = b.fixture?.awayTeam ?? { name: "—", logoUrl: null };
    return {
      id: b.id,
      home,
      away,
      marketLabel: MARKET_LABEL[b.marketType],
      pick: describePick(b.selection, home.name, away.name, playerNames),
      stake: b.stake,
      multiplier: b.multiplier,
      status: b.status,
      payout: b.payout,
    };
  });

  // H2H challenges for the current user (as creator or opponent).
  const rawH2H = user
    ? await db.h2HChallenge.findMany({
        where: { OR: [{ creatorId: user.id }, { opponentId: user.id }] },
        orderBy: { createdAt: "desc" },
        include: {
          creator: { select: { id: true, name: true } },
          opponent: { select: { id: true, name: true } },
          fixture: {
            select: {
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
            },
          },
        },
      })
    : [];

  const h2hChallenges: H2HChallengeView[] = rawH2H.map((c) => ({
    id: c.id,
    creatorId: c.creatorId,
    opponentId: c.opponentId,
    fixtureId: c.fixtureId,
    selection: c.selection,
    multiplier: c.multiplier,
    pickLabel: c.pickLabel,
    stake: c.stake,
    status: c.status as H2HChallengeView["status"],
    winnerId: c.winnerId,
    createdAt: c.createdAt.toISOString(),
    creator: { id: c.creator.id, name: c.creator.name ?? "Unknown" },
    opponent: { id: c.opponent.id, name: c.opponent.name ?? "Unknown" },
    fixture: {
      home: c.fixture?.homeTeam?.name ?? "—",
      away: c.fixture?.awayTeam?.name ?? "—",
    },
  }));

  // League members the current user can challenge (others in any shared league).
  const leagueMembers: { id: string; name: string }[] = [];
  if (user) {
    const memberships = await db.leagueMember.findMany({
      where: { userId: user.id },
      select: { leagueId: true },
    });
    const leagueIds = memberships.map((m) => m.leagueId);
    if (leagueIds.length) {
      const others = await db.leagueMember.findMany({
        where: { leagueId: { in: leagueIds }, userId: { not: user.id } },
        select: { user: { select: { id: true, name: true } } },
        distinct: ["userId"],
      });
      for (const o of others) {
        leagueMembers.push({ id: o.user.id, name: o.user.name ?? "Unknown" });
      }
    }
  }

  // The (app) layout provides the shell + auth; render the screen directly.
  return (
    <PredictClient
      markets={markets}
      bets={bets}
      balance={balance}
      h2hChallenges={h2hChallenges}
      userId={user?.id ?? ""}
      leagueMembers={leagueMembers}
    />
  );
}
