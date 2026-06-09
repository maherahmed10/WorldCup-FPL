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
  getActiveSquad,
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
import { RankBoard } from "@/components/RankBoard";
import { getGlobalLeaderboard } from "@/lib/leaderboard";

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
  const squad = gameweek ? await getActiveSquad(user.id, gameweek.id) : null;

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

  // Per-gameweek captain + vice (FPL: changes weekly). Falls back to the squad's
  // initial captain if no pick has been made for this gameweek yet.
  const pick = await db.gameweekPick.findUnique({
    where: { userId_gameweekId: { userId: user.id, gameweekId: gameweek!.id } },
    select: { captainId: true, viceId: true },
  });
  const captainId = pick?.captainId ?? squad.captainId;
  const viceId = pick?.viceId ?? null;

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
  const leaderboard = await getGlobalLeaderboard({ userId: user.id, gameweekId: gameweek!.id });

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

      <div style={{ marginBottom: 14 }}>
        <RankBoard data={leaderboard} />
      </div>

      <div className="grid-stats">
        <StatCard label="Total Points" value={seasonTotal} sub="Season" icon="bolt" />
        <StatCard label="This Round" value={`+${gwTotal}`} sub={gameweek?.label ?? ""} tone="accent" icon="arrowup" />
        <StatCard label="Squad" value={`${squad.players.length}/15`} sub="Players picked" tone="gold" icon="team" />
        <StatCard label="Squad Value" value={fmtPrice(squadValue)} sub="At selection" tone="blue" icon="coins" />
      </div>

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
    </div>
  );
}
