"use client";

import { Flag } from "@/components/Flag";

export interface SquadFixtureItem {
  id: string;
  kickoffIso: string;
  home: string;
  away: string;
  homeTeamId: string;
  awayTeamId: string;
  players: {
    id: string;
    name: string;
    position: string;
    isHomeTeam: boolean;
    isCaptain: boolean;
    isVice: boolean;
  }[];
}

const lastName = (n: string) => n.split(" ").slice(-1)[0];

export function SquadFixtures({ fixtures }: { fixtures: SquadFixtureItem[] }) {
  if (fixtures.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div className="section-title">Upcoming Squad Fixtures</div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {fixtures.map((f, i) => {
          const kickoff = new Date(f.kickoffIso);
          const dateStr = kickoff.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          const timeStr = kickoff.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const homePlayers = f.players.filter((p) => p.isHomeTeam);
          const awayPlayers = f.players.filter((p) => !p.isHomeTeam);

          return (
            <div
              key={f.id}
              style={{
                padding: "11px 16px",
                borderBottom: i < fixtures.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              {/* Match header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 7,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                  <Flag country={f.home} size={15} round />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.home.replace(/-/g, " ")}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, flexShrink: 0 }}>
                    vs
                  </span>
                  <Flag country={f.away} size={15} round />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.away.replace(/-/g, " ")}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    fontWeight: 600,
                    flexShrink: 0,
                    textAlign: "right",
                    lineHeight: 1.4,
                  }}
                >
                  {dateStr}
                  <br />
                  {timeStr}
                </div>
              </div>

              {/* Squad players — home side | divider | away side */}
              {f.players.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                  {homePlayers.map((p) => (
                    <PlayerPill key={p.id} player={p} />
                  ))}
                  {homePlayers.length > 0 && awayPlayers.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-3)",
                        margin: "0 2px",
                        fontWeight: 700,
                      }}
                    >
                      ·
                    </span>
                  )}
                  {awayPlayers.map((p) => (
                    <PlayerPill key={p.id} player={p} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerPill({
  player,
}: {
  player: SquadFixtureItem["players"][number];
}) {
  const isCap = player.isCaptain;
  const isVice = player.isVice;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: isCap
          ? "rgba(24,224,138,.15)"
          : isVice
          ? "rgba(255,197,61,.12)"
          : "var(--surface-3)",
        color: isCap ? "var(--accent)" : isVice ? "var(--gold)" : "var(--text-2)",
        border: `1px solid ${
          isCap
            ? "rgba(24,224,138,.3)"
            : isVice
            ? "rgba(255,197,61,.25)"
            : "var(--line)"
        }`,
      }}
    >
      {isCap && <span style={{ fontSize: 10 }}>⚡</span>}
      {isVice && !isCap && <span style={{ fontSize: 10 }}>V</span>}
      {lastName(player.name)}
      <span
        className={"pos pos-" + player.position}
        style={{ fontSize: 9, marginLeft: 2, opacity: 0.8 }}
      >
        {player.position}
      </span>
    </span>
  );
}
