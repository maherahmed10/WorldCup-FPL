"use client";

// Client wrapper around the dashboard Pitch: makes the player tokens clickable
// to open the full PlayerProfileModal (which shows the per-match point breakdown
// in its Matches tab). The team page is a server component, so the modal state
// lives here.
import { useState } from "react";
import { Pitch, type Slot, type PitchPlayer } from "@/components/Pitch";
import { PlayerProfileModal } from "@/components/PlayerProfileModal";
import type { Position } from "@/lib/squad-rules";

export function TeamPitch({
  rows,
  captainId,
  viceId,
  captain2Id,
  gwPoints,
}: {
  rows: Record<Position, Slot[]>;
  captainId?: string | null;
  viceId?: string | null;
  captain2Id?: string | null;
  gwPoints?: Record<string, number>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <Pitch
        rows={rows}
        captainId={captainId}
        viceId={viceId}
        captain2Id={captain2Id}
        mode="view"
        gwPoints={gwPoints}
        onSlot={(_pos, _i, player: PitchPlayer | null) => {
          if (player) setSelectedId(player.id);
        }}
      />
      {selectedId && (
        <PlayerProfileModal playerId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
