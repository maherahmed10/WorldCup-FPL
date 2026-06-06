"use client";

// Reusable filter/search bar for the player pool (market + squad picker).
// Controlled: the owner holds a PlayerFilter and gets patches via onChange.

import type { PlayerFilter, Position, PlayerSort } from "@/lib/players";

const POSITIONS: Array<Position | "ALL"> = ["ALL", "GK", "DEF", "MID", "FWD"];

const SORT_OPTIONS: Array<{ value: PlayerSort; label: string }> = [
  { value: "pts", label: "Total points" },
  { value: "ppg", label: "Points / game" },
  { value: "price-d", label: "Price: high → low" },
  { value: "price-a", label: "Price: low → high" },
  { value: "name", label: "Name (A–Z)" },
];

export function FilterBar({
  filter,
  onChange,
  countries,
  showSort = true,
  showPrice = true,
}: {
  filter: PlayerFilter;
  onChange: (patch: Partial<PlayerFilter>) => void;
  countries: string[];
  showSort?: boolean;
  showPrice?: boolean;
}) {
  const selectStyle = {
    background: "var(--surface-2)",
    borderColor: "var(--line)",
    color: "var(--text)",
  };
  return (
    <div className="mt-3.5 flex flex-col gap-2.5">
      {/* search */}
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2"
        style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
      >
        <span style={{ color: "var(--text-3)" }}>⌕</span>
        <input
          value={filter.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search players…"
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: "var(--text)" }}
        />
        {filter.q && (
          <button onClick={() => onChange({ q: "" })} style={{ color: "var(--text-3)" }} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      {/* position chips */}
      <div className="flex flex-wrap gap-2">
        {POSITIONS.map((x) => {
          const on = filter.pos === x;
          return (
            <button
              key={x}
              onClick={() => onChange({ pos: x })}
              className="rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors"
              style={{
                background: on ? "var(--accent)" : "var(--surface-2)",
                borderColor: on ? "var(--accent)" : "var(--line)",
                color: on ? "var(--accent-ink)" : "var(--text-2)",
              }}
            >
              {x === "ALL" ? "All" : x}
            </button>
          );
        })}
      </div>

      {/* selects + price slider */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={filter.country}
          onChange={(e) => onChange({ country: e.target.value })}
          className="rounded-lg border px-2.5 py-1.5 text-[13px]"
          style={selectStyle}
        >
          <option value="ALL">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {showSort && (
          <select
            value={filter.sort}
            onChange={(e) => onChange({ sort: e.target.value as PlayerSort })}
            className="rounded-lg border px-2.5 py-1.5 text-[13px]"
            style={selectStyle}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}

        {showPrice && (
          <label
            className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px]"
            style={selectStyle}
          >
            <span style={{ color: "var(--text-2)" }}>
              Max £<b className="num">{filter.maxPrice.toFixed(1)}</b>
            </span>
            <input
              type="range"
              min={4}
              max={13}
              step={0.5}
              value={filter.maxPrice}
              onChange={(e) => onChange({ maxPrice: +e.target.value })}
            />
          </label>
        )}
      </div>
    </div>
  );
}
