"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "@/components/Flag";
import { Jersey } from "@/components/Jersey";
import { Icon } from "@/components/Icon";
import { PlayerProfileModal } from "@/components/PlayerProfileModal";
import { eventPoints } from "@/lib/scoring";

// ── Serialisable types (passed from the server component) ─────────────────────

export interface TeamDetail {
  id: string;
  name: string;
  country: string;
  logoUrl: string | null;
}

export interface FixtureDetail {
  id: string;
  kickoff: string; // ISO string
  status: string;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  round: string;
  homeTeam: TeamDetail;
  awayTeam: TeamDetail;
}

export interface MatchEventData {
  id: string;
  teamId: string;
  playerApiId: number | null;
  playerName: string;
  assistApiId: number | null;
  assistName: string | null;
  minute: number;
  extraMinute: number | null;
  type: string;
  detail: string;
  comments: string | null;
  position: "GK" | "DEF" | "MID" | "FWD" | null; // for the fantasy-point chip
}

export interface MatchStatisticData {
  id: string;
  teamId: string;
  key: string;
  value: string;
}

export interface PlayerEventSummary {
  goals: number;
  assists: number;
  yellow: boolean;
  red: boolean;
  subbed: boolean; // came off / on
}

export interface MatchLineupData {
  id: string;
  teamId: string;
  formation: string | null;
  playerApiId: number;
  playerName: string;
  playerNumber: number | null;
  pos: string | null;
  grid: string | null;
  isSubstitute: boolean;
  ourId: string | null; // our Player.id (null = not in our pool → not clickable)
  events: PlayerEventSummary; // goal/assist/card/sub badges for this player
}

export interface MatchStatsData {
  events: MatchEventData[];
  statistics: MatchStatisticData[];
  lineups: MatchLineupData[];
}

export interface HaulEntry {
  playerId: string;
  name: string;
  country: string;
  pts: number;
  isCaptain: boolean;
}

export interface YourHaul {
  entries: HaulEntry[];
  total: number;
}

// ── Stat keys we display (in order) ──────────────────────────────────────────

const STAT_KEYS = [
  "Ball Possession",
  "Total Shots",
  "Shots on Goal",
  "Corner Kicks",
  "Fouls",
  "Offsides",
  "Yellow Cards",
  "Red Cards",
  "Goalkeeper Saves",
];

// ── Main component ────────────────────────────────────────────────────────────

export function FixtureStatsClient({
  fixture: f,
  stats,
  haul,
}: {
  fixture: FixtureDetail;
  stats: MatchStatsData | null;
  haul: YourHaul | null;
}) {
  const [tab, setTab] = useState<"stats" | "events" | "lineups">("stats");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isFinished = f.status === "FINISHED";
  const kickoff = new Date(f.kickoff);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-10">
      {/* ← Back */}
      <div className="pt-6 pb-4">
        <Link
          href="/fixtures"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--text-3)" }}
        >
          <span style={{ fontSize: 16 }}>←</span> Fixtures
        </Link>
      </div>

      {/* ── Stadium hero ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--line)",
          background: "linear-gradient(160deg, #0a1e14 0%, #0d1826 45%, #0a1220 100%)",
        }}
      >
        {/* pitch lines overlay */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 50% 60%, rgba(24,224,138,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="relative px-6 py-8">
          {/* Round + status badge */}
          <div className="mb-5 flex items-center justify-between">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
              style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-3)" }}
            >
              {f.round}
            </span>
            {isFinished ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: "rgba(24,224,138,0.15)", color: "var(--accent)" }}
              >
                Full Time
              </span>
            ) : f.status === "LIVE" ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: "rgba(255,77,94,0.18)", color: "var(--live)" }}
              >
                Live
              </span>
            ) : null}
          </div>

          {/* Teams + score */}
          <div className="flex items-center justify-between gap-4">
            {/* Home team */}
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
              <Flag country={f.homeTeam.country} size={40} round />
              <div
                className="font-[family-name:var(--font-display)] text-sm font-extrabold leading-tight"
                style={{ color: "var(--text)" }}
              >
                {f.homeTeam.name}
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-1 px-2">
              {isFinished || f.status === "LIVE" ? (
                <div
                  className="font-[family-name:var(--font-display)] tabular-nums"
                  style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: "#fff" }}
                >
                  {f.homeScore ?? 0}
                  <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 6px" }}>:</span>
                  {f.awayScore ?? 0}
                </div>
              ) : (
                <div
                  className="font-[family-name:var(--font-display)] text-2xl font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  vs
                </div>
              )}
              <div className="text-xs" style={{ color: "var(--text-3)" }}>
                {kickoff.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </div>
            </div>

            {/* Away team */}
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
              <Flag country={f.awayTeam.country} size={40} round />
              <div
                className="font-[family-name:var(--font-display)] text-sm font-extrabold leading-tight"
                style={{ color: "var(--text)" }}
              >
                {f.awayTeam.name}
              </div>
            </div>
          </div>

          {/* Venue */}
          {f.venue && (
            <p className="mt-5 text-center text-xs" style={{ color: "var(--text-3)" }}>
              📍 {f.venue}
            </p>
          )}
        </div>
      </div>

      {/* ── Your haul ────────────────────────────────────────────────────── */}
      {haul && haul.entries.length > 0 && (
        <div
          className="mt-4 overflow-hidden rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}
            >
              ⚡ Your haul
            </span>
            <span
              className="font-[family-name:var(--font-display)] text-sm font-extrabold"
              style={{ color: "var(--accent)" }}
            >
              +{haul.total} pts
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {haul.entries.map((e) => (
              <div
                key={e.playerId}
                className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
                style={{
                  background: "var(--surface-2)",
                  borderColor: e.isCaptain ? "var(--accent)" : "var(--line)",
                }}
              >
                <Flag country={e.country} size={14} round />
                <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {e.isCaptain ? `© ${e.name}` : e.name}
                </span>
                <span
                  className="font-[family-name:var(--font-display)] text-xs font-bold"
                  style={{
                    color: e.pts >= 8 ? "var(--accent)" : e.pts <= 1 ? "var(--text-3)" : "var(--text-2)",
                  }}
                >
                  {e.pts >= 0 ? `+${e.pts}` : e.pts}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      {isFinished && (
        <div className="mt-5">
          <div
            className="flex gap-1 rounded-xl border p-1"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            {(["stats", "events", "lineups"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors"
                style={{
                  background: tab === t ? "var(--surface-2)" : "transparent",
                  color: tab === t ? "var(--text)" : "var(--text-3)",
                  border: tab === t ? "1px solid var(--line)" : "1px solid transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {stats === null ? (
              <EmptyStats />
            ) : tab === "stats" ? (
              <StatsTab stats={stats.statistics} homeTeamId={f.homeTeam.id} awayTeamId={f.awayTeam.id} />
            ) : tab === "events" ? (
              <EventsTab
                events={stats.events}
                homeTeam={f.homeTeam}
                awayTeam={f.awayTeam}
              />
            ) : (
              <LineupsTab
                lineups={stats.lineups}
                homeTeam={f.homeTeam}
                awayTeam={f.awayTeam}
                onPlayerClick={setSelectedId}
              />
            )}
          </div>
        </div>
      )}

      {selectedId && (
        <PlayerProfileModal playerId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </main>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyStats() {
  return (
    <div
      className="rounded-2xl border py-12 text-center"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="text-2xl mb-2">📊</div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>
        Stats not available yet
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
        Match stats sync after the game is completed
      </p>
    </div>
  );
}

// ── Stats tab: comparison bars ────────────────────────────────────────────────

function StatsTab({
  stats,
  homeTeamId,
  awayTeamId,
}: {
  stats: MatchStatisticData[];
  homeTeamId: string;
  awayTeamId: string;
}) {
  const homeMap = new Map(
    stats.filter((s) => s.teamId === homeTeamId).map((s) => [s.key, s.value]),
  );
  const awayMap = new Map(
    stats.filter((s) => s.teamId === awayTeamId).map((s) => [s.key, s.value]),
  );

  const keys = STAT_KEYS.filter((k) => homeMap.has(k) || awayMap.has(k));

  if (keys.length === 0) return <EmptyStats />;

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {keys.map((key, i) => {
        const hRaw = homeMap.get(key) ?? "0";
        const aRaw = awayMap.get(key) ?? "0";
        const hNum = parseStatValue(hRaw);
        const aNum = parseStatValue(aRaw);
        const total = hNum + aNum;
        const hPct = total > 0 ? (hNum / total) * 100 : 50;
        const aIsPossession = key === "Ball Possession";
        const hPossession = aIsPossession ? parseFloat(hRaw) : hPct;
        const aPossession = aIsPossession ? parseFloat(aRaw) : 100 - hPct;

        return (
          <div
            key={key}
            className="px-5 py-4"
            style={{
              borderBottom: i < keys.length - 1 ? "1px solid var(--line)" : undefined,
            }}
          >
            {/* Values + label */}
            <div className="mb-2 flex items-baseline justify-between">
              <span
                className="font-[family-name:var(--font-display)] text-lg font-extrabold tabular-nums"
                style={{ color: "var(--text)" }}
              >
                {hRaw}
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>
                {key}
              </span>
              <span
                className="font-[family-name:var(--font-display)] text-lg font-extrabold tabular-nums"
                style={{ color: "var(--text)" }}
              >
                {aRaw}
              </span>
            </div>

            {/* Dual bar */}
            <div className="flex h-1.5 overflow-hidden rounded-full">
              <div
                style={{
                  width: `${hPossession}%`,
                  background: "var(--accent)",
                  borderRadius: "9999px 0 0 9999px",
                  transition: "width 0.4s ease",
                }}
              />
              <div
                style={{
                  width: `${aPossession}%`,
                  background: "var(--blue)",
                  borderRadius: "0 9999px 9999px 0",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseStatValue(v: string): number {
  const n = parseFloat(v.replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

// ── Events tab ────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, string> = {
  Goal: "⚽",
  Card: "🟨",
  subst: "🔄",
  Var: "📺",
};

function cardColor(detail: string): string {
  if (detail.toLowerCase().includes("red")) return "#FF4D5E";
  return "#FFC53D";
}

function EventsTab({
  events,
  homeTeam,
  awayTeam,
}: {
  events: MatchEventData[];
  homeTeam: TeamDetail;
  awayTeam: TeamDetail;
}) {
  if (events.length === 0) return <EmptyStats />;

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {events.map((ev, i) => {
        const isHome = ev.teamId === homeTeam.id;
        const team = isHome ? homeTeam : awayTeam;
        const icon = ev.type === "Card"
          ? <span style={{ color: cardColor(ev.detail), fontSize: 14 }}>■</span>
          : <span style={{ fontSize: 14 }}>{EVENT_ICON[ev.type] ?? "•"}</span>;

        const minuteLabel = ev.extraMinute
          ? `${ev.minute}+${ev.extraMinute}'`
          : `${ev.minute}'`;

        return (
          <div
            key={ev.id}
            className="flex items-start gap-3 px-4 py-3"
            style={{
              borderBottom: i < events.length - 1 ? "1px solid var(--line)" : undefined,
              flexDirection: isHome ? "row" : "row-reverse",
            }}
          >
            {/* Minute */}
            <span
              className="w-10 flex-shrink-0 text-center font-[family-name:var(--font-display)] text-xs font-bold tabular-nums"
              style={{ color: "var(--text-3)", paddingTop: 2 }}
            >
              {minuteLabel}
            </span>

            {/* Event body */}
            <div
              className={`flex flex-1 items-start gap-2 ${isHome ? "" : "flex-row-reverse text-right"}`}
            >
              <div className="flex-shrink-0 pt-0.5">{icon}</div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Flag country={team.country} size={12} round />
                  <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {ev.playerName}
                  </span>
                  {(() => {
                    const pts = eventPoints(ev.type, ev.detail, ev.position);
                    if (pts == null || pts === 0) return null;
                    return (
                      <span
                        className="num rounded px-1.5 text-[11px] font-extrabold"
                        style={{
                          background: pts > 0 ? "rgba(24,224,138,0.16)" : "rgba(255,77,94,0.16)",
                          color: pts > 0 ? "var(--accent)" : "var(--live)",
                        }}
                        title="Fantasy points from this event"
                      >
                        {pts > 0 ? `+${pts}` : pts}
                      </span>
                    );
                  })()}
                </div>
                {ev.assistName && (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    {ev.type === "subst" ? `→ ${ev.assistName}` : `assist: ${ev.assistName}`}
                  </p>
                )}
                {ev.detail && ev.type !== "Goal" && (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    {ev.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lineups tab ───────────────────────────────────────────────────────────────

function LineupsTab({
  lineups,
  homeTeam,
  awayTeam,
  onPlayerClick,
}: {
  lineups: MatchLineupData[];
  homeTeam: TeamDetail;
  awayTeam: TeamDetail;
  onPlayerClick: (ourId: string) => void;
}) {
  if (lineups.length === 0) return <EmptyStats />;

  const homeLineup = lineups.filter((l) => l.teamId === homeTeam.id);
  const awayLineup = lineups.filter((l) => l.teamId === awayTeam.id);

  return (
    <div className="flex flex-col gap-4">
      {/* Two pitches side by side on desktop, stacked on mobile. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LineupCard lineup={homeLineup} team={homeTeam} onPlayerClick={onPlayerClick} />
        <LineupCard lineup={awayLineup} team={awayTeam} onPlayerClick={onPlayerClick} />
      </div>
    </div>
  );
}

function LineupCard({
  lineup,
  team,
  onPlayerClick,
}: {
  lineup: MatchLineupData[];
  team: TeamDetail;
  onPlayerClick: (ourId: string) => void;
}) {
  const formation = lineup[0]?.formation ?? null;
  const starters = lineup.filter((p) => !p.isSubstitute);
  const bench = lineup.filter((p) => p.isSubstitute);
  const rows = groupByRow(starters);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {/* Team header */}
      <div className="flex items-center gap-2.5 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
        <Flag country={team.country} size={20} round />
        <span className="font-[family-name:var(--font-display)] text-sm font-bold" style={{ color: "var(--text)" }}>
          {team.name}
        </span>
        {formation && (
          <span className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>
            {formation}
          </span>
        )}
      </div>

      {/* Pitch — reuses the real .pitch/.slot styling from the home/My Team pitch */}
      {rows.length > 0 && (
        <div className="pitch lineup-pitch">
          <LineupPitchBg />
          <div className="pitch-rows">
            {rows.map((row, ri) => (
              <div key={ri} className="pitch-row">
                {row.map((p) => (
                  <PlayerToken key={p.id} player={p} country={team.country} onClick={onPlayerClick} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bench (clickable list) */}
      {bench.length > 0 && (
        <div className="border-t px-4 py-4" style={{ borderColor: "var(--line)" }}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
            Bench
          </p>
          <div className="flex flex-wrap gap-2">
            {bench.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!p.ourId}
                onClick={() => p.ourId && onPlayerClick(p.ourId)}
                className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition-colors"
                style={{ background: "var(--surface-2)", borderColor: "var(--line)", cursor: p.ourId ? "pointer" : "default" }}
              >
                <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{p.playerName}</span>
                <EventBadges ev={p.events} inline />
                {p.pos && (
                  <span className="rounded px-1 text-[10px] font-bold uppercase" style={{ background: posColor(p.pos) + "22", color: posColor(p.pos) }}>
                    {p.pos}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// A single pitch token: real .slot styling + jersey + name, with event badges.
function PlayerToken({ player: p, country, onClick }: { player: MatchLineupData; country: string; onClick: (id: string) => void }) {
  const last = p.playerName.split(" ").slice(-1)[0];
  return (
    <button
      type="button"
      disabled={!p.ourId}
      onClick={() => p.ourId && onClick(p.ourId)}
      className="slot"
      style={{ background: "none", cursor: p.ourId ? "pointer" : "default" }}
      title={p.ourId ? `View ${p.playerName}` : p.playerName}
    >
      <EventBadges ev={p.events} />
      <div className="slot-jersey"><Jersey country={country} size={42} /></div>
      <div className="slot-name">{last}</div>
    </button>
  );
}

// Goal / assist / card / sub icons for a player. On the pitch they stack in the
// top-right of the jersey; inline (bench) they sit after the name.
function EventBadges({ ev, inline }: { ev: PlayerEventSummary; inline?: boolean }) {
  const badges: React.ReactNode[] = [];
  for (let i = 0; i < ev.goals; i++) badges.push(<span key={"g" + i} className="ev-badge ev-goal" title="Goal">⚽</span>);
  if (ev.assists > 0) badges.push(<span key="a" className="ev-badge ev-assist" title={`${ev.assists} assist${ev.assists > 1 ? "s" : ""}`}>🅰{ev.assists > 1 ? ev.assists : ""}</span>);
  if (ev.yellow) badges.push(<span key="y" className="ev-badge ev-yellow" title="Yellow card" />);
  if (ev.red) badges.push(<span key="r" className="ev-badge ev-red" title="Red card" />);
  if (ev.subbed) badges.push(<span key="s" className="ev-badge ev-sub" title="Substituted"><Icon name="swap" size={9} /></span>);
  if (badges.length === 0) return null;
  return <span className={inline ? "ev-badges inline" : "ev-badges"}>{badges}</span>;
}

function LineupPitchBg() {
  return (
    <svg className="pitch-lines" viewBox="0 0 300 380" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }}>
      <rect x={6} y={6} width={288} height={368} rx={6} fill="none" stroke="var(--pitch-line)" strokeWidth={1.5} />
      <line x1={6} y1={190} x2={294} y2={190} stroke="var(--pitch-line)" strokeWidth={1.2} />
      <circle cx={150} cy={190} r={42} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
      <circle cx={150} cy={190} r={2.5} fill="var(--pitch-line)" />
      <rect x={95} y={6} width={110} height={46} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
      <rect x={95} y={328} width={110} height={46} fill="none" stroke="var(--pitch-line)" strokeWidth={1.2} />
    </svg>
  );
}

function posColor(pos: string): string {
  switch (pos) {
    case "G": return "var(--gold)";
    case "D": return "var(--blue)";
    case "M": return "var(--accent)";
    case "F": return "var(--purple)";
    default: return "var(--text-3)";
  }
}

// Order pos letters into pitch rows. Prefer the grid "row:col"; fall back to the
// pos letter (G→DEF→MID→FWD) when grid is missing (our simulated lineups have no grid).
const POS_ROW: Record<string, number> = { G: 1, D: 2, M: 3, F: 4 };
function groupByRow(starters: MatchLineupData[]): MatchLineupData[][] {
  const hasGrid = starters.some((p) => p.grid);
  const rows = new Map<number, MatchLineupData[]>();
  for (const p of starters) {
    const row = hasGrid
      ? (p.grid ? parseInt(p.grid.split(":")[0], 10) : 99)
      : (p.pos ? POS_ROW[p.pos] ?? 99 : 99);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(p);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, players]) =>
      players.sort((a, b) => {
        const ac = a.grid ? parseInt(a.grid.split(":")[1], 10) : 0;
        const bc = b.grid ? parseInt(b.grid.split(":")[1], 10) : 0;
        return ac - bc;
      }),
    );
}
