"use client";

// Interactive squad picker (the game's centerpiece). FPL model:
//   • Squad = a FIXED 15 (2 GK, 5 DEF, 5 MID, 3 FWD). Players never get dropped.
//   • Each player is either STARTING (11) or BENCH (4). The pitch always shows
//     all slots; empty slots are tap-to-fill.
//   • Drag a bench player onto a starter (or vice-versa) to SWAP who starts,
//     as long as it keeps a valid formation (1 GK; 3–5 DEF; 2–5 MID; 1–3 FWD).
//   • Tap-to-swap fallback for mobile / no-drag.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Flag } from "@/components/Flag";
import { Jersey } from "@/components/Jersey";
import { BudgetBar } from "@/components/BudgetBar";
import { MiniStore } from "@/components/MiniStore";
import { PlayerProfileModal } from "@/components/PlayerProfileModal";
import type { PerkLike } from "@/lib/store";
import { fmtPrice } from "@/lib/format";
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
import { buildTemplateSquad } from "@/lib/template-squad";
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
  initialCaptain2Id = null,
  hasExtraCaptain = false,
  maxPerCountry = 3,
  balance = 1000,
  budgetBonus = 0,
  ownedPerks = [],
  isGroupStage = true,
  lockRoster = false,
  transferMode = false,
  transfersUsed = 0,
  transferLimit = 3,
  initialFavouriteIds = [],
}: {
  pool: PickerPlayer[];
  gameweekLabel: string;
  initialStarterIds: string[];
  initialBenchIds: string[];
  initialCaptainId: string | null;
  initialViceId: string | null;
  initialCaptain2Id?: string | null; // second captain saved for this GW (if any)
  hasExtraCaptain?: boolean; // Extra Captain perk active → can assign a 2nd captain
  maxPerCountry?: number;
  balance?: number;
  budgetBonus?: number;
  ownedPerks?: PerkLike[];
  isGroupStage?: boolean;
  // When true the 15 are LOCKED — only XI reorder + captain/vice are editable.
  // False only on the first-ever pick. In transferMode the lock relaxes: players
  // can be swapped right here (each new player = one transfer, limited per round).
  lockRoster?: boolean;
  transferMode?: boolean;
  transfersUsed?: number; // transfers already saved this round
  transferLimit?: number; // 3 + unused Extra Transfer perks
  initialFavouriteIds?: string[];
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);

  const DRAFT_KEY = `gaffer:squad_draft:${gameweekLabel}`;

  // Read once on mount — seeds state below only when building from scratch (!lockRoster).
  const [restoredDraft] = useState<{
    starterIds: string[];
    benchIds: string[];
    captainId: string | null;
    viceId: string | null;
  } | null>(() => {
    if (lockRoster) return null;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d?.starterIds?.length > 0 ? d : null;
    } catch {
      return null;
    }
  });

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
    const starterIds = restoredDraft?.starterIds ?? initialStarterIds;
    const benchIds   = restoredDraft?.benchIds   ?? initialBenchIds;
    const make = (id: string, isStarting: boolean): SquadEntry | null => {
      const p = byId.get(id);
      return p ? { ...p, isStarting } : null;
    };
    return [
      ...starterIds.map((id) => make(id, true)),
      ...benchIds.map((id) => make(id, false)),
    ].filter((e): e is SquadEntry => !!e);
  });
  const [captainId, setCaptainId] = useState<string | null>(
    restoredDraft?.captainId ?? initialCaptainId,
  );
  const [viceId, setViceId] = useState<string | null>(
    restoredDraft?.viceId ?? initialViceId,
  );
  // Second captain (Extra Captain perk) — also scores ×2.
  const [captain2Id, setCaptain2Id] = useState<string | null>(initialCaptain2Id);
  // The roster can be edited on the first-ever pick, or in a knockout transfer
  // window (where every NEW player counts as one transfer).
  const canEditRoster = !lockRoster || transferMode;
  // The 15 the edit session started from — new players are counted against it.
  const [originalIds] = useState<Set<string>>(
    () => new Set([...initialStarterIds, ...initialBenchIds]),
  );
  // A starter/bench player picked via the menu's "Substitute" — the next tap on
  // an eligible (highlighted) player completes the swap.
  const [subSourceId, setSubSourceId] = useState<string | null>(null);
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

  // Auto-dismiss the "draft restored" banner after 4 s.
  const [showDraftBanner, setShowDraftBanner] = useState(restoredDraft !== null);
  useEffect(() => {
    if (!showDraftBanner) return;
    const t = setTimeout(() => setShowDraftBanner(false), 4000);
    return () => clearTimeout(t);
  }, [showDraftBanner]);

  // Persist draft to localStorage on every state change (skip when roster is locked).
  useEffect(() => {
    if (lockRoster || squad.length === 0) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        starterIds: squad.filter((p) => p.isStarting).map((p) => p.id),
        benchIds:   squad.filter((p) => !p.isStarting).map((p) => p.id),
        captainId,
        viceId,
      }));
    } catch { /* storage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squad, captainId, viceId]);

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

  // Transfers pending in THIS edit = players in the squad who weren't in the
  // original 15. (Removing and re-adding the same player counts as zero.)
  const transfersMade = transferMode
    ? squad.filter((p) => !originalIds.has(p.id)).length
    : 0;
  const transfersLeft = Math.max(0, transferLimit - transfersUsed - transfersMade);

  // Substitute pick-mode: who can the picked player legally swap with?
  const subSource = subSourceId ? squad.find((p) => p.id === subSourceId) ?? null : null;
  const subEligibleIds = useMemo(() => {
    if (!subSource) return new Set<string>();
    const others = subSource.isStarting ? bench : starters;
    return new Set(
      others
        .filter((o) =>
          subSource.isStarting ? canSwap(starters, subSource, o) : canSwap(starters, o, subSource),
        )
        .map((o) => o.id),
    );
    // starters/bench derive from squad; subSource identity covers the rest
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subSource, squad]);

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
    if (captain2Id === id) setCaptain2Id(null);
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
    // If the captain/vice/2nd-captain gets benched by this swap, clear that role.
    if (captainId === starter.id) setCaptainId(null);
    if (viceId === starter.id) setViceId(null);
    if (captain2Id === starter.id) setCaptain2Id(null);
    setSquad((prev) =>
      prev.map((p) =>
        p.id === starter.id ? { ...p, isStarting: false } : p.id === reserve.id ? { ...p, isStarting: true } : p,
      ),
    );
    return true;
  }

  // Tapping a pitch/bench token opens its action menu — UNLESS the tap is the
  // synthetic click that follows a drag (draggedRef set in onDragStart), or
  // we're in substitute pick-mode (then the tap picks the swap target).
  function handleTokenTap(id: string) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (subSourceId) {
      if (id === subSourceId) {
        setSubSourceId(null); // tap the same player again = cancel
        return;
      }
      if (subEligibleIds.has(id)) {
        trySwap(subSourceId, id);
        setSubSourceId(null);
        return;
      }
      setMessage("Tap one of the highlighted players to complete the substitution — or Cancel.");
      return;
    }
    setActionMenuId(id);
  }

  // Menu's "Substitute": enter pick-mode — highlight every legal swap partner
  // and let the user choose (no more auto-picking for them).
  function startSubstitute(id: string) {
    const p = squad.find((x) => x.id === id);
    if (!p) return;
    const anyEligible = (p.isStarting ? bench : starters).some((o) =>
      p.isStarting ? canSwap(starters, p, o) : canSwap(starters, o, p),
    );
    if (!anyEligible) {
      setMessage(
        p.isStarting
          ? "No one on the bench can replace that player without breaking the formation."
          : "That sub can't replace any starter without breaking the formation.",
      );
      return;
    }
    setMessage(null);
    setSubSourceId(id);
  }

  function loadTemplate() {
    const ids = buildTemplateSquad(pool);
    if (ids.length === 0) {
      setMessage("Couldn't build a suggested squad — try picking manually.");
      return;
    }
    const players = ids.map((id) => byId.get(id)).filter(Boolean) as PickerPlayer[];
    const split = splitStartingXI(players, "4-3-3");
    if (!split) return;
    const newSquad: SquadEntry[] = [
      ...split.starters.map((p) => ({ ...p, isStarting: true })),
      ...split.bench.map((p) => ({ ...p, isStarting: false })),
    ];
    // Auto-set captain/vice to the two most expensive attacking starters
    const attackers = split.starters
      .filter((p) => p.position === "FWD" || p.position === "MID")
      .sort((a, b) => b.price - a.price);
    setSquad(newSquad);
    setCaptainId(attackers[0]?.id ?? null);
    setViceId(attackers[1]?.id ?? null);
    setSelectedFormation("4-3-3");
    setMessage(null);
  }

  async function handleSave() {
    setMessage(null);
    if (!formationOk) {
      setMessage("Your starting 11 isn't a valid formation yet.");
      return;
    }
    if (transferMode && transfersUsed + transfersMade > transferLimit) {
      setMessage(
        `That's ${transfersMade} new player${transfersMade === 1 ? "" : "s"} but you only have ${Math.max(0, transferLimit - transfersUsed)} transfer${transferLimit - transfersUsed === 1 ? "" : "s"} left this round.`,
      );
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
        captain2Id: hasExtraCaptain ? captain2Id : null,
      });
      if (res.ok) {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
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
            {transferMode
              ? "Transfer window open — swap players right here: remove a player, then fill the slot."
              : lockRoster
                ? "Your 15 are locked — set your starting XI, captain & vice."
                : "Build a 15-player squad within £100m. Max 3 per country. Drag a sub onto a starter to swap."}
            {gameweekLabel ? ` · ${gameweekLabel}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Transfers remaining — prominent in the header during a knockout window. */}
          {transferMode && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 2,
                padding: "6px 12px",
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
              }}
              title="Each knockout round grants 3 transfers. Unused ones carry over to the next round."
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                Transfers left
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  color: transfersLeft === 0 ? "var(--live)" : "var(--accent)",
                }}
              >
                {transfersLeft}
                <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                  {" "}/ {transferLimit}
                </span>
              </span>
            </div>
          )}
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
      </div>

      <BudgetBar
        spent={validation.spent}
        count={validation.total}
        bonusBudget={budgetBonus}
        note={
          isGroupStage
            ? "Make bets to earn money — you can use it to strengthen your squad in the knockouts."
            : "Now you can use money you made from betting to strengthen your squad."
        }
      />

      {!lockRoster && squad.length === 0 && (
        <div className="banner open" style={{ marginTop: 12 }}>
          <div className="banner-l">
            <div className="banner-ico">
              <Icon name="bolt" size={20} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h4>Not sure where to start?</h4>
              <p>Load a suggested squad — balanced, within budget, fully customisable.</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadTemplate}>
            Suggest a squad
          </button>
        </div>
      )}

      {showDraftBanner && (
        <div className="valid-msgs" style={{ marginTop: 12 }}>
          <div className="vmsg ok">
            <span className="ic"><Icon name="check" size={16} /></span>
            Draft restored — your last session is back.
          </div>
        </div>
      )}

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
          {subSource && (
            <div
              className="vmsg"
              style={{
                marginBottom: 10,
                background: "rgba(24,224,138,0.08)",
                border: "1px solid rgba(24,224,138,0.3)",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 12,
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Icon name="swap" size={15} />
              <span style={{ flex: 1 }}>
                Substituting <b>{lastName(subSource.name)}</b> — tap a highlighted player to swap.
              </span>
              <button
                className="pill"
                style={{ cursor: "pointer" }}
                onClick={() => setSubSourceId(null)}
              >
                Cancel
              </button>
            </div>
          )}
          {!subSource && transferMode && (
            <div
              className="vmsg"
              style={{
                marginBottom: 10,
                background: "rgba(24,224,138,0.08)",
                border: "1px solid rgba(24,224,138,0.3)",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 12,
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Icon name="swap" size={15} />
              <span style={{ flex: 1 }}>
                <b>{transfersLeft}</b> transfer{transfersLeft === 1 ? "" : "s"} left
                {transfersMade > 0 && <> ({transfersMade} used in this edit)</>}
                {" — "}tap a player → Transfer out, then tap the empty slot to buy a replacement. Unused transfers carry over to the next round.
              </span>
            </div>
          )}
          {!subSource && !transferMode && lockRoster && (
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
              Your 15 are locked — change your starting XI, captain &amp; vice. Player transfers open in the knockout rounds.
            </div>
          )}
          <div className="pitch-wrap">
            <Pitch
              rows={pitchRows}
              captainId={captainId}
              viceId={viceId}
              captain2Id={captain2Id}
              onEmpty={(pos) => { if (canEditRoster) setPickerFor({ pos, starter: true }); }}
              onTapPlayer={handleTokenTap}
              onSwap={trySwap}
              subSourceId={subSourceId}
              subEligibleIds={subEligibleIds}
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
              onAdd={(pos) => { if (canEditRoster) setPickerFor({ pos, starter: false }); }}
              byPos={byPos}
              subSourceId={subSourceId}
              subEligibleIds={subEligibleIds}
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
            captain2Id={hasExtraCaptain ? captain2Id : null}
            hasExtraCaptain={hasExtraCaptain}
            countryCounts={countryCounts}
            maxPerCountry={maxPerCountry}
            transferMode={transferMode}
            transfersLeft={transfersLeft}
            transferLimit={transferLimit}
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
            isCaptain2={captain2Id === p.id}
            showCaptain2={hasExtraCaptain && p.isStarting}
            canRemove={canEditRoster}
            removeLabel={transferMode ? "Transfer out" : "Remove from squad"}
            onViewProfile={() => { setProfileId(p.id); close(); }}
            onCaptain={() => {
              setCaptainId(p.id);
              if (viceId === p.id) setViceId(null);
              if (captain2Id === p.id) setCaptain2Id(null);
              close();
            }}
            onVice={() => {
              setViceId(p.id);
              if (captainId === p.id) setCaptainId(null);
              if (captain2Id === p.id) setCaptain2Id(null);
              close();
            }}
            onCaptain2={() => {
              setCaptain2Id(p.id);
              if (captainId === p.id) setCaptainId(null);
              if (viceId === p.id) setViceId(null);
              close();
            }}
            onSubstitute={() => { startSubstitute(p.id); close(); }}
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
  isCaptain2,
  showCaptain2,
  canRemove,
  removeLabel = "Remove from squad",
  onViewProfile,
  onCaptain,
  onVice,
  onCaptain2,
  onSubstitute,
  onRemove,
  onClose,
}: {
  player: SquadEntry;
  isCaptain: boolean;
  isVice: boolean;
  isCaptain2: boolean;
  showCaptain2: boolean; // Extra Captain perk active + this player can start
  canRemove: boolean;
  removeLabel?: string;
  onViewProfile: () => void;
  onCaptain: () => void;
  onVice: () => void;
  onCaptain2: () => void;
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
              <span className="muted dim">{fmtPrice(player.price)}</span>
            </div>
          </div>
        </div>
        <div className="act-list">
          <Item icon="eye" label="View full profile" onClick={onViewProfile} />
          <Item icon="star" label={isCaptain ? "Captain (×2) — selected" : "Make Captain (×2)"} onClick={onCaptain} />
          {showCaptain2 && (
            <Item icon="star" label={isCaptain2 ? "2nd Captain (×2) — selected" : "Make 2nd Captain (×2)"} onClick={onCaptain2} />
          )}
          <Item icon="user" label={isVice ? "Vice-captain — selected" : "Make Vice-captain"} onClick={onVice} />
          <Item icon="swap" label="Substitute" onClick={onSubstitute} />
          {canRemove && (
            <Item icon="swap" label={removeLabel} onClick={onRemove} tone="live" />
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
  isCaptain2 = false,
  onTap,
  onDropSwap,
  isSubSource = false,
  isSubEligible = false,
  subModeActive = false,
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
  isCaptain2?: boolean; // second captain (Extra Captain perk) — shows a C badge too
  onTap: () => void;
  onDropSwap: (draggedId: string) => void;
  isSubSource?: boolean; // the player being substituted (pick-mode)
  isSubEligible?: boolean; // a legal swap target (pick-mode)
  subModeActive?: boolean; // pick-mode on → dim everyone else
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
        opacity: isDragging ? 0.32 : subModeActive && !isSubSource && !isSubEligible ? 0.35 : 1,
        transition: "opacity .12s, transform .15s",
        cursor: isDragging ? "grabbing" : "grab",
        ...(isSubEligible && {
          outline: "2px solid var(--accent)",
          outlineOffset: "3px",
          borderRadius: 12,
          boxShadow: "0 0 0 5px rgba(24,224,138,0.18)",
        }),
        ...(isSubSource && {
          outline: "2px solid var(--gold)",
          outlineOffset: "3px",
          borderRadius: 12,
        }),
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
      {(isCaptain || isCaptain2) && <span className="cap-badge">C</span>}
      {isVice && !isCaptain && !isCaptain2 && <span className="cap-badge vice">V</span>}
      <div className="slot-jersey"><Jersey country={entry.country} size={46} /></div>
      <div className="slot-flag"><Flag country={entry.country} size={13} round /></div>
      <div className="slot-name">{lastName(entry.name)}</div>
      <div className="slot-price num">£{(entry.price / 10).toFixed(1)}</div>
    </div>
  );
}

// Row center positions as % of pitch height — tuned to match the flex layout's
// natural row centers (padding 14px top / 16px bottom on a 300×380 aspect pitch).
const ROW_TOP: Record<Position, number> = { GK: 15, DEF: 38, MID: 61, FWD: 84 };

function Pitch({
  rows,
  captainId,
  viceId,
  captain2Id,
  onEmpty,
  onTapPlayer,
  onSwap,
  subSourceId,
  subEligibleIds,
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
  captain2Id: string | null;
  onEmpty: (pos: Position) => void;
  onTapPlayer: (id: string) => void;
  onSwap: (aId: string, bId: string) => boolean;
  subSourceId: string | null;
  subEligibleIds: Set<string>;
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
      {/* Flat absolute layer — every token is a direct child keyed by player ID so
          React never unmounts/remounts on formation change; only top/left update,
          which CSS transitions animate. */}
      <div className="pitch-tokens">
        {POS_ORDER.flatMap((pos) => {
          const slots = rows[pos];
          const n = slots.length;
          return slots.map((slot, i) => {
            const top  = ROW_TOP[pos];
            const left = ((i + 1) / (n + 1)) * 100;
            const key  = slot.player ? slot.player.id : `${pos}-empty-${i}`;
            return (
              <div
                key={key}
                className="pitch-token-pos"
                style={{ top: `${top}%`, left: `${left}%` }}
              >
                {slot.player ? (
                  <PlayerToken
                    entry={slot.player}
                    isCaptain={slot.player.id === captainId}
                    isVice={slot.player.id === viceId}
                    isCaptain2={slot.player.id === captain2Id}
                    onTap={() => onTapPlayer(slot.player!.id)}
                    onDropSwap={(draggedId) => onSwap(draggedId, slot.player!.id)}
                    isSubSource={slot.player.id === subSourceId}
                    isSubEligible={subEligibleIds.has(slot.player.id)}
                    subModeActive={subSourceId !== null}
                    draggedRef={draggedRef}
                    isDragging={draggingId === slot.player.id}
                    isDragOver={dragOverId === slot.player.id}
                    onDragStarted={() => onDragStart(slot.player!.id)}
                    onDragEnded={onDragEnd}
                    onDragEntered={() => onDragEnter(slot.player!.id)}
                    onDragLeft={onDragLeave}
                  />
                ) : (
                  <button className="slot slot-empty" onClick={() => onEmpty(pos)}>
                    <span className="slot-plus"><Icon name="plus" size={22} stroke={2} /></span>
                    <span className={"slot-pos pos pos-" + pos}>{pos}</span>
                  </button>
                )}
              </div>
            );
          });
        })}
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
  subSourceId,
  subEligibleIds,
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
  subSourceId: string | null;
  subEligibleIds: Set<string>;
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
          const isSubSource = p.id === subSourceId;
          const isSubEligible = subEligibleIds.has(p.id);
          const subModeActive = subSourceId !== null;
          return (
            <div
              key={p.id}
              className="bench-slot"
              draggable
              style={{
                opacity: isDragging ? 0.32 : subModeActive && !isSubSource && !isSubEligible ? 0.35 : 1,
                transition: "opacity .12s, transform .15s, box-shadow .15s",
                cursor: isDragging ? "grabbing" : "grab",
                ...(isSubEligible && {
                  outline: "2px solid var(--accent)",
                  outlineOffset: "3px",
                  boxShadow: "0 0 0 5px rgba(24,224,138,0.18)",
                }),
                ...(isSubSource && {
                  outline: "2px solid var(--gold)",
                  outlineOffset: "3px",
                }),
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
  captain2Id = null,
  hasExtraCaptain = false,
  countryCounts,
  maxPerCountry,
  transferMode = false,
  transfersLeft = 0,
  transferLimit = 0,
}: {
  squad: SquadEntry[];
  captainId: string | null;
  viceId: string | null;
  captain2Id?: string | null; // second captain (Extra Captain perk)
  hasExtraCaptain?: boolean;
  countryCounts: Record<string, number>;
  maxPerCountry: number;
  transferMode?: boolean;
  transfersLeft?: number;
  transferLimit?: number;
}) {
  const captain = squad.find((p) => p.id === captainId) ?? null;
  const vice = squad.find((p) => p.id === viceId) ?? null;
  const captain2 = captain2Id ? squad.find((p) => p.id === captain2Id) ?? null : null;
  const entries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card" style={{ padding: 16 }}>
      {transferMode && (
        <>
          <div className="sum-row">
            <span className="muted">Transfers left</span>
            <span
              className="num"
              style={{
                fontWeight: 800,
                color: transfersLeft === 0 ? "var(--live)" : "var(--accent)",
              }}
            >
              {transfersLeft} / {transferLimit}
            </span>
          </div>
          <p className="sum-hint" style={{ marginTop: 2, marginBottom: 6 }}>
            3 per knockout round — unused ones carry over to the next round.
          </p>
          <div className="sum-divider" />
        </>
      )}
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
      {hasExtraCaptain && (
        <div className="sum-row">
          <span className="muted">2nd Captain</span>
          {captain2 ? (
            <span className="sum-cap">
              <Flag country={captain2.country} size={14} round />
              <b>{lastName(captain2.name)}</b>
              <span className="pill pill-gold">×2</span>
            </span>
          ) : (
            <span className="dim">Not set</span>
          )}
        </div>
      )}
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
        Tap a starting player → <b>Make Captain</b> / <b>Make Vice-captain</b>.
        {hasExtraCaptain && <> Your <b>Extra Captain</b> perk lets you name a 2nd captain — both score ×2.</>}
        {" "}Captain & vice required to save.
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
            <span className="pill pill-blue">{fmtPrice(remaining)} to spend</span>
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
                Max {fmtPrice(maxPrice)}
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
