"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { potentialReturn, MIN_STAKE, type MarketType } from "@/lib/betting";
import { Flag } from "@/components/Flag";
import { placeParlay, placeSingles } from "./actions";
import { H2HClient, type H2HChallengeView } from "./H2HClient";
import { createH2HFromMarket } from "./h2h-actions";

export interface LeagueMemberView {
  id: string;
  name: string;
}

export interface MarketOptionView {
  name: string;
  selection: string;
  multiplier: number;
}
export interface MarketGroupView {
  marketType: MarketType;
  label: string;
  options: MarketOptionView[];
}
export interface FixtureMarketsView {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  home: TeamView;
  away: TeamView;
  time: string;
  groups: MarketGroupView[];
}
export interface TeamView {
  name: string;
  logoUrl: string | null;
}
export interface BetView {
  id: string;
  home: TeamView;
  away: TeamView;
  marketLabel: string;
  pick: string;
  stake: number;
  multiplier: number;
  status: "OPEN" | "WON" | "LOST" | "VOID";
  payout: number | null;
}
export interface ParlayLegView {
  pick: string;
  market: string;
  match: string;
  multiplier: number;
  status: "OPEN" | "WON" | "LOST" | "VOID";
}
export interface ParlayView {
  id: string;
  stake: number;
  multiplier: number;
  status: "OPEN" | "WON" | "LOST" | "VOID";
  payout: number | null;
  legs: ParlayLegView[];
}

interface SlipState {
  fixtureId: string;
  home: TeamView;
  away: TeamView;
  marketType: MarketType;
  marketLabel: string;
  pick: string;
  selection: string;
  multiplier: number;
}

type SlipLeg = SlipState & { key: string };

const RESULT_MARKETS: MarketType[] = ["MATCH_RESULT", "OVER_UNDER", "BTTS"];
const isResultMarket = (m: MarketType) => RESULT_MARKETS.includes(m);
// Unique key per (fixture, market, pick) for toggle/dedupe.
const legKeyOf = (s: SlipState) => `${s.fixtureId}|${s.marketType}|${s.selection}`;

// Stake scale — the betting bank is the £5M stipend, so stakes are sized in
// hundred-thousands. House bets start at MIN_STAKE (£50k); head-to-head at £100k.
// Manual entry rounds to the nearest £10k.
const STAKE_ROUND = 10_000; // manual entry snaps to nearest £10k
const H2H_MIN_STAKE = 100_000;
const STAKE_CHIPS = [50_000, 100_000, 500_000]; // + "Max"
// Round a typed value to the nearest £10k, clamped to [min, max].
const snapStake = (v: number, min: number, max: number) => {
  if (v <= 0) return 0;
  const snapped = Math.round(v / STAKE_ROUND) * STAKE_ROUND;
  return Math.max(min, Math.min(max, snapped));
};
// Compact chip label: 50_000 → "50k", 1_000_000 → "1M".
const fmtChip = (v: number) =>
  v >= 1_000_000 ? `${v / 1_000_000}M` : `${Math.round(v / 1000)}k`;

function MatchTitle({ home, away, size = 20 }: { home: TeamView; away: TeamView; size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Flag country={home.name} size={size} round />
      <span className="text-sm font-bold">
        {home.name} <span style={{ color: "var(--text-3)" }}>v</span> {away.name}
      </span>
      <Flag country={away.name} size={size} round />
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "none", color: "var(--text-3)" }}
    >
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PredictClient({
  markets,
  bets,
  parlays = [],
  balance,
  h2hChallenges = [],
  userId = "",
  leagueMembers = [],
}: {
  markets: FixtureMarketsView[];
  bets: BetView[];
  parlays?: ParlayView[];
  balance: number;
  h2hChallenges?: H2HChallengeView[];
  userId?: string;
  leagueMembers?: LeagueMemberView[];
}) {
  const [tab, setTab] = useState<"markets" | "mybets" | "h2h">("markets");
  // The accumulator bet slip: legs the user has tapped (vs House).
  const [legs, setLegs] = useState<SlipLeg[]>([]);
  const [slipOpen, setSlipOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const open = bets.filter((b) => b.status === "OPEN");
  const settled = bets.filter((b) => b.status !== "OPEN");

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // Tap an odds button → toggle it in the slip. Result markets (1X2/OU/BTTS) are
  // mutually exclusive per fixture (a new pick replaces the prior one).
  function toggleLeg(s: SlipState) {
    const key = legKeyOf(s);
    setLegs((prev) => {
      if (prev.some((l) => l.key === key)) return prev.filter((l) => l.key !== key);
      let next = prev;
      if (isResultMarket(s.marketType)) {
        next = prev.filter((l) => !(l.fixtureId === s.fixtureId && l.marketType === s.marketType));
      }
      setSlipOpen(true);
      return [...next, { key, ...s }];
    });
  }
  const removeLeg = (key: string) => setLegs((prev) => prev.filter((l) => l.key !== key));
  const clearLegs = () => setLegs([]);
  const activeKeys = new Set(legs.map((l) => l.key));

  return (
    <div className="screen">
      <div className="screen-head head-row">
        <div>
          <h1>Bets</h1>
          <div className="sub">
            Stake your virtual £ bank on match markets. Win big, spend winnings in the Store.
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2"
          style={{ background: "var(--surface)", borderColor: "var(--line-2)" }}
        >
          <span style={{ color: "var(--accent)" }}>£</span>
          <div className="text-right">
            <div className="num text-lg font-extrabold">{balance.toLocaleString("en-GB")}</div>
            <div className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>
              betting bank
            </div>
          </div>
        </div>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "markets", label: "Markets" },
          { value: "mybets", label: `My Bets${open.length ? ` (${open.length})` : ""}` },
          { value: "h2h", label: "Head to Head" },
        ]}
      />

      {tab === "markets" ? (
        <div className="mt-4 flex flex-col gap-2">
          {markets.length === 0 ? (
            <Empty title="No open markets" sub="Markets appear here for upcoming fixtures." />
          ) : (
            markets.map((m) => (
              <FixtureCard key={m.fixtureId} m={m} onPick={toggleLeg} activeKeys={activeKeys} />
            ))
          )}
        </div>
      ) : tab === "mybets" ? (
        <MyBets open={open} settled={settled} parlays={parlays} />
      ) : (
        <H2HClient challenges={h2hChallenges} userId={userId} />
      )}

      {/* Floating accumulator bet slip (vs House). */}
      {tab === "markets" && (
        <BetSlip
          legs={legs}
          balance={balance}
          open={slipOpen}
          setOpen={setSlipOpen}
          removeLeg={removeLeg}
          clear={clearLegs}
          leagueMembers={leagueMembers}
          onPlaced={(msg) => { clearLegs(); flash(msg); }}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lg"
          style={{ background: "var(--surface-3)", borderColor: "var(--line-2)", color: "var(--text)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Fixture accordion card ───────────────────────────────────────────────────

function FixtureCard({
  m,
  onPick,
  activeKeys,
}: {
  m: FixtureMarketsView;
  onPick: (s: SlipState) => void;
  activeKeys: Set<string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5"
        onClick={() => setOpen((v) => !v)}
      >
        <MatchTitle home={m.home} away={m.away} />
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[13px]" style={{ color: "var(--text-2)" }}>{m.time}</span>
          <Chevron open={open} />
        </div>
      </button>

      {open && (
        <div
          className="border-t px-4 pb-4 pt-3"
          style={{ borderColor: "var(--line)" }}
        >
          {m.groups.map((g) => (
            <MarketGroup key={g.label} g={g} fixture={m} onPick={onPick} activeKeys={activeKeys} />
          ))}
        </div>
      )}
    </div>
  );
}

// Player markets where "+ Other" lets you bet on any squad player.
const PLAYER_MARKET_KIND: Partial<Record<MarketType, "scorer" | "assist" | "card">> = {
  PLAYER_SCORER: "scorer",
  PLAYER_ASSIST: "assist",
  PLAYER_CARD: "card",
};
const selectionPrefix = { scorer: "scorer:", assist: "assist:", card: "card:" } as const;

function MarketGroup({
  g,
  fixture,
  onPick,
  activeKeys,
}: {
  g: MarketGroupView;
  fixture: FixtureMarketsView;
  onPick: (s: SlipState) => void;
  activeKeys: Set<string>;
}) {
  const [open, setOpen] = useState(true);
  // Picker context: which team's full squad to browse for this player market.
  const [picker, setPicker] = useState<{ teamId: string; teamName: string } | null>(null);
  // Players chosen via "+ Other" that aren't in the default shortlist — shown inline.
  const [extras, setExtras] = useState<MarketOptionView[]>([]);

  const kind = PLAYER_MARKET_KIND[g.marketType];
  const shownSelections = new Set([...g.options, ...extras].map((o) => o.selection));

  const betFor = (o: MarketOptionView): SlipState => ({
    fixtureId: fixture.fixtureId,
    home: fixture.home,
    away: fixture.away,
    marketType: g.marketType,
    marketLabel: g.label,
    pick: o.name,
    selection: o.selection,
    multiplier: o.multiplier,
  });

  return (
    <div className="mb-2 last:mb-0">
      <button
        className="mb-1.5 flex w-full items-center gap-1.5 text-xs font-bold"
        style={{ color: "var(--text-3)" }}
        onClick={() => setOpen((v) => !v)}
      >
        <Chevron open={open} />
        {g.label}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...g.options, ...extras].map((o) => {
            const on = activeKeys.has(legKeyOf(betFor(o)));
            return (
              <button
                key={o.selection}
                onClick={() => onPick(betFor(o))}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors"
                style={{
                  background: on ? "color-mix(in srgb, var(--accent) 16%, var(--surface-2))" : "var(--surface-2)",
                  borderColor: on ? "var(--accent)" : "var(--line-2)",
                }}
              >
                <span className="truncate text-[13px] font-semibold">{o.name}</span>
                <span className="num text-sm font-bold" style={{ color: "var(--accent)" }}>
                  {o.multiplier.toFixed(2)}
                </span>
              </button>
            );
          })}
          {/* "+ Other" — one per team, only for player markets. */}
          {kind && (
            <>
              <OtherButton
                label={`Other ${fixture.home.name}`}
                onClick={() => setPicker({ teamId: fixture.homeTeamId, teamName: fixture.home.name })}
              />
              <OtherButton
                label={`Other ${fixture.away.name}`}
                onClick={() => setPicker({ teamId: fixture.awayTeamId, teamName: fixture.away.name })}
              />
            </>
          )}
        </div>
      )}

      {kind && picker && (
        <TeamMarketPicker
          teamId={picker.teamId}
          teamName={picker.teamName}
          kind={kind}
          marketLabel={g.label}
          excludeSelections={shownSelections}
          onChoose={(row) => {
            const opt: MarketOptionView = {
              name: row.name,
              selection: `${selectionPrefix[kind]}${row.id}`,
              multiplier: row.odds,
            };
            if (!shownSelections.has(opt.selection)) setExtras((e) => [...e, opt]);
            onPick(betFor(opt)); // open the bet flow straight away
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function OtherButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2.5 text-[13px] font-semibold transition-colors hover:border-[var(--accent)]"
      style={{ borderColor: "var(--line-2)", color: "var(--text-3)" }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

interface MarketRow {
  id: string;
  name: string;
  position: "DEF" | "MID" | "FWD";
  odds: number;
}

function TeamMarketPicker({
  teamId,
  teamName,
  kind,
  marketLabel,
  excludeSelections,
  onChoose,
  onClose,
}: {
  teamId: string;
  teamName: string;
  kind: "scorer" | "assist" | "card";
  marketLabel: string;
  excludeSelections: Set<string>;
  onChoose: (row: MarketRow) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  const [q, setQ] = useState("");

  // Load the team's full market roster on open.
  useEffect(() => {
    let alive = true;
    fetch(`/api/team-market/${teamId}/${kind}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MarketRow[]) => alive && setRows(data))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [teamId, kind]);

  const list = (rows ?? []).filter(
    (r) =>
      !excludeSelections.has(`${selectionPrefix[kind]}${r.id}`) &&
      (!q.trim() || r.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ animation: "popIn .2s ease", maxWidth: 460 }}>
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="text-base font-bold">{marketLabel} · {teamName}</div>
          <button onClick={onClose} style={{ color: "var(--text-3)" }} aria-label="Close">✕</button>
        </div>
        <div style={{ padding: "10px 16px 16px" }}>
          <input
            className="fld"
            placeholder={`Search ${teamName} squad…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            style={{ marginBottom: 10, width: "100%" }}
          />
          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {list.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-3)", padding: "24px 0", fontSize: 14 }}>
                {rows === null ? "Loading…" : "No more players match."}
              </div>
            ) : (
              list.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onChoose(r)}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-[var(--accent)]"
                  style={{ background: "var(--surface-2)", borderColor: "var(--line-2)" }}
                >
                  <span className="flex items-center gap-2">
                    <span className={"pos pos-" + r.position}>{r.position}</span>
                    <span className="truncate text-[13px] font-semibold">{r.name}</span>
                  </span>
                  <span className="num text-sm font-bold" style={{ color: "var(--accent)" }}>
                    {r.odds.toFixed(2)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Floating accumulator bet slip (vs House) ─────────────────────────────────

function BetSlip({
  legs,
  balance,
  open,
  setOpen,
  removeLeg,
  clear,
  leagueMembers,
  onPlaced,
}: {
  legs: SlipLeg[];
  balance: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  removeLeg: (key: string) => void;
  clear: () => void;
  leagueMembers: LeagueMemberView[];
  onPlaced: (msg: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"singles" | "parlay" | "h2h">("singles");
  const [stake, setStake] = useState(MIN_STAKE);
  // Raw input text — lets you type/backspace freely; we snap to £10k on commit
  // (blur or Enter), not on every keystroke.
  const [rawStake, setRawStake] = useState(String(MIN_STAKE));
  const [opponentId, setOpponentId] = useState(leagueMembers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Clear a stale placement error when the selection or mode changes.
  useEffect(() => setError(null), [legs.length, mode]);
  // Keep the input text in sync whenever the numeric stake changes elsewhere
  // (chips, Max, the H2H auto-bump).
  useEffect(() => setRawStake(String(stake)), [stake]);
  // Auto-bump the stake to the £100k floor when switching to head-to-head.
  useEffect(() => {
    if (mode === "h2h") setStake((s) => Math.max(s, H2H_MIN_STAKE));
  }, [mode]);

  const combo = legs.reduce((p, l) => p * l.multiplier, 1);
  if (legs.length === 0) return null;
  const multi = legs.length > 1;
  const effMode = mode;
  // Parlay needs 2+ legs; H2H needs EXACTLY 1 (you can't head-to-head a parlay).
  const needsMoreForParlay = effMode === "parlay" && !multi;
  const h2hBlocked = effMode === "h2h" && multi;
  // H2H has a higher floor (£100k). Manual entry rounds to nearest £10k.
  const minStake = effMode === "h2h" ? H2H_MIN_STAKE : MIN_STAKE;
  const maxStake = effMode === "singles" ? Math.floor(balance / legs.length) : balance;
  const totalStake = effMode === "singles" ? stake * legs.length : stake;

  // Commit the typed value: snap to the nearest £10k, clamped. Called on blur/Enter.
  const commitStake = () => {
    const snapped = snapStake(Number(rawStake) || 0, minStake, maxStake);
    setStake(snapped);
    setRawStake(String(snapped));
  };
  const ret =
    effMode === "singles"
      ? legs.reduce((s, l) => s + Math.round(stake * l.multiplier), 0)
      : effMode === "h2h"
        ? stake * 2 // head-to-head pot = both stakes
        : Math.round(stake * combo);
  const tooHigh = totalStake > balance || stake < minStake;

  function place() {
    setError(null);
    // Head-to-head → send the challenge directly from the slip.
    if (effMode === "h2h") {
      if (!leagueMembers.length) {
        setError("Join or create a league with friends to challenge them.");
        return;
      }
      if (!opponentId) { setError("Pick an opponent."); return; }
      const leg = legs[0];
      const opp = leagueMembers.find((m) => m.id === opponentId);
      startTransition(async () => {
        const res = await createH2HFromMarket(
          leg.fixtureId, leg.selection, leg.multiplier, leg.pick, opponentId, stake,
        );
        if (res.ok) {
          router.refresh();
          clear();
          onPlaced(`Challenge sent to ${opp?.name ?? "friend"} · £${stake.toLocaleString("en-GB")} locked`);
        } else {
          setError(res.error);
        }
      });
      return;
    }
    const slipLegs = legs.map((l) => ({
      fixtureId: l.fixtureId,
      marketType: l.marketType,
      selection: l.selection,
      pick: l.pick,
      multiplier: l.multiplier,
    }));
    // A single selection (or "Singles" mode) places as separate bets;
    // only a 2+-leg "Parlay" goes through placeParlay.
    const asParlay = effMode === "parlay" && multi;
    startTransition(async () => {
      const res = asParlay
        ? await placeParlay(slipLegs, stake)
        : await placeSingles(slipLegs, stake);
      if (res.ok) {
        onPlaced(
          asParlay
            ? `Parlay placed · £${stake.toLocaleString("en-GB")}`
            : legs.length > 1
              ? `${legs.length} singles placed · £${totalStake.toLocaleString("en-GB")}`
              : `Bet placed · £${stake.toLocaleString("en-GB")}`,
        );
      } else {
        setError(res.error);
      }
    });
  }

  // Collapsed pill.
  if (!open) {
    return (
      <button
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-bold shadow-lg"
        style={{ background: "var(--surface-3)", borderColor: "var(--accent)", color: "var(--text)" }}
        onClick={() => setOpen(true)}
      >
        <span style={{ color: "var(--accent)" }}>⚽</span>
        {legs.length} {multi ? "selections" : "selection"}
        <span className="num" style={{ color: "var(--accent)" }}>@{combo.toFixed(2)}</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex w-[372px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border shadow-2xl"
      style={{ background: "var(--surface)", borderColor: "var(--line-2)", maxHeight: "min(78vh, 640px)" }}
    >
      {/* head */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2 font-bold">
          <span style={{ color: "var(--accent)" }}>⚽</span>
          Bet Slip
          <span className="pill" style={{ background: "var(--surface-3)", padding: "1px 8px", borderRadius: 999, fontSize: 12 }}>{legs.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="text-xs font-semibold" style={{ color: "var(--text-3)" }} onClick={clear}>Clear</button>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Collapse" style={{ color: "var(--text-3)", padding: 4 }}>▾</button>
        </div>
      </div>

      {/* parlay/singles toggle — always visible so Parlay is a discoverable feature */}
      <div className="px-4 pt-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "singles", label: "Singles" },
            { value: "parlay", label: "Parlay" },
            { value: "h2h", label: "H2H" },
          ]}
        />
      </div>

      {/* legs */}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {legs.map((l) => (
          <div key={l.key} className="flex items-center gap-2 rounded-lg border px-3 py-2"
            style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">{l.pick}</div>
              <div className="truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                {l.home.name} v {l.away.name} · {l.marketLabel}
              </div>
            </div>
            <span className="num text-sm font-bold" style={{ color: "var(--accent)" }}>{l.multiplier.toFixed(2)}</span>
            <button onClick={() => removeLeg(l.key)} aria-label="Remove" style={{ color: "var(--text-3)", padding: "0 2px" }}>✕</button>
          </div>
        ))}
      </div>

      {/* foot */}
      <div className="border-t px-4 py-3" style={{ borderColor: "var(--line)" }}>
        {effMode === "parlay" && multi && (
          <div className="mb-2 flex items-center justify-between text-sm">
            <span style={{ color: "var(--text-3)" }}>{legs.length}-leg parlay</span>
            <span className="num font-extrabold" style={{ color: "var(--accent)" }}>@{combo.toFixed(2)}</span>
          </div>
        )}
        {/* H2H opponent picker — who you're challenging. */}
        {effMode === "h2h" && !h2hBlocked && (
          <div className="mb-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: "var(--text-3)" }}>Challenge</div>
            {leagueMembers.length === 0 ? (
              <div className="rounded-lg border border-dashed px-3 py-2 text-[12px] font-semibold"
                style={{ borderColor: "var(--line-2)", color: "var(--gold)" }}>
                Join or create a league to challenge friends — see the Leagues tab.
              </div>
            ) : (
              <select
                value={opponentId}
                onChange={(e) => setOpponentId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-semibold outline-none"
                style={{ background: "var(--surface-2)", borderColor: "var(--line)", color: "var(--text)" }}
              >
                {leagueMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="mb-2 flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--line-2)" }}>
          <span style={{ color: "var(--gold)" }}>£</span>
          <input
            type="number" value={rawStake} min={minStake} max={maxStake} step={STAKE_ROUND}
            onChange={(e) => setRawStake(e.target.value)}
            onBlur={commitStake}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitStake(); } }}
            className="num w-full bg-transparent outline-none"
          />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {effMode === "singles" ? "/ leg" : effMode === "h2h" ? "each" : "stake"}
          </span>
        </div>
        <div className="mb-2 flex gap-1.5">
          {/* Chips at or above this mode's minimum (so H2H drops the £50k chip). */}
          {[...STAKE_CHIPS.filter((c) => c >= minStake), maxStake].map((v, i, arr) => {
            const isMax = i === arr.length - 1;
            const val = isMax ? maxStake : Math.max(minStake, Math.min(v, maxStake));
            return (
              <button key={i} onClick={() => setStake(val)}
                className="flex-1 rounded-md border py-1 text-xs font-semibold"
                style={{ borderColor: "var(--line-2)", color: "var(--text-2)" }}>
                {isMax ? "Max" : fmtChip(v)}
              </button>
            );
          })}
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {effMode === "h2h"
              ? "Pot (you + opponent)"
              : effMode === "singles" && multi
                ? "Total return (if all win)"
                : "Potential return"}
          </span>
          <span className="num text-lg font-extrabold" style={{ color: "var(--accent)" }}>
            £{ret.toLocaleString("en-GB")}
          </span>
        </div>
        {needsMoreForParlay ? (
          <div className="mb-2 text-xs font-semibold" style={{ color: "var(--gold)" }}>
            Tap another selection to build a parlay, or switch to Singles to place this one.
          </div>
        ) : h2hBlocked ? (
          <div className="mb-2 text-xs font-semibold" style={{ color: "var(--gold)" }}>
            Head-to-head is one selection only — remove legs to challenge a friend.
          </div>
        ) : (
          (error || tooHigh) && (
            <div className="mb-2 text-xs font-semibold" style={{ color: "var(--live)" }}>
              {error ?? (stake < minStake ? `Minimum stake is £${minStake.toLocaleString("en-GB")}.` : "Total stake exceeds your balance.")}
            </div>
          )
        )}
        <button
          className="btn btn-primary btn-block"
          disabled={
            tooHigh || pending || needsMoreForParlay || h2hBlocked ||
            (effMode === "h2h" && (!leagueMembers.length || !opponentId))
          }
          onClick={place}
        >
          {pending
            ? "Placing…"
            : needsMoreForParlay
              ? "Add another selection"
              : h2hBlocked
                ? "One selection only"
                : effMode === "h2h"
                  ? `⚔ Challenge · £${stake.toLocaleString("en-GB")}`
                  : effMode === "singles"
                    ? legs.length > 1
                      ? `Place ${legs.length} singles · £${totalStake.toLocaleString("en-GB")}`
                      : `Place bet · £${stake.toLocaleString("en-GB")}`
                    : `Place parlay · £${stake.toLocaleString("en-GB")}`}
        </button>
      </div>
    </div>
  );
}

// ─── My Bets ──────────────────────────────────────────────────────────────────

function MyBets({
  open,
  settled,
  parlays = [],
}: {
  open: BetView[];
  settled: BetView[];
  parlays?: ParlayView[];
}) {
  const openParlays = parlays.filter((p) => p.status === "OPEN");
  const settledParlays = parlays.filter((p) => p.status !== "OPEN");
  if (!open.length && !settled.length && !parlays.length) {
    return <Empty title="No bets yet" sub="Head to Markets and stake some points on an upcoming match." />;
  }
  return (
    <div className="mt-4">
      {(open.length > 0 || openParlays.length > 0) && (
        <>
          <div className="mb-2.5 text-sm font-bold" style={{ color: "var(--text-2)" }}>Open bets</div>
          {openParlays.map((p) => <ParlayRow key={p.id} p={p} />)}
          {open.map((b) => <BetRow key={b.id} b={b} />)}
        </>
      )}
      {(settled.length > 0 || settledParlays.length > 0) && (
        <>
          <div className="mb-2.5 mt-5 text-sm font-bold" style={{ color: "var(--text-2)" }}>Settled</div>
          {settledParlays.map((p) => <ParlayRow key={p.id} p={p} />)}
          {settled.map((b) => <BetRow key={b.id} b={b} />)}
        </>
      )}
    </div>
  );
}

function ParlayRow({ p }: { p: ParlayView }) {
  const accent =
    p.status === "WON" ? "var(--accent)" : p.status === "LOST" ? "var(--live)" : "var(--text-2)";
  const potential = Math.round(p.stake * p.multiplier);
  return (
    <div className="mb-2 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--line)" }}>
        <span className="flex items-center gap-2 text-[13px] font-bold">
          <span className="rounded px-2 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, var(--gold) 18%, transparent)", color: "var(--gold)" }}>
            {p.legs.length}-LEG PARLAY
          </span>
          <span className="num" style={{ color: "var(--text-3)" }}>@{p.multiplier.toFixed(2)}</span>
        </span>
        <span className="num text-[13px] font-bold" style={{ color: accent }}>
          {p.status === "OPEN" ? `Open · £${potential.toLocaleString("en-GB")}` : p.status === "WON" ? `+£${(p.payout ?? 0).toLocaleString("en-GB")}` : p.status === "VOID" ? "Void" : "Lost"}
        </span>
      </div>
      <div className="px-3 py-2" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {p.legs.map((l, i) => {
          const dot = l.status === "WON" ? "var(--accent)" : l.status === "LOST" ? "var(--live)" : "var(--text-3)";
          return (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, flexShrink: 0 }} />
              <span className="font-semibold">{l.pick}</span>
              <span style={{ color: "var(--text-3)" }} className="truncate">· {l.match} · {l.market}</span>
              <span className="num ml-auto" style={{ color: "var(--text-3)" }}>{l.multiplier.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t px-3 py-1.5 text-[11px]" style={{ borderColor: "var(--line)", color: "var(--text-3)" }}>
        Stake £{p.stake.toLocaleString("en-GB")} · all legs must win
      </div>
    </div>
  );
}

function BetRow({ b }: { b: BetView }) {
  const accent =
    b.status === "WON" ? "var(--accent)" : b.status === "LOST" ? "var(--live)" : b.status === "VOID" ? "var(--text-3)" : "var(--gold)";
  return (
    <div
      className="mb-2 flex items-center justify-between gap-3 rounded-xl border p-3"
      style={{ background: "var(--surface)", borderColor: "var(--line)", borderLeft: `3px solid ${accent}` }}
    >
      <div className="min-w-0">
        <MatchTitle home={b.home} away={b.away} size={16} />
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="font-bold">{b.pick}</span>
          <span style={{ color: "var(--text-3)" }}>{b.marketLabel}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="num text-sm font-bold">
          £{b.stake.toLocaleString("en-GB")} <span style={{ color: "var(--text-3)" }}>@{b.multiplier.toFixed(2)}</span>
        </div>
        <div className="num text-[13px] font-bold" style={{ color: accent }}>
          {b.status === "OPEN" ? "Open" : b.status === "WON" ? `+£${(b.payout ?? 0).toLocaleString("en-GB")}` : b.status === "VOID" ? "Void" : "Lost"}
        </div>
      </div>
    </div>
  );
}

// ─── shared ───────────────────────────────────────────────────────────────────

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      className="mt-4 rounded-2xl border p-8 text-center"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="text-lg font-bold">{title}</div>
      <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>{sub}</p>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div
      className="inline-flex rounded-xl border p-1"
      style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="rounded-lg px-4 py-1.5 text-sm font-bold transition-colors"
            style={{
              background: on ? "var(--accent)" : "transparent",
              color: on ? "var(--accent-ink)" : "var(--text-2)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
