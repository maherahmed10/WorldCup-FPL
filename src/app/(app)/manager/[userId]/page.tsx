// View another manager's squad (read-only). Reached from the Leagues standings.
// GATED: only visible once the current transfer window has LOCKED (the gameweek
// deadline has passed) so nobody can copy a rival mid-window. Also restricted to
// managers you share a league with.
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { Icon } from "@/components/Icon";
import { StatCard } from "@/components/StatCard";
import { Pitch } from "@/components/Pitch";
import {
  getCurrentGameweek,
  getViewSquad,
  toPitchRows,
  teamsViewable,
} from "@/lib/squad-data";
import {
  getGameweekPlayerPoints,
  getGameweekMinutes,
  squadGameweekTotal,
  getUserSeasonTotal,
} from "@/lib/squad-points";
import { totalPrice } from "@/lib/squad-rules";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen">
      <Link href="/leagues" className="sub" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Icon name="chevleft" size={16} /> Back to Leagues
      </Link>
      {children}
    </div>
  );
}

export default async function ManagerPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: targetId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // (app) layout guarantees a session

  // Your own team → the editable dashboard.
  if (targetId === user.id) redirect("/team");

  const gameweek = await getCurrentGameweek();

  // ---- locked gate ----
  if (!teamsViewable(gameweek)) {
    return (
      <Shell>
        <div className="empty">
          <div className="empty-ico">
            <Icon name="lock" size={28} />
          </div>
          <h3>Teams are locked</h3>
          <p>
            Rival squads unlock once the transfer window closes (the{" "}
            {gameweek?.label ?? "current"} deadline). Check back after kickoff so
            nobody can copy your team mid-window.
          </p>
          <Link className="btn btn-ghost" href="/leagues">
            Back to Leagues
          </Link>
        </div>
      </Shell>
    );
  }

  // ---- privacy: only managers you share a league with ----
  const shares = await db.leagueMember.findFirst({
    where: { userId: targetId, league: { members: { some: { userId: user.id } } } },
    select: { id: true },
  });
  if (!shares) notFound();

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { name: true, teamName: true },
  });
  if (!target) notFound();

  const teamName = target.teamName ?? target.name;
  // Carry-forward: show the rival's most recent locked squad (they may not have
  // re-saved for the current gameweek). Never reveals a future edit.
  const view = gameweek ? await getViewSquad(targetId, gameweek.startsAt) : null;
  const squad = view?.squad ?? null;

  // ---- no squad picked ----
  if (!squad) {
    return (
      <Shell>
        <div className="screen-head">
          <h1>{teamName}</h1>
          <div className="sub">Manager: {target.name}</div>
        </div>
        <div className="empty">
          <div className="empty-ico">
            <Icon name="team" size={28} />
          </div>
          <h3>No squad yet</h3>
          <p>{target.name} hasn&apos;t picked a squad for {gameweek?.label} yet.</p>
        </div>
      </Shell>
    );
  }

  // ---- read-only dashboard ----
  const squadValue = totalPrice(squad.players); // tenths of a million
  const rows = toPitchRows(squad.players);
  const bench = squad.players.filter((p) => !p.isStarting);

  const pick = await db.gameweekPick.findUnique({
    where: { userId_gameweekId: { userId: targetId, gameweekId: gameweek!.id } },
    select: { captainId: true, viceId: true },
  });
  const captainId = pick?.captainId ?? squad.captainId;
  const viceId = pick?.viceId ?? null;

  const ids = squad.players.map((p) => p.id);
  const gwPoints = await getGameweekPlayerPoints(ids, gameweek!.id);
  const gwMinutes = await getGameweekMinutes(ids, gameweek!.id);
  const gwTotal = squadGameweekTotal(squad.players, captainId, gwPoints, viceId, gwMinutes);
  const seasonTotal = await getUserSeasonTotal(targetId);

  return (
    <Shell>
      <div className="screen-head head-row">
        <div>
          <h1>{teamName}</h1>
          <div className="sub">
            Manager: {target.name} · {gameweek?.label}
          </div>
        </div>
        <span className="pill">
          <Icon name="lock" size={13} /> Locked squad
        </span>
      </div>

      <div className="grid-stats">
        <StatCard label="Total Points" value={seasonTotal} sub="Season" icon="bolt" />
        <StatCard label="This Round" value={`+${gwTotal}`} sub={gameweek?.label ?? ""} tone="accent" icon="arrowup" />
        <StatCard label="Squad" value={`${squad.players.length}/15`} sub="Players picked" tone="gold" icon="team" />
        <StatCard label="Squad Value" value={`£${(squadValue / 10).toFixed(1)}m`} sub="At selection" tone="blue" icon="coins" />
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div>
          <div className="pitch-wrap">
            <Pitch rows={rows} captainId={captainId} viceId={viceId} mode="view" gwPoints={gwPoints} />
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
        </div>
      </div>
    </Shell>
  );
}
