"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "@/components/Flag";
import { fmtMoney } from "@/lib/format";
import type { NationLeaguesPayload, NationMemberRow, NationStats, CountryTeamData, CountryFixtureRow, CountryPlayerRow } from "@/lib/nations";
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

// ── Shared label style ─────────────────────────────────────────────────────
const SEC: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
  textTransform: "uppercase", color: "var(--text-3)", marginBottom: 12,
};

function sectionLabel(title: string, sub?: string) {
  return (
    <div style={{ ...SEC, display: "flex", alignItems: "center", gap: 6 }}>
      {title}
      {sub && <span style={{ color: "var(--text-2)", fontWeight: 600, fontSize: 11, letterSpacing: 0, textTransform: "none" }}>{sub}</span>}
    </div>
  );
}

// ── Country schedule ───────────────────────────────────────────────────────
function CountrySchedule({ fixtures }: { fixtures: CountryFixtureRow[] }) {
  if (fixtures.length === 0) return null;
  const now = Date.now();
  const nextIdx = fixtures.findIndex(
    (f) => f.status === "SCHEDULED" && new Date(f.kickoff).getTime() > now,
  );

  return (
    <div style={{ marginBottom: 24 }}>
      {sectionLabel("Schedule")}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fixtures.map((f, i) => {
          const isNext = i === nextIdx;
          const finished = f.status === "FINISHED";
          const live = f.status === "LIVE";
          const myScore = f.isHome ? f.homeScore : f.awayScore;
          const theirScore = f.isHome ? f.awayScore : f.homeScore;
          const myTeam = f.isHome ? f.homeTeamName : f.awayTeamName;
          const opponent = f.isHome ? f.awayTeamName : f.homeTeamName;

          let result: "W" | "D" | "L" | null = null;
          if (finished && myScore != null && theirScore != null) {
            result = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
          }

          const stripe =
            result === "W" ? "#18E08A" :
            result === "L" ? "#FF4D5E" :
            result === "D" ? "rgba(255,255,255,.2)" :
            live ? "#FF4D5E" :
            isNext ? "#18E08A" : "transparent";

          return (
            <div
              key={f.id}
              style={{
                borderRadius: "var(--r-md)",
                border: `1px solid ${isNext ? "rgba(24,224,138,.28)" : "var(--line)"}`,
                background: isNext
                  ? "linear-gradient(135deg, rgba(24,224,138,.06) 0%, rgba(24,224,138,.02) 100%)"
                  : "var(--surface-2)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Result / status stripe on left */}
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                background: stripe, borderRadius: "2px 0 0 2px",
              }} />

              <div style={{ padding: "13px 14px 13px 17px" }}>
                {/* Meta row: date + badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: ".05em",
                    textTransform: "uppercase", color: "var(--text-3)",
                  }}>
                    {new Date(f.kickoff).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {result && (
                    <span style={{
                      fontSize: 10, fontWeight: 900, letterSpacing: ".06em",
                      color: stripe, background: `${stripe}22`,
                      padding: "2px 9px", borderRadius: 99,
                    }}>
                      {result}
                    </span>
                  )}
                  {isNext && (
                    <span style={{
                      fontSize: 9, fontWeight: 900, letterSpacing: ".06em",
                      color: "#18E08A", background: "rgba(24,224,138,.15)",
                      padding: "2px 9px", borderRadius: 99,
                    }}>
                      NEXT UP
                    </span>
                  )}
                  {live && (
                    <span style={{
                      fontSize: 9, fontWeight: 900, letterSpacing: ".06em",
                      color: "#FF4D5E", background: "rgba(255,77,94,.15)",
                      padding: "2px 9px", borderRadius: 99,
                    }}>
                      ● LIVE
                    </span>
                  )}
                </div>

                {/* Teams + score */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  {/* My team */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <Flag country={myTeam} size={36} round />
                    <div style={{
                      fontSize: 11, fontWeight: 800, textAlign: "center",
                      lineHeight: 1.2, maxWidth: 80,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {myTeam}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".04em" }}>
                      {f.isHome ? "HOME" : "AWAY"}
                    </div>
                  </div>

                  {/* Centre: score or time */}
                  <div style={{ width: 80, textAlign: "center", flexShrink: 0 }}>
                    {finished && myScore != null && theirScore != null ? (
                      <div style={{
                        fontSize: 28, fontWeight: 900, letterSpacing: "-.03em",
                        fontVariantNumeric: "tabular-nums",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                      }}>
                        <span style={{ color: result === "W" ? "#18E08A" : result === "L" ? "#FF4D5E" : "var(--text)" }}>
                          {myScore}
                        </span>
                        <span style={{ color: "var(--text-3)", fontSize: 20, fontWeight: 400 }}>–</span>
                        <span style={{ color: result === "L" ? "#18E08A" : result === "W" ? "#FF4D5E" : "var(--text)" }}>
                          {theirScore}
                        </span>
                      </div>
                    ) : live ? (
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#FF4D5E", letterSpacing: "-.02em" }}>
                          {myScore ?? 0}–{theirScore ?? 0}
                        </div>
                        <div style={{ fontSize: 9, color: "#FF4D5E", fontWeight: 800, marginTop: 2 }}>● LIVE</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-3)" }}>vs</div>
                        <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 700, marginTop: 3 }}>
                          {new Date(f.kickoff).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Opponent */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <Flag country={opponent} size={36} round />
                    <div style={{
                      fontSize: 11, fontWeight: 800, textAlign: "center",
                      lineHeight: 1.2, maxWidth: 80,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {opponent}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, letterSpacing: ".04em" }}>
                      {f.isHome ? "AWAY" : "HOME"}
                    </div>
                  </div>
                </div>

                {f.venue && (
                  <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-3)", textAlign: "center" }}>
                    📍 {f.venue}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Pitch view lineup ──────────────────────────────────────────────────────
function CountryLineup({ lineup }: { lineup: CountryTeamData["lastLineup"] }) {
  if (!lineup || lineup.starters.length === 0) return null;

  // Match the team page pitch dimensions exactly: 300 × 380 viewBox
  const PW = 300, PH = 380;

  type Placed = { playerApiId: number; playerName: string; playerNumber: number | null; pos: string | null; row: number; col: number };
  const placed: Placed[] = lineup.starters.map((p) => {
    if (p.grid) {
      const parts = p.grid.split(":");
      return { ...p, row: parseInt(parts[0], 10) || 1, col: parseInt(parts[1], 10) || 1 };
    }
    const posRow: Record<string, number> = { G: 1, D: 2, M: 3, F: 4 };
    return { ...p, row: posRow[p.pos ?? "F"] ?? 3, col: 1 };
  });

  const rowMap = new Map<number, Placed[]>();
  for (const p of placed) {
    const list = rowMap.get(p.row) ?? [];
    list.push(p);
    rowMap.set(p.row, list);
  }

  const rows = [...rowMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, players]) => [...players].sort((a, b) => a.col - b.col));

  const maxRow = rows.length;
  // GK near bottom goal, forwards near top goal
  const yTop = 44, yBottom = 334;

  const playerDots: Array<{ x: number; y: number; p: Placed }> = [];
  rows.forEach((rowPlayers, ri) => {
    const yFrac = maxRow <= 1 ? 1 : ri / (maxRow - 1);
    const y = yBottom - yFrac * (yBottom - yTop);
    const n = rowPlayers.length;
    const margin = 26;
    const step = n > 1 ? (PW - margin * 2) / (n - 1) : 0;
    rowPlayers.forEach((p, ci) => {
      const x = n === 1 ? PW / 2 : margin + ci * step;
      playerDots.push({ x, y, p });
    });
  });

  function lastName(name: string) {
    const parts = name.trim().split(" ");
    const last = parts[parts.length - 1];
    return last.length > 9 ? last.slice(0, 8) + "…" : last;
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {sectionLabel("Starting XI", lineup.formation ? `· ${lineup.formation}` : undefined)}
      <div style={{
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,.07)",
        boxShadow: "0 8px 32px rgba(0,0,0,.4)",
      }}>
        <svg viewBox={`0 0 ${PW} ${PH}`} style={{ width: "100%", display: "block" }}>
          <defs>
            <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1b4d31" />
              <stop offset="48%" stopColor="#215c3a" />
              <stop offset="100%" stopColor="#1b4d31" />
            </linearGradient>
            <pattern id="stripes" x="0" y="0" width="1" height={76 / PH} patternUnits="objectBoundingBox">
              <rect x="0" y="0" width="1" height="0.5" fill="rgba(255,255,255,.025)" />
              <rect x="0" y="0.5" width="1" height="0.5" fill="transparent" />
            </pattern>
          </defs>

          <rect width={PW} height={PH} fill="url(#pg)" />
          <rect width={PW} height={PH} fill="url(#stripes)" />

          {/* Outer boundary */}
          <rect x={6} y={6} width={PW - 12} height={PH - 12}
            fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.5} rx={4} />

          {/* Halfway line */}
          <line x1={6} y1={PH / 2} x2={PW - 6} y2={PH / 2}
            stroke="rgba(255,255,255,.22)" strokeWidth={1.2} />

          {/* Centre circle — mirrors the real Pitch.tsx */}
          <circle cx={PW / 2} cy={PH / 2} r={42}
            fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.2} />
          <circle cx={PW / 2} cy={PH / 2} r={2.5} fill="rgba(255,255,255,.35)" />

          {/* Top penalty area */}
          <rect x={95} y={6} width={110} height={46}
            fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.2} />
          <rect x={125} y={6} width={50} height={18}
            fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.2} />
          <rect x={127} y={1} width={46} height={7}
            fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.18)" strokeWidth={1} />

          {/* Bottom penalty area */}
          <rect x={95} y={PH - 52} width={110} height={46}
            fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.2} />
          <rect x={125} y={PH - 24} width={50} height={18}
            fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.2} />
          <rect x={127} y={PH - 8} width={46} height={7}
            fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.18)" strokeWidth={1} />

          {/* Players */}
          {playerDots.map(({ x, y, p }) => {
            const isGK = p.pos === "G" || p.row === 1;
            const fill = isGK ? "#F5C518" : "#18E08A";
            const textFill = isGK ? "#1a1500" : "#052014";
            return (
              <g key={p.playerApiId}>
                <circle cx={x} cy={y} r={16}
                  fill="none" stroke={`${fill}44`} strokeWidth={2.5} />
                <circle cx={x} cy={y} r={13} fill={fill} />
                <text x={x} y={y + 4.5} textAnchor="middle"
                  fontSize={10} fontWeight={900} fill={textFill}
                  style={{ userSelect: "none" }}>
                  {p.playerNumber ?? "·"}
                </text>
                <text x={x} y={y + 30} textAnchor="middle"
                  fontSize={9} fontWeight={800}
                  stroke="rgba(0,0,0,.75)" strokeWidth={2.5} paintOrder="stroke"
                  fill="rgba(255,255,255,.95)"
                  style={{ userSelect: "none" }}>
                  {lastName(p.playerName)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Bench strip */}
        {lineup.bench.length > 0 && (
          <div style={{
            background: "rgba(0,0,0,.35)",
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,.07)",
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: ".07em",
              textTransform: "uppercase", color: "rgba(255,255,255,.35)",
              marginBottom: 8,
            }}>
              Bench
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {lineup.bench.map((p) => (
                <div
                  key={p.playerApiId}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 9px", borderRadius: 99,
                    background: "rgba(255,255,255,.07)",
                    border: "1px solid rgba(255,255,255,.1)",
                    fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.65)",
                  }}
                >
                  {p.playerNumber != null && (
                    <span style={{ color: "rgba(255,255,255,.3)", fontSize: 9 }}>{p.playerNumber}</span>
                  )}
                  {p.playerName.split(" ").pop()}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Key players ────────────────────────────────────────────────────────────
function CountryPlayers({ players }: { players: CountryPlayerRow[] }) {
  if (players.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {sectionLabel("Key Players")}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {players.slice(0, 10).map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px",
              background: "var(--surface-2)", borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
            }}
          >
            <span className={`pos pos-${p.position}`} style={{ flexShrink: 0 }}>{p.position}</span>
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 700,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {p.name}
            </span>
            {(p.seasonGoals > 0 || p.seasonAssists > 0) && (
              <span style={{ fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap", flexShrink: 0 }}>
                {p.seasonGoals > 0 && `${p.seasonGoals}G`}
                {p.seasonGoals > 0 && p.seasonAssists > 0 && " "}
                {p.seasonAssists > 0 && `${p.seasonAssists}A`}
              </span>
            )}
            {p.seasonRating != null && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--gold)", flexShrink: 0 }}>
                {p.seasonRating.toFixed(1)}
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-2)", flexShrink: 0 }}>
              £{(p.price / 10).toFixed(1)}m
            </span>
          </div>
        ))}
      </div>
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
  countryData,
  gameweekId: _gw,
  userId,
}: {
  payload: NationLeaguesPayload;
  preloadedMembers: NationMemberRow[];
  countryData: CountryTeamData | null;
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

      {/* Country team detail */}
      {countryData && (
        <div style={{ marginBottom: 4 }}>
          <CountrySchedule fixtures={countryData.fixtures} />
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0, maxWidth: 360 }}>
              <CountryLineup lineup={countryData.lastLineup} />
            </div>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <CountryPlayers players={countryData.players} />
            </div>
          </div>
        </div>
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
