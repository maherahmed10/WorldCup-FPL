// Predictions (Lane 2). Server component: reads upcoming fixtures + the user's
// bets from our DB, builds the markets (placeholder match odds + our own fixed
// player-prop values), computes the points balance, and hands it to the client.
// Maps to design: screens_predict.jsx.

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  availableBalance,
  matchMarkets,
  PLAYER_PROP_MULTIPLIER,
  type BetLike,
  type MarketType,
} from "@/lib/betting";
import { PredictClient, type BetView, type FixtureMarketsView } from "./PredictClient";

export const dynamic = "force-dynamic";

const MAX_FIXTURES = 10;
const SCORERS_PER_TEAM = 3;

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
    },
  });

  // Attacking players for the teams on show → anytime-scorer options.
  const teamIds = Array.from(new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId])));
  const attackers = teamIds.length
    ? await db.player.findMany({
        where: { teamId: { in: teamIds }, position: { in: ["FWD", "MID"] } },
        select: { id: true, name: true, teamId: true },
        orderBy: { name: "asc" },
      })
    : [];
  const scorersByTeam = new Map<string, Array<{ id: string; name: string }>>();
  for (const a of attackers) {
    const list = scorersByTeam.get(a.teamId) ?? [];
    if (list.length < SCORERS_PER_TEAM) list.push({ id: a.id, name: a.name });
    scorersByTeam.set(a.teamId, list);
  }

  const markets: FixtureMarketsView[] = fixtures.map((f) => {
    const groups = matchMarkets(f.homeTeam.name, f.awayTeam.name).map((g) => ({
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
          multiplier: PLAYER_PROP_MULTIPLIER.PLAYER_SCORER,
        })),
      });
    }
    return {
      fixtureId: f.id,
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

  const balance = availableBalance(rawBets as BetLike[]);

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

  // The (app) layout provides the shell + auth; render the screen directly.
  return <PredictClient markets={markets} bets={bets} balance={balance} />;
}
