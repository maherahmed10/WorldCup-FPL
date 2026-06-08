"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Flag } from "@/components/Flag";
import { Jersey } from "@/components/Jersey";
import { BudgetBar } from "@/components/BudgetBar";
import {
  BUDGET,
  MAX_PER_COUNTRY,
  countByCountry,
  totalPrice,
  type Position,
  type SquadPlayer,
} from "@/lib/squad-rules";
import { executeTransfer } from "./actions";

export interface TransferPlayer extends SquadPlayer {
  name: string;
  isStarting: boolean;
  eliminated: boolean;
}

export interface PoolPlayer extends SquadPlayer {
  name: string;
  eliminated: boolean;
}

const POS_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];
const lastName = (n: string) => n.split(" ").slice(-1)[0];

export function TransfersClient({
  squadPlayers,
  pool,
  gameweekLabel,
}: {
  squadPlayers: TransferPlayer[];
  pool: PoolPlayer[];
  gameweekLabel: string;
}) {
  const router = useRouter();
  const [selectedOut, setSelectedOut] = useState<TransferPlayer | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const currentTotal = totalPrice(squadPlayers);
  const pickedIds = useMemo(() => new Set(squadPlayers.map((p) => p.id)), [squadPlayers]);
  const countryCounts = useMemo(() => countByCountry(squadPlayers), [squadPlayers]);

  // Max price for the incoming player: budget slack freed by removing outgoing player.
  const maxInPrice = selectedOut ? BUDGET - currentTotal + selectedOut.price : 0;

  // Country counts after the outgoing player is removed (for picker constraint).
  const countsAfterOut = useMemo(() => {
    if (!selectedOut) return countryCounts;
    const next: Record<string, number> = { ...countryCounts };
    next[selectedOut.country] = Math.max(0, (next[selectedOut.country] ?? 0) - 1);
    return next;
  }, [selectedOut, countryCounts]);

  async function handlePick(inPlayer: PoolPlayer) {
    if (!selectedOut || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await executeTransfer(selectedOut.id, inPlayer.id);
      setSelectedOut(null);
      if ("error" in result) {
        setMessage({ text: result.error, ok: false });
      } else {
        setMessage({ text: `Transferred in ${inPlayer.name}. ✓`, ok: true });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const byPos = POS_ORDER.reduce<Record<Position, TransferPlayer[]>>(
    (acc, pos) => { acc[pos] = squadPlayers.filter((p) => p.position === pos); return acc; },
    { GK: [], DEF: [], MID: [], FWD: [] },
  );

  const eliminatedCount = squadPlayers.filter((p) => p.eliminated).length;

  return (
    <div className="screen">
      <div className="screen-head head-row">
        <div>
          <h1>Transfers</h1>
          <div className="sub">{gameweekLabel} · Transfer window open</div>
        </div>
      </div>

      <BudgetBar spent={currentTotal} count={squadPlayers.length} />

      {message && (
        <div className="valid-msgs" style={{ marginTop: 12 }}>
          <div className={"vmsg " + (message.ok ? "ok" : "err")}>
            <span className="ic">
              <Icon name={message.ok ? "check" : "info"} size={16} />
            </span>
            {message.text}
          </div>
        </div>
      )}

      {eliminatedCount > 0 && (
        <div className="banner warn" style={{ marginTop: 14 }}>
          <div className="banner-l">
            <div className="banner-ico">
              <Icon name="info" size={20} style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <h4>{eliminatedCount} eliminated player{eliminatedCount > 1 ? "s" : ""} in your squad</h4>
              <p>Eliminated players score 0 until you transfer them out.</p>
            </div>
          </div>
        </div>
      )}

      <div className="banner info" style={{ marginTop: 14 }}>
        <div className="banner-l">
          <div className="banner-ico">
            <Icon name="swap" size={20} />
          </div>
          <div>
            <h4>Knockout transfer window</h4>
            <p>Tap Transfer on any player to swap them out. All squad rules apply.</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {POS_ORDER.map((pos) => (
          <div key={pos} style={{ marginBottom: 8 }}>
            <div className="sum-title" style={{ marginBottom: 6, marginTop: 12 }}>
              {pos === "GK" ? "Goalkeepers" : pos === "DEF" ? "Defenders" : pos === "MID" ? "Midfielders" : "Forwards"}
            </div>
            {byPos[pos].map((player) => (
              <div key={player.id} className="score-row" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span className={"pos pos-" + player.position}>{player.position}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                  <Jersey country={player.country} size={28} />
                  <Flag country={player.country} size={13} round />
                  <span className="sr-name" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {player.name}
                  </span>
                  {player.eliminated && (
                    <span className="pill pill-live" style={{ fontSize: 10, flexShrink: 0 }}>Eliminated</span>
                  )}
                  {!player.isStarting && (
                    <span className="pill" style={{ fontSize: 10, flexShrink: 0, opacity: 0.6 }}>Bench</span>
                  )}
                </div>
                <span className="num" style={{ fontSize: 13, color: "var(--text-3)", flexShrink: 0, marginRight: 8 }}>
                  £{(player.price / 10).toFixed(1)}m
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 13, flexShrink: 0 }}
                  onClick={() => { setMessage(null); setSelectedOut(player); }}
                  disabled={saving}
                >
                  <Icon name="swap" size={14} />
                  Transfer
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectedOut && (
        <TransferPickerModal
          outPlayer={selectedOut}
          pool={pool}
          pickedIds={pickedIds}
          countsAfterOut={countsAfterOut}
          maxInPrice={maxInPrice}
          onPick={handlePick}
          onClose={() => setSelectedOut(null)}
          pending={saving}
        />
      )}
    </div>
  );
}

function TransferPickerModal({
  outPlayer,
  pool,
  pickedIds,
  countsAfterOut,
  maxInPrice,
  onPick,
  onClose,
  pending,
}: {
  outPlayer: TransferPlayer;
  pool: PoolPlayer[];
  pickedIds: Set<string>;
  countsAfterOut: Record<string, number>;
  maxInPrice: number;
  onPick: (p: PoolPlayer) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [affordableOnly, setAffordableOnly] = useState(false);

  const countries = useMemo(
    () =>
      Array.from(
        new Set(pool.filter((p) => p.position === outPlayer.position).map((p) => p.country)),
      ).sort(),
    [pool, outPlayer.position],
  );

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = pool.filter((p) => p.position === outPlayer.position && !pickedIds.has(p.id));
    if (term) list = list.filter((p) => p.name.toLowerCase().includes(term) || p.country.toLowerCase().includes(term));
    if (country) list = list.filter((p) => p.country === country);
    if (affordableOnly) list = list.filter((p) => p.price <= maxInPrice);
    return list;
  }, [pool, outPlayer.position, pickedIds, search, country, affordableOnly, maxInPrice]);

  return (
    <div className="modal-overlay side" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-side" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Transfer Out: {lastName(outPlayer.name)}</h3>
            <div className="sub" style={{ fontSize: 13 }}>
              Pick a {outPlayer.position} replacement · max £{(maxInPrice / 10).toFixed(1)}m
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={pending}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="picker">
          <div className="picker-bar">
            <span className="pill pill-blue">Max £{(maxInPrice / 10).toFixed(1)}m</span>
            <span className="muted" style={{ fontSize: 13 }}>{candidates.length} available</span>
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
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={affordableOnly}
                  onChange={(e) => setAffordableOnly(e.target.checked)}
                />
                Affordable only
              </label>
            </div>
          </div>

          <div className="picker-list">
            {candidates.length === 0 ? (
              <div className="picker-empty">No players match your filters.</div>
            ) : (
              candidates.map((p) => {
                const countryFull = (countsAfterOut[p.country] ?? 0) >= MAX_PER_COUNTRY;
                const tooPricey = p.price > maxInPrice;
                const disabled = countryFull || pending;
                return (
                  <button
                    key={p.id}
                    className={"prow" + (disabled ? " disabled" : "")}
                    disabled={disabled}
                    onClick={() => !disabled && onPick(p)}
                  >
                    <span className="prow-flag"><Jersey country={p.country} size={30} /></span>
                    <span className="prow-id">
                      <span className="prow-name">
                        {p.name}
                        {p.eliminated && (
                          <span className="pill pill-live" style={{ marginLeft: 6, fontSize: 10 }}>Elim</span>
                        )}
                      </span>
                      <span className="prow-meta">
                        <span className={"pos pos-" + p.position}>{p.position}</span>
                        <Flag country={p.country} size={13} round />
                        <span className="muted">{p.country.replace(/-/g, " ")}</span>
                      </span>
                    </span>
                    <span className="prow-num">
                      <span className="prow-price num">£{(p.price / 10).toFixed(1)}</span>
                      {countryFull && (
                        <span className="prow-sub" style={{ color: "var(--live)" }}>Max 3</span>
                      )}
                      {tooPricey && !countryFull && (
                        <span className="prow-sub" style={{ color: "var(--gold)" }}>Over budget</span>
                      )}
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
