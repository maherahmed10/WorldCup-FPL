"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "@/components/Flag";
import { fmtMoney } from "@/lib/format";
import type { NationLeaguesPayload, NationMemberRow, NationStats } from "@/lib/nations";
import { loadNationMembers, setSupportedNation } from "./actions";

const n = (v: number) => v.toLocaleString("en-US");

// ── Medal palette ──────────────────────────────────────────────────────────
const MEDAL = ["🥇", "🥈", "🥉"];
const M_COLOR = ["#F5C518", "#C0C0C0", "#CD7F32"];
const M_BG = ["rgba(245,197,24,.10)", "rgba(192,192,192,.09)", "rgba(205,127,50,.09)"];
const M_BORDER = ["rgba(245,197,24,.40)", "rgba(192,192,192,.30)", "rgba(205,127,50,.30)"];
const M_GLOW = [
  "0 0 28px rgba(245,197,24,.22), 0 4px 12px rgba(0,0,0,.35)",
  "0 0 18px rgba(192,192,192,.15), 0 4px 12px rgba(0,0,0,.3)",
  "0 0 18px rgba(205,127,50,.18), 0 4px 12px rgba(0,0,0,.3)",
];

// ── Sort ───────────────────────────────────────────────────────────────────
type SortKey = "bankroll" | "pts" | "managers";

function sortedNations(nations: NationStats[], key: SortKey): NationStats[] {
  const s = [...nations];
  if (key === "bankroll") s.sort((a, b) => b.avgBankroll - a.avgBankroll || a.country.localeCompare(b.country));
  else if (key === "pts") s.sort((a, b) => b.avgPts - a.avgPts || a.country.localeCompare(b.country));
  else s.sort((a, b) => b.memberCount - a.memberCount || a.country.localeCompare(b.country));
  return s.map((x, i) => ({ ...x, nationRank: i + 1 }));
}

function sortLabel(key: SortKey, nation: NationStats): string {
  if (key === "bankroll") return fmtMoney(nation.avgBankroll);
  if (key === "pts") return `${n(nation.avgPts)} pts`;
  return `${n(nation.memberCount)} mgrs`;
}

// ── Stat tile ──────────────────────────────────────────────────────────────
function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: "var(--r-sm)",
      background: "rgba(255,255,255,.05)",
      border: "1px solid rgba(255,255,255,.07)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em", color: accent ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

// ── Nation picker ──────────────────────────────────────────────────────────
function NationPicker({
  allCountries,
  onPick,
  isPending,
  onCancel,
  canCancel,
}: {
  allCountries: string[];
  onPick: (c: string) => void;
  isPending: boolean;
  onCancel?: () => void;
  canCancel: boolean;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? allCountries.filter((c) => c.toLowerCase().includes(q.toLowerCase()))
    : allCountries;

  return (
    <div>
      <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>🌍</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Join the Fan War
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 300, margin: "0 auto 4px" }}>
          Pick the nation you support. Your collective bankroll gets compared against every other
          fanbase in the world. May the best nation win.
        </p>
        {canCancel && (
          <button
            onClick={onCancel}
            style={{ fontSize: 12, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", marginTop: 6 }}
          >
            Cancel
          </button>
        )}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search nations…"
        disabled={isPending}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "10px 14px",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--line)",
          background: "var(--surface-2)",
          color: "var(--text)", fontSize: 14,
          marginBottom: 12,
        }}
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
        gap: 8,
      }}>
        {filtered.map((country) => (
          <button
            key={country}
            disabled={isPending}
            onClick={() => onPick(country)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              padding: "10px 4px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.5 : 1,
              transition: "border-color .12s, transform .1s",
            }}
          >
            <Flag country={country} size={30} round />
            <span style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 600, textAlign: "center", lineHeight: 1.2, wordBreak: "break-word" }}>
              {country}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px 0", fontSize: 13, color: "var(--text-3)" }}>
            No nations match &ldquo;{q}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}

// ── Your nation hero ───────────────────────────────────────────────────────
function YourNationHero({
  stats,
  rivalries,
  onChangeNation,
}: {
  stats: NationStats;
  rivalries: NationLeaguesPayload["rivalries"];
  onChangeNation: () => void;
}) {
  const rank = stats.nationRank;
  const isTop3 = rank <= 3;
  const color = isTop3 ? M_COLOR[rank - 1] : "var(--accent)";
  const border = isTop3 ? M_BORDER[rank - 1] : "rgba(24,224,138,.35)";
  const bg = isTop3 ? M_BG[rank - 1] : "rgba(24,224,138,.06)";
  const glow = isTop3 ? M_GLOW[rank - 1] : undefined;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        borderRadius: "var(--r-lg)",
        border: `1px solid ${border}`,
        background: bg,
        boxShadow: glow,
        padding: "20px 18px 18px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <Flag country={stats.country} size={60} round style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em", color }}>
              {isTop3 ? `${MEDAL[rank - 1]} ` : ""}{stats.country.replace(/-/g, " ")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3, fontWeight: 600 }}>
              #{rank} nation worldwide · {n(stats.memberCount)} {stats.memberCount === 1 ? "manager" : "managers"}
            </div>
          </div>
          <button
            onClick={onChangeNation}
            style={{
              fontSize: 11, color: "var(--text-3)", fontWeight: 700,
              padding: "4px 8px", borderRadius: "var(--r-sm)",
              border: "1px solid var(--line)", background: "none",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            Change
          </button>
        </div>

        {/* Stats 2×2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: rivalries.length ? 14 : 0 }}>
          <Tile label="Avg Bankroll" value={fmtMoney(stats.avgBankroll)} accent={color} />
          <Tile label="Total Bankroll" value={fmtMoney(stats.totalBankroll)} />
          <Tile label="Avg Points" value={n(stats.avgPts)} />
          <Tile label="H2H Record" value={`${stats.h2hWins}W – ${stats.h2hLosses}L`} />
        </div>

        {/* Rivalries */}
        {rivalries.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>
              ⚔️ Rivalries
            </div>
            {rivalries.map((r) => {
              const ahead = r.diff > 0;
              return (
                <div key={r.country} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", marginBottom: 6,
                  borderRadius: "var(--r-sm)",
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.06)",
                }}>
                  <Flag country={r.country} size={18} round style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                    {r.country.replace(/-/g, " ")}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: ahead ? "var(--live)" : "var(--accent)" }}>
                    {ahead
                      ? `↑ ${fmtMoney(r.diff)} ahead`
                      : `↓ You're ${fmtMoney(-r.diff)} ahead`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Podium ─────────────────────────────────────────────────────────────────
function Podium({ top3, sortKey }: { top3: NationStats[]; sortKey: SortKey }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>
        🏆 Top Nations
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {top3.map((nation, i) => (
          <div key={nation.country} style={{
            padding: "16px 8px 14px",
            borderRadius: "var(--r-md)",
            border: `1px solid ${M_BORDER[i]}`,
            background: M_BG[i],
            boxShadow: M_GLOW[i],
            textAlign: "center",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            <div style={{ fontSize: 24, lineHeight: 1 }}>{MEDAL[i]}</div>
            <Flag country={nation.country} size={36} round />
            <div style={{
              fontSize: 11, fontWeight: 900, lineHeight: 1.2,
              color: M_COLOR[i],
              wordBreak: "break-word",
            }}>
              {nation.country.replace(/-/g, " ")}
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
              {sortLabel(sortKey, nation)}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>
              {n(nation.memberCount)} {nation.memberCount === 1 ? "fan" : "fans"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Highlights strip ───────────────────────────────────────────────────────
function Highlights({ h }: { h: NationLeaguesPayload["highlights"] }) {
  const cards = [
    h.mostManagers && { icon: "👥", label: "Largest Fanbase", nation: h.mostManagers, val: `${n(h.mostManagers.memberCount)} fans` },
    h.topBankroll && { icon: "💰", label: "Wealthiest Nation", nation: h.topBankroll, val: fmtMoney(h.topBankroll.avgBankroll) },
    h.topPts && { icon: "⚡", label: "Sharpest Nation", nation: h.topPts, val: `${n(h.topPts.avgPts)} avg pts` },
    h.mostH2H && { icon: "⚔️", label: "Most H2H Wins", nation: h.mostH2H, val: `${h.mostH2H.h2hWins}W` },
  ].filter(Boolean) as Array<{ icon: string; label: string; nation: NationStats; val: string }>;

  if (cards.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>
        Nation Highlights
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {cards.map((c) => (
          <div key={c.label} style={{
            padding: "12px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
              {c.label}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <Flag country={c.nation.country} size={13} round />
              <span style={{ fontSize: 12, fontWeight: 800 }}>{c.nation.country.replace(/-/g, " ")}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "var(--accent)" }}>{c.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Member row ─────────────────────────────────────────────────────────────
function MemberRow({ m }: { m: NationMemberRow }) {
  const medalClass = m.rank <= 3 ? " " + ["gold", "silver", "bronze"][m.rank - 1] : "";
  return (
    <div className={"lb-row" + (m.isYou ? " you" : "")}>
      <div className={"lb-rank" + medalClass}>
        {m.rank <= 3 ? <span className="medal">{m.rank}</span> : n(m.rank)}
      </div>
      <div className="lb-av">{m.managerName.charAt(0)}</div>
      <div className="lb-id">
        <div className="lb-name">
          {m.teamName}
          {m.isYou && <span className="you-pill">YOU</span>}
        </div>
        <div className="lb-mgr">{m.managerName}</div>
      </div>
      <div style={{ textAlign: "right", marginLeft: "auto", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {fmtMoney(m.bankroll)}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-3)" }}>{n(m.pts)} pts</div>
      </div>
    </div>
  );
}

// ── Nation row (accordion) ─────────────────────────────────────────────────
function NationRow({
  nation,
  rank,
  isYours,
  sortKey,
  preloaded,
}: {
  nation: NationStats;
  rank: number;
  isYours: boolean;
  sortKey: SortKey;
  preloaded?: NationMemberRow[];
}) {
  const [expanded, setExpanded] = useState(isYours);
  const [members, setMembers] = useState<NationMemberRow[] | null>(preloaded ?? null);
  const [loading, startLoad] = useTransition();

  const isTop3 = rank <= 3;
  const borderColor = isYours
    ? "rgba(24,224,138,.35)"
    : isTop3 ? M_BORDER[rank - 1] : "var(--line)";
  const bgColor = isYours
    ? "rgba(24,224,138,.04)"
    : isTop3 ? M_BG[rank - 1] : "var(--surface)";

  function toggle() {
    if (!expanded && members === null) {
      startLoad(async () => {
        const rows = await loadNationMembers(nation.country);
        setMembers(rows);
        setExpanded(true);
      });
    } else {
      setExpanded((v) => !v);
    }
  }

  return (
    <div style={{
      borderRadius: "var(--r-md)",
      border: `1px solid ${borderColor}`,
      background: bgColor,
      overflow: "hidden",
      transition: "border-color .15s",
    }}>
      <button
        onClick={toggle}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          gap: 10, padding: "12px 14px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        {/* Rank */}
        <div style={{
          width: 26, flexShrink: 0, textAlign: "center",
          fontSize: isTop3 ? 20 : 13, fontWeight: 800,
          color: isTop3 ? M_COLOR[rank - 1] : "var(--text-3)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {isTop3 ? MEDAL[rank - 1] : rank}
        </div>

        <Flag country={nation.country} size={22} round style={{ flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {nation.country.replace(/-/g, " ")}
            {isYours && (
              <span style={{
                fontSize: 10, fontWeight: 900, padding: "2px 6px",
                borderRadius: 999, background: "rgba(24,224,138,.18)",
                color: "var(--accent)", letterSpacing: ".04em",
              }}>YOU</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
            {n(nation.memberCount)} {nation.memberCount === 1 ? "manager" : "managers"}
            {nation.h2hTotal > 0 && ` · ${nation.h2hWins}W-${nation.h2hLosses}L`}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0, marginRight: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {sortLabel(sortKey, nation)}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)" }}>
            {sortKey === "bankroll" ? "avg bank" : sortKey === "pts" ? "avg pts" : "members"}
          </div>
        </div>

        <div style={{
          color: "var(--text-3)", fontSize: 11, flexShrink: 0,
          transition: "transform .2s",
          transform: expanded ? "rotate(180deg)" : "none",
        }}>▾</div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--line)", background: "var(--surface-2)" }}>
          {loading ? (
            <div style={{ padding: "14px", textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
              Loading…
            </div>
          ) : members && members.length > 0 ? (
            <div className="lb-list" style={{ maxHeight: "none", overflow: "visible" }}>
              {members.map((m) => <MemberRow key={m.userId} m={m} />)}
            </div>
          ) : (
            <div style={{ padding: "14px", fontSize: 13, color: "var(--text-3)" }}>
              No managers yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty state teaser ─────────────────────────────────────────────────────
function EmptyTeaser({ allCountries, onPick, isPending }: {
  allCountries: string[];
  onPick: (c: string) => void;
  isPending: boolean;
}) {
  const preview = allCountries.slice(0, 12);
  return (
    <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {preview.map((c) => (
          <button
            key={c}
            disabled={isPending}
            onClick={() => onPick(c)}
            title={c}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
          >
            <Flag country={c} size={26} round />
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-3)" }}>
        Pick a nation above to join the competition
      </div>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────
export function NationsClient({
  payload,
  preloadedMembers,
  gameweekId: _gw,
  userId,
}: {
  payload: NationLeaguesPayload;
  preloadedMembers: NationMemberRow[];
  gameweekId: string;
  userId: string;
}) {
  const router = useRouter();
  const [picking, startPick] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("bankroll");

  const sorted = sortedNations(payload.nations, sortKey);
  const top3 = sorted.slice(0, 3);
  const hasNation = !!payload.myNation;

  function handlePick(country: string) {
    startPick(async () => {
      await setSupportedNation(country);
      setShowPicker(false);
      router.refresh();
    });
  }

  if (showPicker || !hasNation) {
    return (
      <div className="screen">
        <div className="screen-head">
          <h1>Nations</h1>
          <div className="sub">{payload.gameweekLabel}</div>
        </div>

        <NationPicker
          allCountries={payload.allCountries}
          onPick={handlePick}
          isPending={picking}
          onCancel={hasNation ? () => setShowPicker(false) : undefined}
          canCancel={hasNation}
        />

        {/* Teaser: show top nations even before picking */}
        {payload.nations.length >= 3 && (
          <div style={{ marginTop: 24 }}>
            <Podium top3={top3} sortKey="bankroll" />
          </div>
        )}

        {payload.nations.length === 0 && (
          <EmptyTeaser
            allCountries={payload.allCountries}
            onPick={handlePick}
            isPending={picking}
          />
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Nations</h1>
        <div className="sub">
          {payload.gameweekLabel}
          {payload.totalManagers > 0 && ` · ${n(payload.totalManagers)} managers`}
        </div>
      </div>

      {/* Your nation hero */}
      {payload.myStats && (
        <YourNationHero
          stats={payload.myStats}
          rivalries={payload.rivalries}
          onChangeNation={() => setShowPicker(true)}
        />
      )}

      {/* Highlights */}
      <Highlights h={payload.highlights} />

      {/* Sort tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(["bankroll", "pts", "managers"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSortKey(k)}
            style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${sortKey === k ? "var(--accent)" : "var(--line)"}`,
              background: sortKey === k ? "rgba(24,224,138,.12)" : "var(--surface)",
              color: sortKey === k ? "var(--accent)" : "var(--text-2)",
              transition: "border-color .12s, background .12s",
            }}
          >
            {k === "bankroll" ? "Avg Bankroll" : k === "pts" ? "Avg Points" : "Managers"}
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 14 }}>
          No nations yet — be the first to rally a fanbase!
        </div>
      )}

      {/* Podium */}
      {top3.length >= 3 && <Podium top3={top3} sortKey={sortKey} />}

      {/* Nation list */}
      {sorted.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>
            {n(sorted.length)} Nations
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.map((nation) => (
              <NationRow
                key={nation.country}
                nation={nation}
                rank={nation.nationRank}
                isYours={nation.country === payload.myNation}
                sortKey={sortKey}
                preloaded={nation.country === payload.myNation ? preloadedMembers : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
