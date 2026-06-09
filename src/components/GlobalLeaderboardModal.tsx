"use client";

// Global leaderboard modal — leaders spotlight + tabs + ranked list + sticky
// "you" footer. Pure presentational: receives the full leaderboard payload from
// src/lib/leaderboard.ts (no client fetch). Built verbatim from the design spec.

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Flag } from "@/components/Flag";
import type {
  GlobalLeaderboard,
  LeaderboardRow,
  LeaderCard,
} from "@/lib/leaderboard";

export const fmt = (n: number) => n.toLocaleString("en-US");
export const pctTop = (rank: number, total: number) =>
  ((p) => (p < 1 ? p.toFixed(1) : Math.round(p)))((rank / total) * 100);
export const fillFromRank = (rank: number, total: number) =>
  Math.max(2, 100 - (rank / total) * 100);

// ── movement chip (▲/▼/–). null delta → no chip (keeps the column width). ──
export function Move({ delta, big }: { delta: number | null; big?: boolean }) {
  if (delta == null) return null;
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <span
      className={"move " + dir}
      style={big ? { fontSize: 13, padding: "3px 10px 3px 8px" } : undefined}
    >
      <span className="tri" />
      {delta !== 0 ? fmt(Math.abs(delta)) : "–"}
    </span>
  );
}

const MEDALS = ["gold", "silver", "bronze"];

function LbRow({ r }: { r: LeaderboardRow }) {
  const medal = r.rank != null && r.rank <= 3 ? MEDALS[r.rank - 1] : "";
  return (
    <div className={"lb-row" + (r.isYou ? " you" : "")}>
      <div className={"lb-rank " + medal}>
        {r.rank == null ? "–" : r.rank <= 3 ? <span className="medal">{r.rank}</span> : fmt(r.rank)}
      </div>
      <div className="lb-move">
        <Move delta={r.delta} />
      </div>
      <div className="lb-av">{r.managerName.charAt(0)}</div>
      <div className="lb-id">
        <div className="lb-name">
          {r.teamName}
          {r.isYou && <span className="you-pill">YOU</span>}
        </div>
        <div className="lb-mgr">
          {r.country && (
            <Flag country={r.country} size={11} style={{ marginRight: 6, verticalAlign: "-1px" }} />
          )}
          {r.managerName}
        </div>
      </div>
      <div className="lb-pts">
        <div className="n">{fmt(r.pts)}</div>
        <div className="l">pts</div>
      </div>
    </div>
  );
}

function SpotCard({
  kind,
  label,
  icon,
  leader,
  ptsLabel,
}: {
  kind: "gameday" | "overall";
  label: string;
  icon: string;
  leader: LeaderCard;
  ptsLabel: string;
}) {
  return (
    <div className={"spot " + kind}>
      <div className="spot-top">
        <span className="ico">
          <Icon name={icon} size={14} />
        </span>{" "}
        {label}
      </div>
      <div className="spot-id">
        <div className="spot-av">{leader.managerName.charAt(0)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="spot-name">{leader.teamName}</div>
          <div className="spot-mgr">
            {leader.country && (
              <Flag country={leader.country} size={11} style={{ marginRight: 6, verticalAlign: "-1px" }} />
            )}
            {leader.managerName}
          </div>
        </div>
      </div>
      <div className="spot-score">
        <span className="n">{fmt(leader.pts)}</span>
        <span className="l">{ptsLabel}</span>
      </div>
    </div>
  );
}

function Spotlight({ leaders }: { leaders: GlobalLeaderboard["leaders"] }) {
  if (!leaders.gameday && !leaders.overall) return null;
  return (
    <div className="lb-spotlight">
      {leaders.gameday && (
        <SpotCard kind="gameday" label="Gameday Top Scorer" icon="bolt" leader={leaders.gameday} ptsLabel="pts this round" />
      )}
      {leaders.overall && (
        <SpotCard kind="overall" label="Overall Leader" icon="star" leader={leaders.overall} ptsLabel="pts total" />
      )}
    </div>
  );
}

export function GlobalLeaderboardModal({
  initialTab,
  onClose,
  data,
}: {
  initialTab: "gameday" | "overall";
  onClose: () => void;
  data: GlobalLeaderboard;
}) {
  const [tab, setTab] = useState<"gameday" | "overall">(initialTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const board = data[tab];
  const meRow: LeaderboardRow = {
    userId: "me",
    rank: board.rank as number, // LbRow tolerates null
    delta: board.delta,
    teamName: data.teamName,
    managerName: data.managerName,
    country: data.country,
    pts: board.pts,
    isYou: true,
  };
  const meta =
    tab === "overall"
      ? `${fmt(data.totalManagers)} managers · Season total`
      : `${fmt(data.totalManagers)} managers · ${data.gameweekLabel}`;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal lb" onMouseDown={(e) => e.stopPropagation()}>
        <div className="lb-head">
          <div className="lb-head-top">
            <h3>
              <span className="ico">
                <Icon name="trophy" size={20} />
              </span>{" "}
              Global Leaderboard
            </h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="lb-meta">{meta}</div>
          <div className="lb-tabs" role="tablist">
            <button
              className={"lb-tab" + (tab === "gameday" ? " on" : "")}
              onClick={() => setTab("gameday")}
              role="tab"
              aria-selected={tab === "gameday"}
            >
              This Gameday
            </button>
            <button
              className={"lb-tab" + (tab === "overall" ? " on" : "")}
              onClick={() => setTab("overall")}
              role="tab"
              aria-selected={tab === "overall"}
            >
              Overall
            </button>
          </div>
        </div>

        <Spotlight leaders={data.leaders} />

        <div className="lb-list">
          <div className="lb-cluster-label">Top managers</div>
          {board.top.map((r) => (
            <LbRow key={r.userId} r={r} />
          ))}
          {board.near.length > 0 && (
            <>
              <div className="lb-cluster-label">Around you</div>
              {board.near.map((r) => (
                <LbRow key={r.userId} r={r} />
              ))}
            </>
          )}
        </div>

        <div className="lb-foot">
          <LbRow r={meRow} />
        </div>
      </div>
    </div>
  );
}
