"use client";

import { Flag } from "@/components/Flag";
import type { Position } from "@/lib/squad-rules";

export interface PlayerInActionFixture {
  id: string;
  kickoffIso: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
  home: string;
  away: string;
}

export interface PlayerInAction {
  id: string;
  name: string;
  position: Position;
  country: string;
  isCapt: boolean;
  isVice: boolean;
  isStarting: boolean;
  fixture: PlayerInActionFixture;
}

export function PlayersInAction({ players }: { players: PlayerInAction[] }) {
  if (players.length === 0) return null;

  // Group players by fixture, captain first within each group
  const groups = new Map<string, { fixture: PlayerInActionFixture; players: PlayerInAction[] }>();
  for (const p of players) {
    if (!groups.has(p.fixture.id)) groups.set(p.fixture.id, { fixture: p.fixture, players: [] });
    groups.get(p.fixture.id)!.players.push(p);
  }
  for (const g of groups.values()) {
    g.players.sort((a, b) =>
      (b.isCapt ? 3 : b.isVice ? 2 : b.isStarting ? 1 : 0) -
      (a.isCapt ? 3 : a.isVice ? 2 : a.isStarting ? 1 : 0),
    );
  }

  const hasCaptain = players.some((p) => p.isCapt);
  const liveCount = new Set(
    players.filter((p) => p.fixture.status === "LIVE").map((p) => p.fixture.id),
  ).size;

  return (
    <div className="pia">
      <div className="pia-head">
        <div className="pia-title">
          <span className="pia-icon">⚽</span>
          <div>
            <div className="pia-label">Your Players in Action Today</div>
            {hasCaptain && (
              <div className="pia-sub">Your captain is playing</div>
            )}
          </div>
        </div>
        <div className="pia-meta">
          {liveCount > 0 && <span className="pia-live-badge">● LIVE</span>}
          <span className="pill pill-sm">{players.length} playing</span>
        </div>
      </div>

      <div className="pia-groups">
        {Array.from(groups.values()).map(({ fixture, players: fps }) => (
          <div key={fixture.id} className="pia-group">
            <FixtureRow fixture={fixture} />
            <div className="pia-players">
              {fps.map((p) => (
                <PlayerRow key={p.id} p={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FixtureRow({ fixture }: { fixture: PlayerInActionFixture }) {
  const isLive = fixture.status === "LIVE";
  const isDone = fixture.status === "FINISHED";

  const timeLabel = isLive
    ? null
    : isDone
    ? "FT"
    : new Date(fixture.kickoffIso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

  const scoreOrTime = isDone || isLive
    ? `${fixture.homeScore ?? 0}–${fixture.awayScore ?? 0}`
    : timeLabel;

  return (
    <div className="pia-fixture">
      <div className="pia-matchup">
        <Flag country={fixture.home} size={13} round />
        <span className="pia-team">{fixture.home.replace(/-/g, " ")}</span>
        <span className="pia-vs">vs</span>
        <Flag country={fixture.away} size={13} round />
        <span className="pia-team">{fixture.away.replace(/-/g, " ")}</span>
      </div>
      <span className={`pia-time${isLive ? " pia-time-live" : isDone ? " pia-time-done" : ""}`}>
        {isLive && <span className="pia-dot" />}
        {scoreOrTime}
        {isDone && <span className="pia-ft"> FT</span>}
      </span>
    </div>
  );
}

function PlayerRow({ p }: { p: PlayerInAction }) {
  return (
    <div className={`pia-player${p.isCapt ? " pia-capt" : ""}`}>
      <Flag country={p.country} size={15} round />
      <span className="pia-name">{p.name}</span>
      <span className={"pos pos-" + p.position} style={{ fontSize: 10, padding: "2px 5px" }}>
        {p.position}
      </span>
      {p.isCapt && <span className="pia-badge pia-badge-capt">⚡ C</span>}
      {p.isVice && !p.isCapt && <span className="pia-badge pia-badge-vice">V</span>}
      {!p.isStarting && <span className="pia-badge pia-badge-bench">Bench</span>}
    </div>
  );
}
