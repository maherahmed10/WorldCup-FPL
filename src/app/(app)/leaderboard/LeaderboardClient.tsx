"use client";

import { useState } from "react";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/Icon";
import { fmt, Move } from "@/components/GlobalLeaderboardModal";
import type { GlobalLeaderboard, LeaderboardRow, LeaderCard } from "@/lib/leaderboard";

const MEDALS = ["gold", "silver", "bronze"];

const PODIUM: Record<number, { emoji: string; label: string; color: string; bg: string; border: string; glow: string }> = {
  1: { emoji: "🥇", label: "You're #1 in the world", color: "#F5C518", bg: "rgba(245,197,24,.10)", border: "rgba(245,197,24,.45)", glow: "0 0 32px rgba(245,197,24,.25), 0 4px 16px rgba(0,0,0,.4)" },
  2: { emoji: "🥈", label: "You're 2nd in the world", color: "#C8C8C8", bg: "rgba(200,200,200,.09)", border: "rgba(200,200,200,.35)", glow: "0 0 32px rgba(200,200,200,.18), 0 4px 16px rgba(0,0,0,.4)" },
  3: { emoji: "🥉", label: "You're 3rd in the world", color: "#CD7F32", bg: "rgba(205,127,50,.09)", border: "rgba(205,127,50,.35)", glow: "0 0 32px rgba(205,127,50,.2), 0 4px 16px rgba(0,0,0,.4)" },
};

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

export function LeaderboardClient({
  data,
  teamName,
}: {
  data: GlobalLeaderboard;
  teamName: string;
}) {
  const [tab, setTab] = useState<"gameday" | "overall">("overall");
  const board = data[tab];
  const myRank = board.rank;
  const podium = myRank != null && myRank <= 3 ? PODIUM[myRank] : null;

  const meRow: LeaderboardRow = {
    userId: "me",
    rank: board.rank as number,
    delta: board.delta,
    teamName,
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
    <div className="screen">
      <div className="screen-head">
        <h1>Leaderboard</h1>
        <div className="sub">{data.gameweekLabel}</div>
      </div>

      {/* Leaders spotlight */}
      {(data.leaders.gameday || data.leaders.overall) && (
        <div className="lb-spotlight" style={{ marginBottom: 16 }}>
          {data.leaders.gameday && (
            <SpotCard
              kind="gameday"
              label="Gameday Top Scorer"
              icon="bolt"
              leader={data.leaders.gameday}
              ptsLabel="pts this round"
            />
          )}
          {data.leaders.overall && (
            <SpotCard
              kind="overall"
              label="Overall Leader"
              icon="star"
              leader={data.leaders.overall}
              ptsLabel="pts total"
            />
          )}
        </div>
      )}

      {/* Tab switcher */}
      <div className="lb-tabs" style={{ marginBottom: 4 }}>
        <button
          className={"lb-tab" + (tab === "gameday" ? " on" : "")}
          onClick={() => setTab("gameday")}
        >
          This Gameday
        </button>
        <button
          className={"lb-tab" + (tab === "overall" ? " on" : "")}
          onClick={() => setTab("overall")}
        >
          Overall
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>{meta}</div>

      {/* Podium hero — only when you're top 3 */}
      {podium && (
        <div
          style={{
            marginBottom: 16,
            padding: "20px 20px 18px",
            borderRadius: "var(--r-lg)",
            border: `1px solid ${podium.border}`,
            background: podium.bg,
            boxShadow: podium.glow,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>{podium.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: podium.color,
                fontFamily: "var(--font-display, sans-serif)",
              }}
            >
              {podium.label}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-2)", marginTop: 3, fontWeight: 600 }}>
              {teamName} &nbsp;·&nbsp; <span style={{ color: podium.color, fontVariantNumeric: "tabular-nums" }}>{fmt(board.pts)} pts</span>
              &nbsp;·&nbsp; out of {fmt(data.totalManagers)} managers
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden", boxShadow: podium ? podium.glow : undefined }}>
        <div className="lb-list" style={{ maxHeight: "none", overflow: "visible" }}>
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
        <div
          className="lb-foot"
          style={{
            position: "static",
            borderTop: `1px solid ${podium ? podium.border : "var(--line)"}`,
            background: podium ? podium.bg : undefined,
          }}
        >
          <LbRow r={meRow} />
        </div>
      </div>
    </div>
  );
}
