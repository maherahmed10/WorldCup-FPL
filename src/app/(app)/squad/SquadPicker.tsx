"use client";

// Interactive squad picker (the game's centerpiece). FPL model:
//   • Squad = a FIXED 15 (2 GK, 5 DEF, 5 MID, 3 FWD). Players never get dropped.
//   • Each player is either STARTING (11) or BENCH (4). The pitch always shows
//     all slots; empty slots are tap-to-fill.
//   • Drag a bench player onto a starter (or vice-versa) to SWAP who starts,
//     as long as it keeps a valid formation (1 GK; 3–5 DEF; 2–5 MID; 1–3 FWD).
//   • Tap-to-swap fallback for mobile / no-drag.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Flag } from "@/components/Flag";
import { Jersey } from "@/components/Jersey";
import { BudgetBar } from "@/components/BudgetBar";
import {
  SQUAD_QUOTA,
  XI_SIZE,
  validateSquad,
  countByCountry,
  countByPosition,
  isValidFormation,
  canSwap,
  type Position,
  type SquadPlayer,
} from "@/lib/squad-rules";
import { countryCode } from "@/lib/countries";
import { saveSquad } from "./actions";

export interface PickerPlayer extends SquadPlayer {
  name: string;
}
interface SquadEntry extends PickerPlayer {
  isStarting: boolean;
}

const POS_NAME: Record<Position, string> = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
const POS_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];
const lastName = (n: string) => n.split(" ").slice(-1)[0];

// The starting XI begins as 4-3-3. The pitch shows however many starters are in
// each line (the implicit formation); empty starting slots fill up to this until
// a full XI exists, after which drags between pitch/bench change the shape.
const INITIAL_XI: Record<Position, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

// A pitch row is a position with its filled players + empty slots up to quota.
type PitchSlot = { position: Position; player: SquadEntry | null };

export function SquadPicker({
  pool,
  gameweekLabel,
  initialStarterIds,
  initialBenchIds,
  initialCaptainId,
}: {
  pool: PickerPlayer[];
  gameweekLabel: string;
  initialStarterIds: string[];
  initialBenchIds: string[];
  initialCaptainId: string | null;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);

  const [squad, setSquad] = useState<SquadEntry[]>(() => {
    const make = (id: string, isStarting: boolean): SquadEntry | null => {
      const p = byId.get(id);
      return p ? { ...p, isStarting } : null;
    };
    return [
      ...initialStarterIds.map((id) => make(id, true)),
      ...initialBenchIds.map((id) => make(id, false)),
    ].filter((e): e is SquadEntry => !!e);
  });
  const [captainId, setCaptainId] = useState<string | null>(initialCaptainId);
  // Which slot the picker is filling: a position + whether it's a pitch (starter)
  // slot or a bench slot. null = picker closed.
  const [pickerFor, setPickerFor] = useState<{ pos: Position; starter: boolean } | null>(null);
  const [selectedForSwap, setSelectedForSwap] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const validation = validateSquad(squad);
  const byPos = countByPosition(squad);
  const countryCounts = countByCountry(squad);
  const pickedIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad]);
  const starters = squad.filter((p) => p.isStarting);
  const bench = squad.filter((p) => !p.isStarting);
  const formationOk = starters.length === XI_SIZE && isValidFormation(starters);

  // ── squad mutations ──
  function addPlayer(p: PickerPlayer) {
    const asStarter = pickerFor?.starter ?? true;
    setSquad((prev) => [...prev, { ...p, isStarting: asStarter }]);
    setPickerFor(null);
  }
  function removePlayer(id: string) {
    setSquad((prev) => prev.filter((p) => p.id !== id));
    if (captainId === id) setCaptainId(null);
    if (selectedForSwap === id) setSelectedForSwap(null);
  }

  // Swap a starter and a bench player (the sub). Returns whether it happened.
  function trySwap(aId: string, bId: string): boolean {
    const a = squad.find((p) => p.id === aId);
    const b = squad.find((p) => p.id === bId);
    if (!a || !b || a.isStarting === b.isStarting) return false;
    const starter = a.isStarting ? a : b;
    const reserve = a.isStarting ? b : a;
    if (!canSwap(starters, starter, reserve)) {
      setMessage(`Can't sub a ${reserve.position} for a ${starter.position} — it would break the formation.`);
      return false;
    }
    setMessage(null);
    setSquad((prev) =>
      prev.map((p) =>
        p.id === starter.id ? { ...p, isStarting: false } : p.id === reserve.id ? { ...p, isStarting: true } : p,
      ),
    );
    return true;
  }

  // Tap-to-swap: tap a player, then tap one on the other side to swap.
  function handleTapSwap(id: string) {
    if (!selectedForSwap) {
      setSelectedForSwap(id);
      return;
    }
    if (selectedForSwap === id) {
      setSelectedForSwap(null);
      return;
    }
    trySwap(selectedForSwap, id);
    setSelectedForSwap(null);
  }

  async function handleSave() {
    setMessage(null);
    if (!formationOk) {
      setMessage("Your starting 11 isn't a valid formation yet.");
      return;
    }
    setSaving(true);
    try {
      const res = await saveSquad({
        starterIds: starters.map((p) => p.id),
        benchIds: bench.map((p) => p.id),
        captainId,
      });
      if (res.ok) {
        router.push("/team");
        router.refresh();
      } else {
        setMessage(res.error ?? "Could not save.");
      }
    } finally {
      setSaving(false);
    }
  }

  // ── pitch layout: exactly the 11 starting slots ──
  // Each line shows its starters; empty slots fill up to the 4-3-3 target (only
  // while the squad still has unbenched picks of that position to place). Once
  // 11 are picked the pitch is full; drags then reshape who starts.
  const pitchRows: Record<Position, PitchSlot[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const pos of POS_ORDER) {
    const startingHere = starters.filter((p) => p.position === pos);
    startingHere.forEach((p) => pitchRows[pos].push({ position: pos, player: p }));
    // Show empty starting slots up to the 4-3-3 target for this line, but only
    // as many as there are still-unfilled squad slots overall (don't over-show).
    const target = INITIAL_XI[pos];
    const emptyStarting = Math.max(0, target - startingHere.length);
    for (let i = 0; i < emptyStarting; i++) pitchRows[pos].push({ position: pos, player: null });
  }

  const canSave = validation.valid && formationOk && !saving;

  return (
    <div className="screen">
      <div className="screen-head head-row">
        <div>
          <h1>Pick Your Team</h1>
          <div className="sub">
            Build a 15-player squad within £100m. Max 3 per country. Drag a sub onto a starter to swap.
            {gameweekLabel ? ` · ${gameweekLabel}` : ""}
          </div>
        </div>
        <button className="btn btn-primary" disabled={!canSave} onClick={handleSave}>
          <Icon name="check" size={17} />
          {saving ? "Saving…" : "Save Team"}
        </button>
      </div>

      <BudgetBar spent={validation.spent} count={validation.total} />

      {validation.errors.map((e, i) => (
        <div className="valid-msgs" style={{ marginTop: i === 0 ? 12 : 8 }} key={i}>
          <div className="vmsg err">
            <span className="ic"><Icon name="info" size={16} /></span>
            {e.message}
          </div>
        </div>
      ))}
      {validation.valid && !formationOk && (
        <div className="valid-msgs" style={{ marginTop: 12 }}>
          <div className="vmsg err">
            <span className="ic"><Icon name="info" size={16} /></span>
            Your starting 11 isn&apos;t a valid formation. Swap players between the pitch and bench.
          </div>
        </div>
      )}
      {validation.valid && formationOk && (
        <div className="valid-msgs" style={{ marginTop: 12 }}>
          <div className="vmsg ok">
            <span className="ic"><Icon name="check" size={16} /></span>
            Squad valid{captainId ? ", captain set" : " (set a captain below)"}. Ready to save.
          </div>
        </div>
      )}
      {message && (
        <div className="valid-msgs" style={{ marginTop: 12 }}>
          <div className="vmsg err">
            <span className="ic"><Icon name="info" size={16} /></span>
            {message}
          </div>
        </div>
      )}

      <div className="two-col" style={{ marginTop: 16 }}>
        <div>
          <div className="pitch-wrap">
            <Pitch
              rows={pitchRows}
              captainId={captainId}
              selectedId={selectedForSwap}
              onEmpty={(pos) => setPickerFor({ pos, starter: true })}
              onTapPlayer={handleTapSwap}
              onRemove={removePlayer}
              onSwap={trySwap}
            />
            <BenchRow
              bench={bench}
              selectedId={selectedForSwap}
              onTapPlayer={handleTapSwap}
              onRemove={removePlayer}
              onSwap={trySwap}
              onAdd={(pos) => setPickerFor({ pos, starter: false })}
              byPos={byPos}
            />
          </div>
        </div>

        <div className="pick-aside">
          <SquadSummary
            squad={squad}
            captainId={captainId}
            countryCounts={countryCounts}
            onSetCaptain={setCaptainId}
          />
        </div>
      </div>

      {pickerFor && (
        <PickerModal
          position={pickerFor.pos}
          pool={pool}
          pickedIds={pickedIds}
          countryCounts={countryCounts}
          remaining={validation.remaining}
          quotaLeft={SQUAD_QUOTA[pickerFor.pos] - byPos[pickerFor.pos]}
          onPick={addPlayer}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}

// ───────────────────────── pitch (all 15 slots) ─────────────────────────

function PlayerToken({
  entry,
  isCaptain,
  selected,
  onTap,
  onRemove,
  onDropSwap,
}: {
  entry: SquadEntry;
  isCaptain: boolean;
  selected: boolean;
  onTap: () => void;
  onRemove: () => void;
  onDropSwap: (draggedId: string) => void;
}) {
  return (
    <div
      className={"slot" + (selected ? " slot-selected" : "")}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", entry.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const dragged = e.dataTransfer.getData("text/plain");
        if (dragged && dragged !== entry.id) onDropSwap(dragged);
      }}
      onClick={onTap}
      role="button"
    >
      {isCaptain && <span className="cap-badge">C</span>}
      <button
        className="slot-x"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove from squad"
      >
        <Icon name="close" size={12} />
      </button>
      <div className="slot-jersey"><Jersey country={entry.country} size={46} /></div>
      <div className="slot-flag"><Flag country={entry.country} size={13} round /></div>
      <div className="slot-name">{lastName(entry.name)}</div>
      <div className="slot-price num">£{(entry.price / 10).toFixed(1)}</div>
    </div>
  );
}

function Pitch({
  rows,
  captainId,
  selectedId,
  onEmpty,
  onTapPlayer,
  onRemove,
  onSwap,
}: {
  rows: Record<Position, PitchSlot[]>;
  captainId: string | null;
  selectedId: string | null;
  onEmpty: (pos: Position) => void;
  onTapPlayer: (id: string) => void;
  onRemove: (id: string) => void;
  onSwap: (aId: string, bId: string) => boolean;
}) {
  return (
    <div className="pitch">
      <PitchBg />
      <div className="pitch-rows">
        {POS_ORDER.map((pos) => (
          <div key={pos} className="pitch-row">
            {rows[pos].map((slot, i) =>
              slot.player ? (
                <PlayerToken
                  key={slot.player.id}
                  entry={slot.player}
                  isCaptain={slot.player.id === captainId}
                  selected={slot.player.id === selectedId}
                  onTap={() => onTapPlayer(slot.player!.id)}
                  onRemove={() => onRemove(slot.player!.id)}
                  onDropSwap={(draggedId) => onSwap(draggedId, slot.player!.id)}
                />
              ) : (
                <button key={pos + i} className="slot slot-empty" onClick={() => onEmpty(pos)}>
                  <span className="slot-plus"><Icon name="plus" size={22} stroke={2} /></span>
                  <span className={"slot-pos pos pos-" + pos}>{pos}</span>
                </button>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PitchBg() {
  return (
    <svg className="pitch-lines" viewBox="0 0 300 380" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <rect x={6} y={6} width={288} height={368} rx={6} fill="none" stroke="var(--pitch-line)" strokeWidth={1.5} />
      <line x1={6} y1={190} x2={294} y2={190} stroke="var(--pitch-line)" strokeWidth={1.2} />
      <circle cx={150} cy={190} r={42} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
      <circle cx={150} cy={190} r={2.5} fill="var(--pitch-line)" />
      <rect x={95} y={6} width={110} height={46} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
      <rect x={95} y={328} width={110} height={46} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
    </svg>
  );
}

// ───────────────────────── bench row ─────────────────────────

function BenchRow({
  bench,
  selectedId,
  onTapPlayer,
  onRemove,
  onSwap,
  onAdd,
  byPos,
}: {
  bench: SquadEntry[];
  selectedId: string | null;
  onTapPlayer: (id: string) => void;
  onRemove: (id: string) => void;
  onSwap: (aId: string, bId: string) => boolean;
  onAdd: (pos: Position) => void;
  byPos: Record<Position, number>;
}) {
  // Show 4 bench slots; empties prompt to add the position the squad still needs.
  const missing: Position[] = [];
  for (const pos of POS_ORDER) {
    const short = SQUAD_QUOTA[pos] - byPos[pos];
    for (let i = 0; i < short; i++) missing.push(pos);
  }
  const emptyCount = Math.max(0, 4 - bench.length);
  const emptyPositions = missing.slice(0, emptyCount);

  return (
    <div className="bench">
      <div className="bench-label">Substitutes — drag onto a starter to swap</div>
      <div className="bench-row">
        {bench.map((p) => (
          <div
            key={p.id}
            className={"bench-slot" + (p.id === selectedId ? " slot-selected" : "")}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dragged = e.dataTransfer.getData("text/plain");
              if (dragged && dragged !== p.id) onSwap(dragged, p.id);
            }}
            onClick={() => onTapPlayer(p.id)}
            role="button"
          >
            <button className="slot-x" onClick={(e) => { e.stopPropagation(); onRemove(p.id); }} title="Remove">
              <Icon name="close" size={11} />
            </button>
            <span className={"bench-pos pos pos-" + p.position}>{p.position}</span>
            <Jersey country={p.country} size={32} />
            <span className="bench-name">{lastName(p.name)}</span>
            <span className="bench-price num">£{(p.price / 10).toFixed(1)}</span>
          </div>
        ))}
        {emptyPositions.map((pos, i) => (
          <button key={"be" + i} className="bench-slot empty" onClick={() => onAdd(pos)}>
            <span className={"bench-pos pos pos-" + pos}>{pos}</span>
            <span className="bench-plus"><Icon name="plus" size={18} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── summary aside ─────────────────────────

function SquadSummary({
  squad,
  captainId,
  countryCounts,
  onSetCaptain,
}: {
  squad: SquadEntry[];
  captainId: string | null;
  countryCounts: Record<string, number>;
  onSetCaptain: (id: string) => void;
}) {
  const captain = squad.find((p) => p.id === captainId) ?? null;
  const entries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="sum-row">
        <span className="muted">Captain</span>
        {captain ? (
          <span className="sum-cap">
            <Flag country={captain.country} size={14} round />
            <b>{lastName(captain.name)}</b>
            <span className="pill pill-gold">×2</span>
          </span>
        ) : (
          <span className="dim">Not set</span>
        )}
      </div>
      <div className="sum-divider" />
      <div className="sum-title">Set captain</div>
      <p className="sum-hint" style={{ marginTop: 6 }}>Captain scores double:</p>
      <div className="quota" style={{ marginTop: 8 }}>
        {squad.length === 0 ? (
          <span className="dim" style={{ fontSize: 13 }}>No players yet</span>
        ) : (
          squad.map((p) => (
            <button key={p.id} className={"quota-item" + (captainId === p.id ? " full" : "")} onClick={() => onSetCaptain(p.id)}>
              <Flag country={p.country} size={15} round />
              <span className="qn">{lastName(p.name)}</span>
            </button>
          ))
        )}
      </div>
      <div className="sum-divider" />
      <div className="sum-title">Country quota</div>
      <div className="quota">
        {entries.length ? (
          entries.map(([c, n]) => (
            <div key={c} className={"quota-item" + (n >= 3 ? " full" : "")}>
              <Flag country={c} size={15} round />
              <span className="qc">{countryCode(c)}</span>
              <span className={"qn num" + (n > 3 ? " over" : "")}>{n}/3</span>
            </div>
          ))
        ) : (
          <span className="dim" style={{ fontSize: 13 }}>No players yet</span>
        )}
      </div>
      <p className="sum-hint">Tap a slot to add. Tap a player then tap another to swap (or drag).</p>
    </div>
  );
}

// ───────────────────────── picker modal + filters ─────────────────────────

type SortKey = "price-desc" | "price-asc" | "name";

function PickerModal({
  position,
  pool,
  pickedIds,
  countryCounts,
  remaining,
  quotaLeft,
  onPick,
  onClose,
}: {
  position: Position;
  pool: PickerPlayer[];
  pickedIds: Set<string>;
  countryCounts: Record<string, number>;
  remaining: number;
  quotaLeft: number;
  onPick: (p: PickerPlayer) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<number>(150); // tenths → 15.0M
  const [sort, setSort] = useState<SortKey>("price-desc");
  const [affordableOnly, setAffordableOnly] = useState(false);

  // Countries available for this position (for the dropdown).
  const countries = useMemo(
    () => Array.from(new Set(pool.filter((p) => p.position === position).map((p) => p.country))).sort(),
    [pool, position],
  );

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = pool.filter((p) => p.position === position);
    if (term) list = list.filter((p) => p.name.toLowerCase().includes(term) || p.country.toLowerCase().includes(term));
    if (country) list = list.filter((p) => p.country === country);
    list = list.filter((p) => p.price <= maxPrice);
    if (affordableOnly) list = list.filter((p) => pickedIds.has(p.id) || p.price <= remaining);
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "price-asc") return a.price - b.price;
      return b.price - a.price;
    });
    return list.slice(0, 200);
  }, [pool, position, search, country, maxPrice, sort, affordableOnly, pickedIds, remaining]);

  return (
    <div className="modal-overlay side" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-side" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Pick {POS_NAME[position]}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={20} /></button>
        </div>
        <div className="picker">
          <div className="picker-bar">
            <span className="pill pill-blue">£{(remaining / 10).toFixed(1)}m to spend</span>
            <span className="muted" style={{ fontSize: 13 }}>{quotaLeft} {position} slot{quotaLeft === 1 ? "" : "s"} left</span>
          </div>

          <div className="picker-filters">
            <input
              className="fld"
              placeholder="Search player or country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="filter-row">
              <select className="fld fld-sm" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c.replace(/-/g, " ")}</option>
                ))}
              </select>
              <select className="fld fld-sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="price-desc">Price ↓</option>
                <option value="price-asc">Price ↑</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
            <div className="filter-row">
              <label className="filter-price">
                Max £{(maxPrice / 10).toFixed(1)}m
                <input
                  type="range"
                  min={40}
                  max={150}
                  step={5}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
              </label>
              <label className="filter-toggle">
                <input type="checkbox" checked={affordableOnly} onChange={(e) => setAffordableOnly(e.target.checked)} />
                Affordable only
              </label>
            </div>
          </div>

          <div className="picker-list">
            {candidates.length === 0 ? (
              <div className="picker-empty">No players match your filters.</div>
            ) : (
              candidates.map((p) => {
                const already = pickedIds.has(p.id);
                const countryFull = !already && (countryCounts[p.country] ?? 0) >= 3;
                const tooPricey = !already && p.price > remaining;
                const disabled = already || countryFull;
                return (
                  <button
                    key={p.id}
                    className={"prow" + (disabled ? " disabled" : "")}
                    disabled={disabled}
                    onClick={() => !disabled && onPick(p)}
                  >
                    <span className="prow-flag"><Jersey country={p.country} size={30} /></span>
                    <span className="prow-id">
                      <span className="prow-name">{p.name}</span>
                      <span className="prow-meta">
                        <span className={"pos pos-" + p.position}>{p.position}</span>
                        <Flag country={p.country} size={13} round />
                        <span className="muted">{p.country.replace(/-/g, " ")}</span>
                      </span>
                    </span>
                    <span className="prow-num">
                      <span className="prow-price num">£{(p.price / 10).toFixed(1)}</span>
                      {already && <span className="prow-sub">In squad</span>}
                      {countryFull && <span className="prow-sub" style={{ color: "var(--live)" }}>Max 3</span>}
                      {tooPricey && !disabled && <span className="prow-sub" style={{ color: "var(--gold)" }}>Over budget</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
