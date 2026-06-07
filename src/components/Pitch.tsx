// Pitch + player tokens ported from design/components.jsx.
// Data-driven from our real squad shape. Works in "view" (dashboard, shows
// points) and "pick" (picker, shows price + empty slots) modes.
import { Icon } from "@/components/Icon";
import { Flag } from "@/components/Flag";
import { Jersey } from "@/components/Jersey";
import type { Position } from "@/lib/squad-rules";

export interface PitchPlayer {
  id: string;
  name: string;
  country: string;
  position: Position;
  price: number; // tenths of a million
  eliminated?: boolean;
}

// A slot is either a player or an empty placeholder of a given position.
export type Slot = { position: Position; player: PitchPlayer | null };

function PitchBg() {
  return (
    <svg
      className="pitch-lines"
      viewBox="0 0 300 380"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <rect x={6} y={6} width={288} height={368} rx={6} fill="none" stroke="var(--pitch-line)" strokeWidth={1.5} />
      <line x1={6} y1={190} x2={294} y2={190} stroke="var(--pitch-line)" strokeWidth={1.2} />
      <circle cx={150} cy={190} r={42} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
      <circle cx={150} cy={190} r={2.5} fill="var(--pitch-line)" />
      <rect x={95} y={6} width={110} height={46} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
      <rect x={125} y={6} width={50} height={18} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
      <rect x={95} y={328} width={110} height={46} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
      <rect x={125} y={356} width={50} height={18} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
    </svg>
  );
}

function lastName(name: string) {
  return name.split(" ").slice(-1)[0];
}

function Token({
  slot,
  isCaptain,
  isVice,
  gwPts,
  mode,
  onClick,
}: {
  slot: Slot;
  isCaptain?: boolean;
  isVice?: boolean;
  gwPts?: number;
  mode: "view" | "pick";
  onClick?: () => void;
}) {
  const { position, player } = slot;
  if (!player) {
    return (
      <button className="slot slot-empty" onClick={onClick} type="button">
        <span className="slot-plus">
          <Icon name="plus" size={22} stroke={2} />
        </span>
        <span className={"slot-pos pos pos-" + position}>{position}</span>
      </button>
    );
  }
  const elim = player.eliminated;
  return (
    <button className={"slot" + (elim ? " is-elim" : "")} onClick={onClick} type="button">
      {isCaptain && <span className="cap-badge">C</span>}
      {isVice && <span className="cap-badge vice">V</span>}
      <div className="slot-jersey">
        <Jersey country={player.country} size={46} />
      </div>
      <div className="slot-flag">
        <Flag country={player.country} size={13} round />
      </div>
      <div className="slot-name">{lastName(player.name)}</div>
      {mode === "view" ? (
        <div className={"slot-pts num" + (typeof gwPts === "number" && gwPts >= 8 ? " hot" : "")}>
          {elim ? "OUT" : isCaptain ? (gwPts ?? 0) * 2 : (gwPts ?? 0)}
        </div>
      ) : (
        <div className="slot-price num">£{(player.price / 10).toFixed(1)}</div>
      )}
    </button>
  );
}

export function Pitch({
  rows,
  captainId,
  viceId,
  mode = "view",
  gwPoints,
  onSlot,
  compact,
}: {
  // rows in display order GK→DEF→MID→FWD, each a list of slots.
  rows: Record<Position, Slot[]>;
  captainId?: string | null;
  viceId?: string | null;
  mode?: "view" | "pick";
  gwPoints?: Record<string, number>;
  onSlot?: (position: Position, index: number, player: PitchPlayer | null) => void;
  compact?: boolean;
}) {
  const order: Position[] = ["GK", "DEF", "MID", "FWD"];
  return (
    <div className={"pitch" + (compact ? " compact" : "")}>
      <PitchBg />
      <div className="pitch-rows">
        {order.map((pos) => (
          <div key={pos} className="pitch-row">
            {(rows[pos] ?? []).map((slot, i) => (
              <Token
                key={pos + i}
                slot={slot}
                isCaptain={!!slot.player && slot.player.id === captainId}
                isVice={!!slot.player && slot.player.id === viceId}
                gwPts={slot.player && gwPoints ? gwPoints[slot.player.id] ?? 0 : undefined}
                mode={mode}
                onClick={() => onSlot?.(pos, i, slot.player)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
