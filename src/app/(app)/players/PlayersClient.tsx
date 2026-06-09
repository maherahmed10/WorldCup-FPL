"use client";

// Client shell for the Players market: holds the filter state, runs the pure
// filter/sort, and renders the list. Data is fetched server-side and passed in.

import { useMemo, useState } from "react";
import {
  DEFAULT_FILTER,
  filterAndSortPlayers,
  type PlayerFilter,
  type PlayerView,
} from "@/lib/players";
import { FilterBar } from "@/components/FilterBar";
import { PlayerRow } from "@/components/PlayerRow";
import { PlayerProfileModal } from "@/components/PlayerProfileModal";

export function PlayersClient({ players }: { players: PlayerView[] }) {
  const [filter, setFilter] = useState<PlayerFilter>(DEFAULT_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const countries = useMemo(
    () => Array.from(new Set(players.map((p) => p.country))).sort((a, b) => a.localeCompare(b)),
    [players],
  );

  const list = useMemo(() => filterAndSortPlayers(players, filter), [players, filter]);

  const patch = (p: Partial<PlayerFilter>) => setFilter((f) => ({ ...f, ...p }));

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Players</h1>
        <div className="sub">
          {players.length} players · scout the market by points, form and price
        </div>
      </div>

      <FilterBar filter={filter} onChange={patch} countries={countries} />

      {list.length === 0 ? (
        <div
          className="mt-5 rounded-2xl border p-8 text-center text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--text-2)" }}
        >
          <div className="text-lg font-bold" style={{ color: "var(--text)" }}>
            No players found
          </div>
          <p className="mt-1">Try widening the price range or clearing a filter.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-1.5">
            {list.map((p) => (
              <div
                key={p.id}
                className="mrow clickable"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(p.id);
                  }
                }}
              >
                <PlayerRow p={p} variant="market" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs" style={{ color: "var(--text-3)" }}>
            Showing {list.length} of {players.length}
          </p>
        </>
      )}

      {selectedId && (
        <PlayerProfileModal playerId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
