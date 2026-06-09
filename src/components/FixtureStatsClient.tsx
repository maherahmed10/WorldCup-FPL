"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "@/components/Flag";

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
}

export interface MatchStatisticData {
  id: string;
  teamId: string;
  key: string;
  value: string;
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
              />
            )}
          </div>
        </div>
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
}: {
  lineups: MatchLineupData[];
  homeTeam: TeamDetail;
  awayTeam: TeamDetail;
}) {
  if (lineups.length === 0) return <EmptyStats />;

  const homeLineup = lineups.filter((l) => l.teamId === homeTeam.id);
  const awayLineup = lineups.filter((l) => l.teamId === awayTeam.id);

  return (
    <div className="flex flex-col gap-4">
      <LineupCard lineup={homeLineup} team={homeTeam} />
      <LineupCard lineup={awayLineup} team={awayTeam} />
    </div>
  );
}

function LineupCard({
  lineup,
  team,
}: {
  lineup: MatchLineupData[];
  team: TeamDetail;
}) {
  const formation = lineup[0]?.formation ?? null;
  const starters = lineup.filter((p) => !p.isSubstitute);
  const bench = lineup.filter((p) => p.isSubstitute);

  // Group starters by row (grid "row:col" — row 1 = GK, row 2 = DEF, etc.)
  const rows = groupByRow(starters);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {/* Team header */}
      <div
        className="flex items-center gap-2.5 border-b px-4 py-3"
        style={{ borderColor: "var(--line)" }}
      >
        <Flag country={team.country} size={20} round />
        <span className="font-[family-name:var(--font-display)] text-sm font-bold" style={{ color: "var(--text)" }}>
          {team.name}
        </span>
        {formation && (
          <span
            className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ background: "var(--surface-2)", color: "var(--accent)" }}
          >
            {formation}
          </span>
        )}
      </div>

      {/* Formation rows */}
      {rows.length > 0 && (
        <div className="px-4 py-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
            Starting XI
          </p>
          <div className="flex flex-col gap-3">
            {rows.map((row, ri) => (
              <div key={ri} className="flex flex-wrap justify-center gap-2">
                {row.map((p) => (
                  <PlayerChip key={p.id} player={p} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bench */}
      {bench.length > 0 && (
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--line)" }}
        >
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
            Bench
          </p>
          <div className="flex flex-wrap gap-2">
            {bench.map((p) => (
              <PlayerChip key={p.id} player={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerChip({ player: p }: { player: MatchLineupData }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
      style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
    >
      {p.playerNumber != null && (
        <span
          className="font-[family-name:var(--font-display)] text-xs font-bold tabular-nums"
          style={{ color: "var(--text-3)", minWidth: 14 }}
        >
          {p.playerNumber}
        </span>
      )}
      <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
        {p.playerName}
      </span>
      {p.pos && (
        <span
          className="rounded px-1 text-[10px] font-bold uppercase"
          style={{ background: posColor(p.pos) + "22", color: posColor(p.pos) }}
        >
          {p.pos}
        </span>
      )}
    </div>
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

function groupByRow(starters: MatchLineupData[]): MatchLineupData[][] {
  // Sort by grid row (e.g. "1:1", "2:1" → row 1, 2, ...), then by column.
  const rows = new Map<number, MatchLineupData[]>();
  for (const p of starters) {
    const row = p.grid ? parseInt(p.grid.split(":")[0], 10) : 99;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(p);
  }
  // Sort each row by column, then return rows sorted by row number.
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
