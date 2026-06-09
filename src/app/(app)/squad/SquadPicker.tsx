"use client";

// Interactive squad picker (the game's centerpiece). FPL model:
//   • Squad = a FIXED 15 (2 GK, 5 DEF, 5 MID, 3 FWD). Players never get dropped.
//   • Each player is either STARTING (11) or BENCH (4). The pitch always shows
//     all slots; empty slots are tap-to-fill.
//   • Drag a bench player onto a starter (or vice-versa) to SWAP who starts,
//     as long as it keeps a valid formation (1 GK; 3–5 DEF; 2–5 MID; 1–3 FWD).
//   • Tap-to-swap fallback for mobile / no-drag.
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Flag } from "@/components/Flag";
import { Jersey } from "@/components/Jersey";
import { BudgetBar } from "@/components/BudgetBar";
import { MiniStore } from "@/components/MiniStore";
import { PlayerProfileModal } from "@/components/PlayerProfileModal";
import type { PerkLike } from "@/lib/store";
import {
  SQUAD_QUOTA,
  XI_SIZE,
  FORMATIONS,
  validateSquad,
  countByCountry,
  countByPosition,
  formationName,
  canSwap,
  canFieldFormation,
  splitStartingXI,
  type Position,
  type SquadPlayer,
} from "@/lib/squad-rules";
import { countryCode } from "@/lib/countries";
import { saveSquad } from "./actions";
import { toggleFavourite } from "../players/actions";

export interface PickerPlayer extends SquadPlayer {
  name: string;
}
interface SquadEntry extends PickerPlayer {
  isStarting: boolean;
}

const POS_NAME: Record<Position, string> = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
const POS_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];
const lastName = (n: string) => n.split(" ").slice(-1)[0];

const DEFAULT_FORMATION = "4-3-3";

// A pitch row is a position with its filled players + empty slots up to quota.
type PitchSlot = { position: Position; player: SquadEntry | null };

export function SquadPicker({
  pool,
  gameweekLabel,
  initialStarterIds,
  initialBenchIds,
  initialCaptainId,
  initialViceId,
  maxPerCountry = 3,
  balance = 1000,
  budgetBonus = 0,
  ownedPerks = [],
  isGroupStage = true,
  lockRoster = false,
  initialFavouriteIds = [],
}: {
  pool: PickerPlayer[];
  gameweekLabel: string;
  initialStarterIds: string[];
  initialBenchIds: string[];
  initialCaptainId: string | null;
  initialViceId: string | null;
  maxPerCountry?: number;
  balance?: number;
  budgetBonus?: number;
  ownedPerks?: PerkLike[];
  isGroupStage?: boolean;
  // When true the 15 are LOCKED — only XI reorder + captain/vice are editable
  // (the 15 change only via /transfers). False only on the first-ever pick.
  lockRoster?: boolean;
  initialFavouriteIds?: string[];
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);

  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(
    () => new Set(initialFavouriteIds),
  );

  function toggleFavouriteLocal(id: string) {
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toggleFavourite(id).catch(() => {
      setFavouriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    });
  }

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
  const [viceId, setViceId] = useState<string | null>(initialViceId);
  // Which slot the picker is filling: a position + whether it's a pitch (starter)
  // slot or a bench slot. null = picker closed.
  const [pickerFor, setPickerFor] = useState<{ pos: Position; starter: boolean } | null>(null);
  // A player tapped on the pitch/bench → its action menu is open.
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  // A player whose full profile modal is open (from menu or picker identity zone).
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectedFormation, setSelectedFormation] = useState(
    () => formationName(squad.filter((p) => p.isStarting)) ?? DEFAULT_FORMATION,
  );

  function applyFormation(f: string) {
    const split = splitStartingXI(squad, f);
    if (!split) return;
    const starterSet = new Set(split.starters.map((p) => p.id));
    setSquad((prev) => prev.map((p) => ({ ...p, isStarting: starterSet.has(p.id) })));
    setSelectedFormation(f);
  }

  // True between dragstart and the click it synthesizes, so tap-after-drag is ignored.
  const draggedRef = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDraggingId(id);
  const onDragEnd   = () => { setDraggingId(null); setDragOverId(null); };
  const onDragEnter = (id: string) => setDragOverId(id);
  const onDragLeave = () => setDragOverId(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);


  const validation = validateSquad(squad, { maxPerCountry, budgetBonus });
  const byPos = countByPosition(squad);
  const countryCounts = countByCountry(squad);
  const pickedIds = useMemo(() => new Set(squad.map((p) => p.id)), [squad]);
  const starters = squad.filter((p) => p.isStarting);
  const bench = squad.filter((p) => !p.isStarting);
  // Live formation: the named shape the starting XI is in (e.g. "4-3-3"). null
  // until 11 are picked AND they form one of the allowable formations.
  const currentFormation = formationName(starters);
  const starterCounts = countByPosition(starters);
  const shapeStr = `${starterCounts.DEF}-${starterCounts.MID}-${starterCounts.FWD}`;
  const formationOk = currentFormation !== null;

  // ── squad mutations ──
  function addPlayer(p: PickerPlayer) {
    // Hard guard: never exceed the squad quota for a position (2 GK/5 DEF/5 MID/3 FWD).
    if (byPos[p.position] >= SQUAD_QUOTA[p.position]) {
      setMessage(`You already have ${SQUAD_QUOTA[p.position]} ${p.position} — remove one first.`);
      setPickerFor(null);
      return;
    }
    const asStarter = pickerFor?.starter ?? true;
    setSquad((prev) => [...prev, { ...p, isStarting: asStarter }]);
    setPickerFor(null);
  }
  function removePlayer(id: string) {
    setSquad((prev) => prev.filter((p) => p.id !== id));
    if (captainId === id) setCaptainId(null);
    if (viceId === id) setViceId(null);
  }

  // Swap a starter and a bench player (the sub). Returns whether it happened.
  function trySwap(aId: string, bId: string): boolean {
    const a = squad.find((p) => p.id === aId);
    const b = squad.find((p) => p.id === bId);
    if (!a || !b || a.isStarting === b.isStarting) return false;
    const starter = a.isStarting ? a : b;
    const reserve = a.isStarting ? b : a;
    if (!canSwap(starters, starter, reserve)) {
      setMessage(`Can't sub a ${reserve.position} for a ${starter.position} — use the formation buttons above to switch shape.`);
      return false;
    }
    setMessage(null);
    // If the captain/vice gets benched by this swap, clear that role.
    if (captainId === starter.id) setCaptainId(null);
    if (viceId === starter.id) setViceId(null);
    setSquad((prev) =>
      prev.map((p) =>
        p.id === starter.id ? { ...p, isStarting: false } : p.id === reserve.id ? { ...p, isStarting: true } : p,
      ),
    );
    return true;
  }

  // Tapping a pitch/bench token opens its action menu — UNLESS the tap is the
  // synthetic click that follows a drag (draggedRef set in onDragStart). Drag
  // still swaps directly; a genuine tap opens the menu (profile lives there).
  function handleTokenTap(id: string) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    setActionMenuId(id);
  }

  // Auto-substitute: swap a benched player into the XI for the first valid
  // same-or-compatible starter (used by the menu's "Substitute" item).
  function autoSubstitute(id: string) {
    const p = squad.find((x) => x.id === id);
    if (!p) return;
    if (p.isStarting) {
      // starter → find a bench player that can take its place
      const target = bench.find((b) => canSwap(starters, p, b));
      if (target) trySwap(p.id, target.id);
      else setMessage("No valid substitute on the bench for that player.");
    } else {
      // bench → find a starter it can replace
      const target = starters.find((s) => canSwap(starters, s, p));
      if (target) trySwap(p.id, target.id);
      else setMessage("That sub can't replace any starter without breaking the formation.");
    }
  }

  async function handleSave() {
    setMessage(null);
    if (!formationOk) {
      setMessage("Your starting 11 isn't a valid formation yet.");
      return;
    }
    if (!captainId || !viceId) {
      setMessage("You must pick a captain and a vice-captain first — tap a starting player → Make Captain / Make Vice-captain.");
      return;
    }
    setSaving(true);
    try {
      const res = await saveSquad({
        starterIds: starters.map((p) => p.id),
        benchIds: bench.map((p) => p.id),
        captainId,
        viceId,
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

  // ── pitch layout: the 11 starting slots ──
  // Each line shows its current starters. Empty slots only appear WHILE BUILDING
  // (fewer than 11 starters) to guide filling toward a 4-3-3 — and only as many
  // as keep the total starting slots at 11. Once 11 start, the pitch is full and
  // there are NO empty slots; the formation is whatever the starters form, and
  // drags reshape it (so a 4-4-2 shows exactly 2 FWD slots, no phantom 3rd).
  const buildingXI = starters.length < XI_SIZE;
  const pitchRows: Record<Position, PitchSlot[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  let emptyBudget = XI_SIZE - starters.length; // total empty starting slots to show
  for (const pos of POS_ORDER) {
    const startingHere = starters.filter((p) => p.position === pos);
    startingHere.forEach((p) => pitchRows[pos].push({ position: pos, player: p }));
    if (buildingXI) {
      // Want up to the 4-3-3 target for this line, but never more than:
      //   • the remaining empty budget (pitch ≤ 11 slots total), AND
      //   • the SQUAD QUOTA for this position (2/5/5/3) minus everyone of that
      //     position already in the 15 — so you can't add a 4th FWD, etc.
      const quotaRoom = Math.max(0, SQUAD_QUOTA[pos] - byPos[pos]);
      const want = Math.max(0, (FORMATIONS[selectedFormation]?.[pos] ?? 0) - startingHere.length);
      const show = Math.min(want, emptyBudget, quotaRoom);
      for (let i = 0; i < show; i++) pitchRows[pos].push({ position: pos, player: null });
      emptyBudget -= show;
    }
  }


  return (
    <div className="screen">
      <div className="screen-head head-row">
        <div>
          <h1>{lockRoster ? "Edit Your Team" : "Pick Your Team"}</h1>
          <div className="sub">
            {lockRoster
              ? "Your 15 are locked — set your starting XI, captain & vice. Change players in Transfers."
              : "Build a 15-player squad within £100m. Max 3 per country. Drag a sub onto a starter to swap."}
            {gameweekLabel ? ` · ${gameweekLabel}` : ""}
          </div>
        </div>
        {/* Green + clickable once the squad/formation are valid — clicking
            without a captain & vice shows a message rather than silently failing. */}
        <button
          className="btn btn-primary"
          disabled={!validation.valid || !formationOk || saving}
          onClick={handleSave}
        >
          <Icon name="check" size={17} />
          {saving ? "Saving…" : "Save Team"}
        </button>
      </div>

      <BudgetBar spent={validation.spent} count={validation.total} bonusBudget={budgetBonus} />

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
            Your starting 11 isn&apos;t an allowed formation. Swap players between the pitch and bench.
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
          <div className="pitch-toolbar">
            <span className="pt-label">Formation</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {Object.keys(FORMATIONS).map((f) => {
                const active = currentFormation === f;
                const canField = canFieldFormation(squad, f);
                return (
                  <button
                    key={f}
                    onClick={() => canField && applyFormation(f)}
                    disabled={!canField}
                    className={"pill" + (active ? " pill-accent" : "")}
                    style={{
                      opacity: canField ? 1 : 0.35,
                      cursor: canField ? "pointer" : "not-allowed",
                      fontVariantNumeric: "tabular-nums",
                    }}
                    title={canField ? `Switch to ${f}` : `Not enough players to field ${f}`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
            {!currentFormation && starters.length === XI_SIZE && (
              <span style={{ fontSize: 12, color: "var(--live)", width: "100%" }}>
                Not a valid formation — drag to fix or pick one above
              </span>
            )}
          </div>
          {lockRoster && (
            <div
              className="vmsg"
              style={{
                marginBottom: 10,
                background: "rgba(255,197,61,0.08)",
                border: "1px solid rgba(255,197,61,0.25)",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 12,
                color: "var(--gold)",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Icon name="info" size={15} />
              Your 15 are locked — change your starting XI, captain &amp; vice. Swap players in Transfers.
            </div>
          )}
          <div className="pitch-wrap">
            <Pitch
              rows={pitchRows}
              captainId={captainId}
              viceId={viceId}
              onEmpty={(pos) => { if (!lockRoster) setPickerFor({ pos, starter: true }); }}
              onTapPlayer={handleTokenTap}
              onSwap={trySwap}
              draggedRef={draggedRef}
              draggingId={draggingId}
              dragOverId={dragOverId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
            />
            <BenchRow
              bench={bench}
              captainId={captainId}
              viceId={viceId}
              onTapPlayer={handleTokenTap}
              onSwap={trySwap}
              onAdd={(pos) => { if (!lockRoster) setPickerFor({ pos, starter: false }); }}
              byPos={byPos}
              draggedRef={draggedRef}
              draggingId={draggingId}
              dragOverId={dragOverId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
            />
          </div>
        </div>

        <div className="pick-aside">
          <SquadSummary
            squad={squad}
            captainId={captainId}
            viceId={viceId}
            countryCounts={countryCounts}
            maxPerCountry={maxPerCountry}
          />
          <MiniStore
            balance={balance}
            ownedPerks={ownedPerks}
            isGroupStage={isGroupStage}
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
          maxPerCountry={maxPerCountry}
          onPick={addPlayer}
          onProfile={(id) => setProfileId(id)}
          onClose={() => setPickerFor(null)}
          favouriteIds={favouriteIds}
          onFavouriteToggle={toggleFavouriteLocal}
        />
      )}

      {/* Action menu for a tapped pitch/bench player. */}
      {actionMenuId && (() => {
        const p = squad.find((x) => x.id === actionMenuId);
        if (!p) return null;
        const close = () => setActionMenuId(null);
        return (
          <PlayerActionMenu
            player={p}
            isCaptain={captainId === p.id}
            isVice={viceId === p.id}
            canRemove={!lockRoster}
            onViewProfile={() => { setProfileId(p.id); close(); }}
            onCaptain={() => { setCaptainId(p.id); if (viceId === p.id) setViceId(null); close(); }}
            onVice={() => { setViceId(p.id); if (captainId === p.id) setCaptainId(null); close(); }}
            onSubstitute={() => { autoSubstitute(p.id); close(); }}
            onRemove={() => { removePlayer(p.id); close(); }}
            onClose={close}
          />
        );
      })()}

      {/* Full profile modal (from the action menu or the picker identity zone). */}
      {profileId && (
        <PlayerProfileModal playerId={profileId} onClose={() => setProfileId(null)} />
      )}
    </div>
  );
}

// ───────────────────────── player action menu ─────────────────────────

function PlayerActionMenu({
  player,
  isCaptain,
  isVice,
  canRemove,
  onViewProfile,
  onCaptain,
  onVice,
  onSubstitute,
  onRemove,
  onClose,
}: {
  player: SquadEntry;
  isCaptain: boolean;
  isVice: boolean;
  canRemove: boolean;
  onViewProfile: () => void;
  onCaptain: () => void;
  onVice: () => void;
  onSubstitute: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const Item = ({ icon, label, onClick, tone }: { icon: string; label: string; onClick: () => void; tone?: string }) => (
    <button className={"act-item" + (tone ? " tone-" + tone : "")} onClick={onClick}>
      <Icon name={icon} size={19} />
      <span>{label}</span>
    </button>
  );
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ animation: "popIn .2s ease", maxWidth: 420 }}>
        <div className="act-head">
          <div className="act-jersey"><Jersey country={player.country} size={54} /></div>
          <div>
            <div className="act-name">{player.name}</div>
            <div className="act-meta">
              <span className={"pos pos-" + player.position}>{player.position}</span>
              <Flag country={player.country} size={13} round />
              <span className="muted">{player.country.replace(/-/g, " ")}</span>
              <span className="muted dim">£{(player.price / 10).toFixed(1)}m</span>
            </div>
          </div>
        </div>
        <div className="act-list">
          <Item icon="eye" label="View full profile" onClick={onViewProfile} />
          <Item icon="star" label={isCaptain ? "Captain (×2) — selected" : "Make Captain (×2)"} onClick={onCaptain} />
          <Item icon="user" label={isVice ? "Vice-captain — selected" : "Make Vice-captain"} onClick={onVice} />
          <Item icon="swap" label="Substitute" onClick={onSubstitute} />
          {canRemove && (
            <Item icon="swap" label="Remove from squad" onClick={onRemove} tone="live" />
          )}
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <button className="btn btn-ghost btn-block" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── pitch (all 15 slots) ─────────────────────────

function PlayerToken({
  entry,
  isCaptain,
  isVice,
  onTap,
  onDropSwap,
  draggedRef,
  isDragging,
  isDragOver,
  onDragStarted,
  onDragEnded,
  onDragEntered,
  onDragLeft,
}: {
  entry: SquadEntry;
  isCaptain: boolean;
  isVice: boolean;
  onTap: () => void;
  onDropSwap: (draggedId: string) => void;
  draggedRef: React.MutableRefObject<boolean>;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStarted: () => void;
  onDragEnded: () => void;
  onDragEntered: () => void;
  onDragLeft: () => void;
}) {
  return (
    <div
      className="slot"
      draggable
      style={{
        opacity: isDragging ? 0.32 : 1,
        transition: "opacity .12s, transform .15s",
        cursor: isDragging ? "grabbing" : "grab",
        ...(isDragOver && {
          outline: "2px solid var(--accent)",
          outlineOffset: "3px",
          borderRadius: 12,
          boxShadow: "0 0 0 5px rgba(24,224,138,0.18), 0 8px 24px rgba(0,0,0,0.35)",
          transform: "scale(1.07) translateY(-3px)",
        }),
      }}
      onDragStart={(e) => {
        draggedRef.current = true;
        e.dataTransfer.setData("text/plain", entry.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStarted();
      }}
      onDragEnd={onDragEnded}
      onDragEnter={(e) => { e.preventDefault(); onDragEntered(); }}
      onDragLeave={(e) => {
        if (!(e.currentTarget as Node).contains(e.relatedTarget as Node)) onDragLeft();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnded();
        const dragged = e.dataTransfer.getData("text/plain");
        if (dragged && dragged !== entry.id) onDropSwap(dragged);
      }}
      onClick={onTap}
      role="button"
      title={`${entry.name} — tap for options`}
    >
      {isCaptain && <span className="cap-badge">C</span>}
      {isVice && !isCaptain && <span className="cap-badge vice">V</span>}
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
  viceId,
  onEmpty,
  onTapPlayer,
  onSwap,
  draggedRef,
  draggingId,
  dragOverId,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
}: {
  rows: Record<Position, PitchSlot[]>;
  captainId: string | null;
  viceId: string | null;
  onEmpty: (pos: Position) => void;
  onTapPlayer: (id: string) => void;
  onSwap: (aId: string, bId: string) => boolean;
  draggedRef: React.MutableRefObject<boolean>;
  draggingId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragEnter: (id: string) => void;
  onDragLeave: () => void;
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
                  isVice={slot.player.id === viceId}
                  onTap={() => onTapPlayer(slot.player!.id)}
                  onDropSwap={(draggedId) => onSwap(draggedId, slot.player!.id)}
                  draggedRef={draggedRef}
                  isDragging={draggingId === slot.player.id}
                  isDragOver={dragOverId === slot.player.id}
                  onDragStarted={() => onDragStart(slot.player!.id)}
                  onDragEnded={onDragEnd}
                  onDragEntered={() => onDragEnter(slot.player!.id)}
                  onDragLeft={onDragLeave}
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
  captainId,
  viceId,
  onTapPlayer,
  onSwap,
  onAdd,
  byPos,
  draggedRef,
  draggingId,
  dragOverId,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
}: {
  bench: SquadEntry[];
  captainId: string | null;
  viceId: string | null;
  onTapPlayer: (id: string) => void;
  onSwap: (aId: string, bId: string) => boolean;
  onAdd: (pos: Position) => void;
  byPos: Record<Position, number>;
  draggedRef: React.MutableRefObject<boolean>;
  draggingId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragEnter: (id: string) => void;
  onDragLeave: () => void;
}) {
  const missing: Position[] = [];
  for (const pos of POS_ORDER) {
    const short = SQUAD_QUOTA[pos] - byPos[pos];
    for (let i = 0; i < short; i++) missing.push(pos);
  }
  const emptyCount = Math.max(0, 4 - bench.length);
  const emptyPositions = missing.slice(0, emptyCount);

  return (
    <div className="bench">
      <div className="bench-label">Substitutes — drag onto a starter to swap, or tap for options</div>
      <div className="bench-row">
        {bench.map((p) => {
          const isDragging = draggingId === p.id;
          const isDragOver = dragOverId === p.id;
          return (
            <div
              key={p.id}
              className="bench-slot"
              draggable
              style={{
                opacity: isDragging ? 0.32 : 1,
                transition: "opacity .12s, transform .15s, box-shadow .15s",
                cursor: isDragging ? "grabbing" : "grab",
                ...(isDragOver && {
                  outline: "2px solid var(--accent)",
                  outlineOffset: "3px",
                  boxShadow: "0 0 0 5px rgba(24,224,138,0.18), 0 8px 20px rgba(0,0,0,0.3)",
                  transform: "scale(1.05)",
                  background: "var(--surface-3)",
                }),
              }}
              onDragStart={(e) => {
                draggedRef.current = true;
                e.dataTransfer.setData("text/plain", p.id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart(p.id);
              }}
              onDragEnd={onDragEnd}
              onDragEnter={(e) => { e.preventDefault(); onDragEnter(p.id); }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as Node).contains(e.relatedTarget as Node)) onDragLeave();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onDragEnd();
                const dragged = e.dataTransfer.getData("text/plain");
                if (dragged && dragged !== p.id) onSwap(dragged, p.id);
              }}
              onClick={() => onTapPlayer(p.id)}
              role="button"
              title={`${p.name} — tap for options`}
            >
              {p.id === captainId && <span className="cap-badge">C</span>}
              {p.id === viceId && p.id !== captainId && <span className="cap-badge vice">V</span>}
              <span className={"bench-pos pos pos-" + p.position}>{p.position}</span>
              <Jersey country={p.country} size={32} />
              <span className="bench-name">{lastName(p.name)}</span>
              <span className="bench-price num">£{(p.price / 10).toFixed(1)}</span>
            </div>
          );
        })}
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
  viceId,
  countryCounts,
  maxPerCountry,
}: {
  squad: SquadEntry[];
  captainId: string | null;
  viceId: string | null;
  countryCounts: Record<string, number>;
  maxPerCountry: number;
}) {
  const captain = squad.find((p) => p.id === captainId) ?? null;
  const vice = squad.find((p) => p.id === viceId) ?? null;
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
      <div className="sum-row">
        <span className="muted">Vice-captain</span>
        {vice ? (
          <span className="sum-cap">
            <Flag country={vice.country} size={14} round />
            <b>{lastName(vice.name)}</b>
          </span>
        ) : (
          <span className="dim">Not set</span>
        )}
      </div>
      <p className="sum-hint" style={{ marginTop: 6 }}>
        Tap a starting player → <b>Make Captain</b> / <b>Make Vice-captain</b>. Both required to save.
      </p>
      <div className="sum-divider" />
      <div className="sum-title">Country quota</div>
      <div className="quota">
        {entries.length ? (
          entries.map(([c, n]) => (
            <div key={c} className={"quota-item" + (n >= maxPerCountry ? " full" : "")}>
              <Flag country={c} size={15} round />
              <span className="qc">{countryCode(c)}</span>
              <span className={"qn num" + (n > maxPerCountry ? " over" : "")}>{n}/{maxPerCountry}</span>
            </div>
          ))
        ) : (
          <span className="dim" style={{ fontSize: 13 }}>No players yet</span>
        )}
      </div>
      <p className="sum-hint">Tap a slot to add. Tap a player for options (profile, captain, sub, remove). Drag a sub onto a starter to swap.</p>
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
  maxPerCountry,
  onPick,
  onProfile,
  onClose,
  favouriteIds,
  onFavouriteToggle,
}: {
  position: Position;
  pool: PickerPlayer[];
  pickedIds: Set<string>;
  countryCounts: Record<string, number>;
  remaining: number;
  quotaLeft: number;
  maxPerCountry: number;
  onPick: (p: PickerPlayer) => void;
  onProfile: (id: string) => void;
  onClose: () => void;
  favouriteIds: Set<string>;
  onFavouriteToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<number>(150); // tenths → 15.0M
  const [sort, setSort] = useState<SortKey>("price-desc");
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [favouriteOnly, setFavouriteOnly] = useState(false);

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
    if (favouriteOnly) list = list.filter((p) => favouriteIds.has(p.id));
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "price-asc") return a.price - b.price;
      return b.price - a.price;
    });
    return list.slice(0, 200);
  }, [pool, position, search, country, maxPrice, sort, affordableOnly, favouriteOnly, favouriteIds, pickedIds, remaining]);

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
              <label className="filter-toggle" style={{ color: favouriteOnly ? "#e11d48" : undefined }}>
                <input type="checkbox" checked={favouriteOnly} onChange={(e) => setFavouriteOnly(e.target.checked)} />
                ♥ Favourites only
              </label>
            </div>
          </div>

          <div className="picker-list">
            {candidates.length === 0 ? (
              <div className="picker-empty">No players match your filters.</div>
            ) : (
              candidates.map((p) => {
                const already = pickedIds.has(p.id);
                const countryFull = !already && (countryCounts[p.country] ?? 0) >= maxPerCountry;
                const tooPricey = !already && p.price > remaining;
                const addDisabled = already || countryFull;
                const reason = already ? "Already in squad" : countryFull ? `Max ${maxPerCountry} per country` : "";
                return (
                  <div key={p.id} className={"prow" + (already ? " picked" : "")}>
                    {/* identity zone — always tappable, opens the profile */}
                    <button
                      className="prow-id-btn"
                      onClick={() => onProfile(p.id)}
                      title={`View ${p.name}’s profile`}
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
                        {countryFull && <span className="prow-sub" style={{ color: "var(--live)" }}>Max {maxPerCountry}</span>}
                        {tooPricey && !addDisabled && <span className="prow-sub" style={{ color: "var(--gold)" }}>Over budget</span>}
                      </span>
                      <span className="prow-hint" aria-hidden><Icon name="eye" size={15} /></span>
                    </button>
                    {/* favourite toggle */}
                    <button
                      className="prow-fav"
                      onClick={() => onFavouriteToggle(p.id)}
                      title={favouriteIds.has(p.id) ? "Remove from favourites" : "Add to favourites"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0 6px",
                        fontSize: 16,
                        lineHeight: 1,
                        color: favouriteIds.has(p.id) ? "#e11d48" : "var(--text-3)",
                        flexShrink: 0,
                      }}
                    >
                      {favouriteIds.has(p.id) ? "♥" : "♡"}
                    </button>
                    {/* action zone — add to squad (disabled when ineligible) */}
                    <button
                      className={"prow-action" + (addDisabled ? " disabled" : "")}
                      disabled={addDisabled}
                      title={addDisabled ? reason : `Add ${p.name} to squad`}
                      onClick={() => !addDisabled && onPick(p)}
                    >
                      {already ? (
                        <span className="pill pill-accent"><Icon name="check" size={13} /> In</span>
                      ) : countryFull ? (
                        <Icon name="lock" size={16} style={{ color: "var(--text-3)" }} />
                      ) : (
                        <span className="add-btn"><Icon name="plus" size={18} /></span>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
