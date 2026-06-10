// Reusable player row — used by the Players market (variant="market") AND
// Youssef's squad picker (variant="pick"). Coordinate the prop shape here:
// it renders a `PlayerView` (src/lib/players.ts). Presentational only; the
// owning client screen supplies onPick / picked / disabled.

import type { PlayerView, Position } from "@/lib/players";
import { Flag } from "./Flag";
import { Spark } from "./Spark";
import { fmtMoney } from "@/lib/format";

// Position badge tint (design uses .pos-GK/.pos-DEF/... ; inlined with tokens).
const POS_STYLE: Record<Position, { bg: string; fg: string }> = {
  GK: { bg: "rgba(255,197,61,0.16)", fg: "var(--gold)" },
  DEF: { bg: "rgba(61,165,255,0.16)", fg: "var(--blue)" },
  MID: { bg: "rgba(24,224,138,0.16)", fg: "var(--accent)" },
  FWD: { bg: "rgba(157,123,255,0.18)", fg: "var(--purple)" },
};

export function PosBadge({ pos }: { pos: Position }) {
  const s = POS_STYLE[pos];
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {pos}
    </span>
  );
}

export function PlayerRow({
  p,
  variant = "market",
  onPick,
  picked = false,
  disabled = false,
  reason,
  isFavourite,
  onFavourite,
}: {
  p: PlayerView;
  variant?: "market" | "pick";
  onPick?: (p: PlayerView) => void;
  picked?: boolean;
  disabled?: boolean;
  reason?: string;
  isFavourite?: boolean;
  onFavourite?: () => void;
}) {
  const clickable = variant === "pick" && !disabled;
  const Wrapper = clickable ? "button" : "div";
  return (
    <Wrapper
      onClick={clickable ? () => onPick?.(p) : undefined}
      disabled={clickable ? disabled : undefined}
      title={disabled ? reason : undefined}
      className="flex w-full items-center gap-3 rounded-xl border p-2.5 px-3.5 text-left transition-colors"
      style={{
        background: picked ? "rgba(24,224,138,0.06)" : "var(--surface)",
        borderColor: picked ? "rgba(24,224,138,0.4)" : "var(--line)",
        opacity: disabled ? 0.5 : 1,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <Flag country={p.country} size={22} round />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{p.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <PosBadge pos={p.position} />
          <span style={{ color: "var(--text-2)" }}>{p.country}</span>
        </div>
      </div>

      {variant === "market" && (
        <div className="hidden shrink-0 sm:block">
          <Spark data={p.form} />
        </div>
      )}

      <div className="min-w-[42px] text-right">
        <div className="num text-base font-extrabold">{p.pts}</div>
        <div className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>
          {variant === "market" ? `${p.ppg.toFixed(1)} /gm` : "proj pts"}
        </div>
      </div>

      <div className="num min-w-[50px] text-right text-[15px] font-extrabold">
        {fmtMoney(p.price * 1_000_000)}
      </div>

      {variant === "market" && onFavourite !== undefined && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavourite(); }}
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 2px",
            fontSize: 18,
            lineHeight: 1,
            color: isFavourite ? "#e11d48" : "var(--text-3)",
            flexShrink: 0,
          }}
        >
          {isFavourite ? "♥" : "♡"}
        </button>
      )}

      {variant === "pick" && (
        <div className="flex w-[30px] shrink-0 justify-end">
          {picked ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[11px] font-bold"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              In
            </span>
          ) : disabled ? (
            <span style={{ color: "var(--text-3)" }}>🔒</span>
          ) : (
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-lg leading-none"
              style={{ background: "var(--surface-3)", color: "var(--accent)" }}
            >
              +
            </span>
          )}
        </div>
      )}
    </Wrapper>
  );
}
