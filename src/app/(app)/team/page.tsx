// My Team / dashboard — ported from design/screens_dash.jsx.
// Server component: loads the user's active squad for the current gameweek.
// Shows the empty "pick your team" state if they haven't built one yet.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtPrice } from "@/lib/format";
import { db } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { StatCard } from "@/components/StatCard";
import { Countdown } from "@/components/Countdown";
import { TeamPitch } from "@/components/TeamPitch";
import {
  getCurrentGameweek,
  getUpcomingDeadlineGameweek,
  getViewSquad,
  toPitchRows,
} from "@/lib/squad-data";
import {
  getGameweekPlayerPoints,
  getGameweekMinutes,
  squadGameweekTotal,
  getUserSeasonTotal,
} from "@/lib/squad-points";
import { totalPrice } from "@/lib/squad-rules";
import type { PerkLike } from "@/lib/store";
import { TeamNamePrompt } from "./TeamNamePrompt";
import { MiniStore } from "@/components/MiniStore";
import { PlayersInAction, type PlayerInAction } from "@/components/PlayersInAction";
import { SquadFixtures, type SquadFixtureItem } from "@/components/SquadFixtures";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The (app) layout guarantees a user; this is just for types.
  if (!user) return null;

  const appUser = await db.user.findUnique({ where: { id: user.id } });

  // First-login: prompt for a fantasy team name before anything else.
  if (appUser && !appUser.teamName) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h1>My Team</h1>
        </div>
        <TeamNamePrompt suggestion={appUser.name} />
      </div>
    );
  }

  const teamName = appUser?.teamName ?? "My Team";
  const gameweek = await getCurrentGameweek();
  // A team carries forward: if there's no squad saved for this exact gameweek,
  // show the user's most recent one (so a knockout user who picked in MD1 and
  // never re-saved still has a team). squadGwId tells us where the captain came from.
  const view = gameweek ? await getViewSquad(user.id, gameweek.startsAt) : null;
  const squad = view?.squad ?? null;
  const squadGwId = view?.gameweekId ?? gameweek?.id ?? "";

  // ---- empty state: no squad yet ----
  if (!squad) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h1>{teamName}</h1>
        </div>
        <div className="empty">
          <div className="empty-ico">
            <Icon name="team" size={28} />
          </div>
          <h3>No squad yet</h3>
          <p>
            Pick your 15-player World Cup squad to start earning points this
            round.
          </p>
          <Link className="btn btn-primary" href="/squad">
            <Icon name="plus" size={17} />
            Pick Your Team
          </Link>
        </div>
      </div>
    );
  }

  // ---- has a squad: full dashboard ----
  const squadValue = totalPrice(squad.players); // tenths of a million
  // The countdown banner shows the NEXT deadline you can still act on — which
  // advances to the next gameweek once the current one's deadline has passed.
  const deadlineGw = await getUpcomingDeadlineGameweek();
  const deadlineMs = deadlineGw?.deadline.getTime() ?? gameweek!.deadline.getTime();
  const rows = toPitchRows(squad.players);
  const bench = squad.players.filter((p) => !p.isStarting);

  // Per-gameweek captain + vice (FPL: changes weekly), keyed to the gameweek the
  // displayed squad came from (carries forward with the team).
  const pick = await db.gameweekPick.findUnique({
    where: { userId_gameweekId: { userId: user.id, gameweekId: squadGwId } },
    select: { captainId: true, viceId: true },
  });
  const captainId = pick?.captainId ?? squad.captainId;
  const viceId = pick?.viceId ?? null;

  // Injury warnings — captain first, then other starters.
  const captainPlayer = squad.players.find((p) => p.id === captainId);
  const injuredStarters = squad.players.filter(
    (p) => p.injured && p.isStarting && p.id !== captainId,
  );

  // Real points from settled PlayerMatchStat (0 until matches are played + settled).
  const gwPoints = await getGameweekPlayerPoints(
    squad.players.map((p) => p.id),
    gameweek!.id,
  );
  const gwMinutes = await getGameweekMinutes(
    squad.players.map((p) => p.id),
    gameweek!.id,
  );
  const gwTotal = squadGameweekTotal(squad.players, captainId, gwPoints, viceId, gwMinutes);
  const seasonTotal = await getUserSeasonTotal(user.id);

  // Store data for mini store panel
  const rawPerks = await db.userPerk.findMany({
    where: { userId: user.id },
    select: { storeItemId: true, gameweekId: true, usedAt: true },
  });
  const ownedPerks = rawPerks as PerkLike[];
  const isGroupStage = !(gameweek?.isKnockout ?? false);

  // Global rank board (added at the top — see leaderboard.ts).
  const pendingH2HCount = await db.h2HChallenge.count({
    where: { opponentId: user.id, status: "PENDING" },
  });

  // "Your Players in Action Today" — fixtures within the current UTC day + 6h buffer for
  // late North-American kickoffs that cross midnight UTC.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayWindowEnd = new Date(todayStart.getTime() + 30 * 60 * 60 * 1000); // +30h

  const [todayFixtures, playerTeamRows] = await Promise.all([
    db.fixture.findMany({
      where: {
        kickoff: { gte: todayStart, lt: todayWindowEnd },
        status: { in: ["SCHEDULED", "LIVE", "FINISHED"] },
      },
      select: {
        id: true,
        kickoff: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { country: true } },
        awayTeam: { select: { country: true } },
      },
    }),
    db.player.findMany({
      where: { id: { in: squad.players.map((p) => p.id) } },
      select: { id: true, teamId: true },
    }),
  ]);

  const teamToFixture = new Map<string, typeof todayFixtures[0]>();
  for (const f of todayFixtures) {
    teamToFixture.set(f.homeTeamId, f);
    teamToFixture.set(f.awayTeamId, f);
  }
  const playerTeamMap = new Map(playerTeamRows.map((r) => [r.id, r.teamId]));
  const squadTeamIds = [...new Set(playerTeamRows.map((r) => r.teamId))];

  // Upcoming fixtures for squads teams — strictly after today's window to avoid
  // overlapping with the "Players in Action Today" section above.
  const upcomingRaw = await db.fixture.findMany({
    where: {
      status: "SCHEDULED",
      kickoff: { gt: todayWindowEnd },
      OR: [
        { homeTeamId: { in: squadTeamIds } },
        { awayTeamId: { in: squadTeamIds } },
      ],
    },
    orderBy: { kickoff: "asc" },
    take: 6,
    select: {
      id: true,
      kickoff: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { country: true } },
      awayTeam: { select: { country: true } },
    },
  });

  const squadFixtures: SquadFixtureItem[] = upcomingRaw.map((f) => ({
    id: f.id,
    kickoffIso: f.kickoff.toISOString(),
    home: f.homeTeam.country,
    away: f.awayTeam.country,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    players: squad.players
      .filter((p) => {
        const tid = playerTeamMap.get(p.id);
        return tid === f.homeTeamId || tid === f.awayTeamId;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        isHomeTeam: playerTeamMap.get(p.id) === f.homeTeamId,
        isCaptain: p.id === captainId,
        isVice: p.id === viceId,
      })),
  }));

  const playersInAction: PlayerInAction[] = squad.players
    .filter((p) => {
      const tid = playerTeamMap.get(p.id);
      return tid && teamToFixture.has(tid);
    })
    .map((p) => {
      const tid = playerTeamMap.get(p.id)!;
      const f = teamToFixture.get(tid)!;
      return {
        id: p.id,
        name: p.name,
        position: p.position,
        country: p.country,
        isCapt: p.id === captainId,
        isVice: p.id === viceId,
        isStarting: p.isStarting,
        fixture: {
          id: f.id,
          kickoffIso: f.kickoff.toISOString(),
          status: f.status as "SCHEDULED" | "LIVE" | "FINISHED",
          homeScore: f.homeScore,
          awayScore: f.awayScore,
          home: f.homeTeam.country,
          away: f.awayTeam.country,
        },
      };
    });

  return (
    <div className="screen">
      <div className="screen-head head-row">
        <div>
          <h1>{teamName}</h1>
          <div className="sub">{gameweek?.label}</div>
        </div>
        <Link className="btn btn-ghost" href="/squad">
          <Icon name="settings" size={16} />
          {isGroupStage ? "Formation & Captain" : "Edit Squad"}
        </Link>
      </div>

      {pendingH2HCount > 0 && (
        <div className="banner live" style={{ marginBottom: 14 }}>
          <div className="banner-l">
            <div className="banner-ico">
              <Icon name="predictions" size={20} style={{ color: "var(--live)" }} />
            </div>
            <div>
              <h4>⚔️ {pendingH2HCount === 1 ? "1 H2H challenge" : `${pendingH2HCount} H2H challenges`} waiting</h4>
              <p>A league opponent challenged you — accept or decline before it expires.</p>
            </div>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/predict">View</Link>
        </div>
      )}

      {playersInAction.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <PlayersInAction players={playersInAction} />
        </div>
      )}

      <div className="grid-stats">
        <StatCard label="Total Points" value={seasonTotal} sub="Season" icon="bolt" />
        <StatCard label="This Round" value={`+${gwTotal}`} sub={gameweek?.label ?? ""} tone="accent" icon="arrowup" />
        <StatCard label="Squad" value={`${squad.players.length}/15`} sub="Players picked" tone="gold" icon="team" />
        <StatCard label="Squad Value" value={fmtPrice(squadValue)} sub="At selection" tone="blue" icon="coins" />
      </div>

      {captainPlayer?.injured && (
        <div className="banner live" style={{ marginTop: 14 }}>
          <div className="banner-l">
            <div className="banner-ico">
              <Icon name="info" size={20} style={{ color: "var(--live)" }} />
            </div>
            <div>
              <h4>Your captain is injured</h4>
              <p>{captainPlayer.name} is listed as injured — consider changing your captain before the deadline.</p>
            </div>
          </div>
          <Link className="btn btn-ghost btn-sm" href="/squad">Change</Link>
        </div>
      )}

      {injuredStarters.length > 0 && (
        <div className="banner warn" style={{ marginTop: 14 }}>
          <div className="banner-l">
            <div className="banner-ico">
              <Icon name="info" size={20} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h4>{injuredStarters.length === 1 ? "1 starter" : `${injuredStarters.length} starters`} injured</h4>
              <p>{injuredStarters.map((p) => p.name).join(", ")} {injuredStarters.length === 1 ? "is" : "are"} listed as injured.</p>
            </div>
          </div>
        </div>
      )}

      <div className="banner warn" style={{ marginTop: 14 }}>
        <div className="banner-l">
          <div className="banner-ico">
            <Icon name="clock" size={20} style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <h4>{deadlineGw?.label ?? gameweek?.label} deadline</h4>
            <p>
              {deadlineGw && gameweek && deadlineGw.id !== gameweek.id
                ? `Editing prepares your ${deadlineGw.label} team — set your XI, captain & vice before kickoff.`
                : "Set your captain and squad before kickoff."}
            </p>
          </div>
        </div>
        <Countdown to={deadlineMs} />
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div>
          <div className="pitch-wrap">
            <TeamPitch rows={rows} captainId={captainId} viceId={viceId} gwPoints={gwPoints} />
          </div>
        </div>
        <div>
          <div className="card" style={{ padding: 16 }}>
            <div className="sum-title" style={{ marginBottom: 10 }}>
              Bench
            </div>
            {bench.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-3)" }}>No bench players.</p>
            ) : (
              bench.map((p) => (
                <div key={p.id} className="score-row">
                  <span className={"pos pos-" + p.position}>{p.position}</span>
                  <span className="sr-name">{p.name}</span>
                  <span className="sr-pts num">{gwPoints[p.id] ?? 0}</span>
                </div>
              ))
            )}
          </div>

          <MiniStore
            balance={appUser?.bettingBalance ?? 1000}
            ownedPerks={ownedPerks}
            isGroupStage={isGroupStage}
          />
        </div>
      </div>

      <SquadFixtures fixtures={squadFixtures} />
    </div>
  );
}
