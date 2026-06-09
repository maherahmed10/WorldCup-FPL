// My Team / dashboard — ported from design/screens_dash.jsx.
// Server component: loads the user's active squad for the current gameweek.
// Shows the empty "pick your team" state if they haven't built one yet.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { StatCard } from "@/components/StatCard";
import { Countdown } from "@/components/Countdown";
import { Pitch } from "@/components/Pitch";
import {
  getCurrentGameweek,
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
import { CaptainPanel } from "./CaptainPanel";
import { MiniStore } from "@/components/MiniStore";

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
  // gameweek is guaranteed here (we'd have hit the empty state otherwise).
  const deadlineMs = gameweek!.deadline.getTime();
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
  const deadlinePassed = deadlineMs <= Date.now();

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

  // Starters as options for the captain/vice picker.
  const starterOptions = squad.players
    .filter((p) => p.isStarting)
    .map((p) => ({ id: p.id, name: p.name, position: p.position, country: p.country }));

  // Store data for mini store panel
  const rawPerks = await db.userPerk.findMany({
    where: { userId: user.id },
    select: { storeItemId: true, gameweekId: true, usedAt: true },
  });
  const ownedPerks = rawPerks as PerkLike[];
  const isGroupStage = !(gameweek?.isKnockout ?? false);

  return (
    <div className="screen">
      <div className="screen-head head-row">
        <div>
          <h1>{teamName}</h1>
          <div className="sub">{gameweek?.label}</div>
        </div>
        <Link className="btn btn-ghost" href="/squad">
          <Icon name="settings" size={16} />
          Edit Squad
        </Link>
      </div>

      <div className="grid-stats">
        <StatCard label="Total Points" value={seasonTotal} sub="Season" icon="bolt" />
        <StatCard label="This Round" value={`+${gwTotal}`} sub={gameweek?.label ?? ""} tone="accent" icon="arrowup" />
        <StatCard label="Squad" value={`${squad.players.length}/15`} sub="Players picked" tone="gold" icon="team" />
        <StatCard label="Squad Value" value={`£${(squadValue / 10).toFixed(1)}m`} sub="At selection" tone="blue" icon="coins" />
      </div>

      <div className="banner warn" style={{ marginTop: 14 }}>
        <div className="banner-l">
          <div className="banner-ico">
            <Icon name="clock" size={20} style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <h4>{gameweek?.label} deadline</h4>
            <p>Set your captain and squad before kickoff.</p>
          </div>
        </div>
        <Countdown to={deadlineMs} />
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div>
          <div className="pitch-wrap">
            <Pitch rows={rows} captainId={captainId} viceId={viceId} mode="view" gwPoints={gwPoints} />
          </div>
        </div>
        <div>
          <CaptainPanel
            gameweekId={gameweek!.id}
            gameweekLabel={gameweek?.label ?? ""}
            starters={starterOptions}
            captainId={captainId}
            viceId={viceId}
            deadlinePassed={deadlinePassed}
          />
          <div className="card" style={{ padding: 16, marginTop: 14 }}>
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
