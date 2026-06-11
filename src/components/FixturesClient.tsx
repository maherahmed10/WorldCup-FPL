"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sortGroupStandings, type GroupStandings } from "@/lib/leagues";
import { Icon } from "@/components/Icon";

// Group fixtures into chronological day buckets for the date separators.
function groupByDay(fixtures: FixtureData[]): Array<{ key: string; label: string; fixtures: FixtureData[] }> {
  const byKey = new Map<string, { key: string; label: string; fixtures: FixtureData[] }>();
  for (const f of [...fixtures].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))) {
    const d = new Date(f.kickoff);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const label = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    if (!byKey.has(key)) byKey.set(key, { key, label, fixtures: [] });
    byKey.get(key)!.fixtures.push(f);
  }
  return [...byKey.values()];
}

// ── Serialisable types passed from the server component ──────────────────────

export interface TeamData {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface FixtureData {
  id: string;
  kickoff: string; // ISO string
  status: string; // "SCHEDULED" | "LIVE" | "FINISHED" | …
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: TeamData;
  awayTeam: TeamData;
}

export interface GameweekData {
  id: string;
  label: string;
  roundType: string;
  startsAt: string; // ISO string
  deadline: string; // ISO string
  isKnockout: boolean;
  fixtures: FixtureData[];
}

interface Props {
  gameweeks: GameweekData[];
  groupStandings: GroupStandings[];
}

// ── Main component ────────────────────────────────────────────────────────────

export function FixturesClient({ gameweeks, groupStandings }: Props) {
  const [activeLabel, setActiveLabel] = useState(gameweeks[0]?.label ?? "");

  const active = gameweeks.find((gw) => gw.label === activeLabel) ?? gameweeks[0];
  const isGroupStage = active?.roundType === "GROUP";
  const dayGroups = useMemo(() => groupByDay(active?.fixtures ?? []), [active]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-display)] text-3xl font-extrabold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Fixtures
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
          World Cup 2026 · USA · Canada · Mexico
        </p>
      </div>

      {/* Round tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {gameweeks.map((gw) => (
          <button
            key={gw.label}
            onClick={() => setActiveLabel(gw.label)}
            className="flex-shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: gw.label === activeLabel ? "var(--accent)" : "var(--line)",
              background: gw.label === activeLabel ? "var(--surface-2)" : "var(--surface)",
              color: gw.label === activeLabel ? "var(--accent)" : "var(--text-2)",
            }}
          >
            {gw.label}
          </button>
        ))}
      </div>

      {active ? (
        <>
          {/* Deadline chip */}
          <p className="mb-4 text-xs" style={{ color: "var(--text-3)" }}>
            <span
              className="mr-2 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: "var(--surface-2)" }}
            >
              {active.fixtures.length === 0
                ? active.isKnockout ? "Teams TBD" : "TBD"
                : `${active.fixtures.length} match${active.fixtures.length !== 1 ? "es" : ""}`}
            </span>
            Deadline:{" "}
            {new Date(active.deadline).toLocaleString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            local time
          </p>

          {/* Fixture list */}
          {active.fixtures.length === 0 ? (
            <div
              className="rounded-2xl border px-6 py-10 text-center"
              style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            >
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "var(--surface-2)", color: "var(--text-3)" }}
              >
                <Icon name={active.isKnockout ? "trophy" : "fixtures"} size={22} />
              </div>
              <div className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>
                {active.isKnockout ? "To be decided" : "No fixtures scheduled yet"}
              </div>
              <p className="mx-auto mt-1 max-w-sm text-xs" style={{ color: "var(--text-3)" }}>
                {active.isKnockout
                  ? "The teams for this round are set once the previous round is played. Fixtures appear here as soon as they're confirmed."
                  : "Fixtures for this round haven't been published yet — check back soon."}
              </p>
            </div>
          ) : (
            <div
              className="mb-6 overflow-hidden rounded-2xl border"
              style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            >
              {dayGroups.map((g, gi) => (
                <Fragment key={g.key}>
                  <div className="fx-date-sep">{g.label}</div>
                  {g.fixtures.map((f, i) => (
                    <FixtureRow
                      key={f.id}
                      fixture={f}
                      // divider between rows in a day, and before the next day's header
                      divider={i < g.fixtures.length - 1 || gi < dayGroups.length - 1}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          )}

          {/* Group standings (shown on all group-stage rounds) */}
          {isGroupStage && groupStandings.length > 0 && (
            <>
              <h2
                className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold"
                style={{ letterSpacing: "-0.02em" }}
              >
                Group Standings
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {groupStandings.map((group) => (
                  <GroupTable key={group.label} group={group} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="py-10 text-center text-sm" style={{ color: "var(--text-3)" }}>
          No fixtures data available.
        </p>
      )}
    </main>
  );
}

// ── Fixture row ───────────────────────────────────────────────────────────────

function FixtureRow({ fixture: f, divider }: { fixture: FixtureData; divider: boolean }) {
  const isLive = f.status === "LIVE";
  const isFinished = f.status === "FINISHED";
  const kickoff = new Date(f.kickoff);
  const router = useRouter();

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      onClick={isFinished ? () => router.push(`/fixtures/${f.id}`) : undefined}
      style={{
        borderBottom: divider ? "1px solid var(--line)" : undefined,
        background: isLive ? "rgba(255,77,94,0.05)" : undefined,
        cursor: isFinished ? "pointer" : undefined,
      }}
    >
      {/* Time / status */}
      <div
        className="w-14 flex-shrink-0 text-center"
        style={{ color: "var(--text-3)" }}
      >
        {isLive ? (
          <span className="flex items-center justify-center gap-1 text-xs font-bold" style={{ color: "var(--live)" }}>
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--live)", animation: "pulse 1.5s infinite" }}
            />
            LIVE
          </span>
        ) : isFinished ? (
          <span className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>FT</span>
        ) : (
          <span className="text-xs">
            <div>
              {kickoff.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <div className="font-semibold" style={{ color: "var(--text-2)" }}>
              {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div className="flex flex-1 items-center gap-2">
        {/* Home */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="truncate text-sm font-semibold">{f.homeTeam.name}</span>
          {f.homeTeam.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.homeTeam.logoUrl} alt="" className="h-6 w-6 flex-shrink-0 object-contain" />
          )}
        </div>

        {/* Score or vs */}
        <div
          className="w-14 flex-shrink-0 text-center font-[family-name:var(--font-display)] font-bold tabular-nums"
          style={{ fontSize: 15 }}
        >
          {isLive || isFinished ? (
            <span>
              {f.homeScore ?? 0} : {f.awayScore ?? 0}
            </span>
          ) : (
            <span className="text-sm font-normal" style={{ color: "var(--text-3)" }}>
              v
            </span>
          )}
        </div>

        {/* Away */}
        <div className="flex flex-1 items-center gap-2">
          {f.awayTeam.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.awayTeam.logoUrl} alt="" className="h-6 w-6 flex-shrink-0 object-contain" />
          )}
          <span className="truncate text-sm font-semibold">{f.awayTeam.name}</span>
        </div>
      </div>

      {/* Venue / chevron */}
      <div className="hidden w-32 flex-shrink-0 sm:flex items-center justify-end gap-1">
        {f.venue && (
          <span
            className="truncate text-xs"
            style={{ color: "var(--text-3)" }}
          >
            {f.venue}
          </span>
        )}
        {isFinished && (
          <span style={{ color: "var(--text-3)", fontSize: 12 }}>›</span>
        )}
      </div>
    </div>
  );
}

// ── Group standings table ─────────────────────────────────────────────────────

function GroupTable({ group }: { group: GroupStandings }) {
  const sorted = sortGroupStandings(group.rows);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div
        className="border-b px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-bold"
        style={{ borderColor: "var(--line)", color: "var(--accent)" }}
      >
        {group.label}
      </div>
      {/* Head */}
      <div
        className="grid grid-cols-[24px_1fr_28px_28px_28px_28px_36px_36px] gap-1 border-b px-3 py-1.5 text-xs font-semibold uppercase"
        style={{ color: "var(--text-3)", borderColor: "var(--line)" }}
      >
        <span>#</span>
        <span>Team</span>
        <span className="text-right">P</span>
        <span className="text-right">W</span>
        <span className="text-right">D</span>
        <span className="text-right">L</span>
        <span className="text-right">GD</span>
        <span className="text-right">Pts</span>
      </div>
      {sorted.map((row, i) => {
        const gd = row.goalsFor - row.goalsAgainst;
        const isQualified = i < 2;
        return (
          <div
            key={row.teamId}
            className="grid grid-cols-[24px_1fr_28px_28px_28px_28px_36px_36px] items-center gap-1 border-b px-3 py-2 last:border-b-0 text-sm"
            style={{
              borderColor: "var(--line)",
              background: isQualified ? "rgba(24,224,138,0.04)" : undefined,
            }}
          >
            <span
              className="font-[family-name:var(--font-display)] text-xs tabular-nums"
              style={{ color: isQualified ? "var(--accent)" : "var(--text-3)" }}
            >
              {i + 1}
            </span>
            <span className="flex items-center gap-1.5 truncate">
              {row.teamName}
            </span>
            <span className="text-right tabular-nums" style={{ color: "var(--text-2)" }}>{row.played}</span>
            <span className="text-right tabular-nums" style={{ color: "var(--text-2)" }}>{row.won}</span>
            <span className="text-right tabular-nums" style={{ color: "var(--text-2)" }}>{row.drawn}</span>
            <span className="text-right tabular-nums" style={{ color: "var(--text-2)" }}>{row.lost}</span>
            <span className="text-right tabular-nums" style={{ color: "var(--text-2)" }}>
              {gd >= 0 ? `+${gd}` : gd}
            </span>
            <span
              className="text-right font-[family-name:var(--font-display)] font-bold tabular-nums"
            >
              {row.points}
            </span>
          </div>
        );
      })}
    </div>
  );
}
