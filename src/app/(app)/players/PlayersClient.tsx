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
import { toggleFavourite } from "./actions";

export function PlayersClient({
  players,
  initialFavouriteIds = [],
}: {
  players: PlayerView[];
  initialFavouriteIds?: string[];
}) {
  const [filter, setFilter] = useState<PlayerFilter>(DEFAULT_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(
    () => new Set(initialFavouriteIds),
  );

  const countries = useMemo(
    () => Array.from(new Set(players.map((p) => p.country))).sort((a, b) => a.localeCompare(b)),
    [players],
  );

  const list = useMemo(
    () => filterAndSortPlayers(players, filter, favouriteIds),
    [players, filter, favouriteIds],
  );

  const patch = (p: Partial<PlayerFilter>) => setFilter((f) => ({ ...f, ...p }));

  function toggleFavouriteLocal(id: string) {
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toggleFavourite(id).catch(() => {
      // revert on failure
      setFavouriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    });
  }

  return (
    <div>
      <div className="mb-1">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Players</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
          {players.length} players · scout the market by points, form and price
        </p>
      </div>

      <FilterBar
        filter={filter}
        onChange={patch}
        countries={countries}
        showFavourites
      />

      {list.length === 0 ? (
        <div
          className="mt-5 rounded-2xl border p-8 text-center text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--text-2)" }}
        >
          <div className="text-lg font-bold" style={{ color: "var(--text)" }}>
            {filter.favouritesOnly && favouriteIds.size === 0
              ? "No favourites yet"
              : "No players found"}
          </div>
          <p className="mt-1">
            {filter.favouritesOnly && favouriteIds.size === 0
              ? "Heart a player to save them here for later."
              : "Try widening the price range or clearing a filter."}
          </p>
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
                <PlayerRow
                  p={p}
                  variant="market"
                  isFavourite={favouriteIds.has(p.id)}
                  onFavourite={() => toggleFavouriteLocal(p.id)}
                />
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
