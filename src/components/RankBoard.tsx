"use client";

// My Team global-rank board: two rank tiles (This Gameday / Overall) + a
// "Leaderboard" button, opening the global leaderboard modal. Pure
// presentational — receives the full payload from src/lib/leaderboard.ts.

import { useState } from "react";
import { Icon } from "@/components/Icon";
import {
  GlobalLeaderboardModal,
  Move,
  fmt,
  pctTop,
  fillFromRank,
} from "@/components/GlobalLeaderboardModal";
import type { GlobalLeaderboard } from "@/lib/leaderboard";

function RankTile({
  kicker,
  cc,
  primary,
  rank,
  pts,
  ptsLabel,
  delta,
  totalManagers,
  onOpen,
}: {
  kicker: string;
  cc: string;
  primary?: boolean;
  rank: number | null;
  pts: number;
  ptsLabel: string;
  delta: number | null;
  totalManagers: number;
  onOpen: () => void;
}) {
  const ranked = rank != null;
  return (
    <button
      className={"rank-tile" + (primary ? " primary" : "")}
      style={{ "--cc": cc, textAlign: "left", width: "100%" } as React.CSSProperties}
      onClick={onOpen}
    >
      <div className="rt-top">
        <span className="rt-kicker">
          <span className="dot" /> {kicker}
        </span>
        <Move delta={delta} big />
      </div>
      <div className="rt-rankrow">
        <span className="rt-hash">#</span>
        <span className="rt-rank">{ranked ? fmt(rank) : "—"}</span>
      </div>
      <div className="rt-meta">
        <span className="rt-pts">
          {ranked ? (
            <>
              <b>{fmt(pts)}</b> {ptsLabel}
            </>
          ) : (
            "Not ranked yet"
          )}
        </span>
      </div>
      <div className="rt-bar">
        <div className="rt-bar-track">
          <i style={{ width: (ranked ? fillFromRank(rank, totalManagers) : 0) + "%" }} />
        </div>
        <div className="rt-bar-label">
          <span className="rt-pct">{ranked ? `Top ${pctTop(rank, totalManagers)}%` : "—"}</span>
          <span className="rt-of">of {fmt(totalManagers)}</span>
        </div>
      </div>
    </button>
  );
}

export function RankBoard({ data }: { data: GlobalLeaderboard }) {
  const [open, setOpen] = useState<null | "gameday" | "overall">(null);
  return (
    <div className="rankboard">
      <div className="rb-head">
        <div className="rb-title">
          <div className="rb-badge">
            <Icon name="trophy" size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="rb-kicker">Global Rank</div>
            <div className="rb-team">{data.teamName}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm rb-view" onClick={() => setOpen("overall")}>
          <Icon name="leagues" size={15} /> Leaderboard
        </button>
      </div>
      <div className="rb-grid">
        <RankTile
          kicker="This Gameday"
          cc="var(--accent)"
          primary
          rank={data.gameday.rank}
          pts={data.gameday.pts}
          ptsLabel="pts this round"
          delta={data.gameday.delta}
          totalManagers={data.totalManagers}
          onOpen={() => setOpen("gameday")}
        />
        <RankTile
          kicker="Overall"
          cc="var(--gold)"
          rank={data.overall.rank}
          pts={data.overall.pts}
          ptsLabel="pts total"
          delta={data.overall.delta}
          totalManagers={data.totalManagers}
          onOpen={() => setOpen("overall")}
        />
      </div>
      {open && <GlobalLeaderboardModal initialTab={open} onClose={() => setOpen(null)} data={data} />}
    </div>
  );
}
