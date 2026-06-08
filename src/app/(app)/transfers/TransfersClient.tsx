"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TRANSFERS_PER_WINDOW } from "@/lib/squad-rules";
import { saveTransfers } from "./actions";

export interface TransferPlayer {
  id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  price: number;
  country: string;
}

export interface TransferSquadState {
  playerId: string;
  isStarting: boolean;
}

export function TransfersClient({
  pool,
  initialSquad,
  captainId: initialCaptainId,
  transfersUsed,
  extraTransferCount,
  gameweekLabel,
}: {
  pool: TransferPlayer[];
  initialSquad: TransferSquadState[];
  captainId: string | null;
  transfersUsed: number;
  extraTransferCount: number;
  gameweekLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const playerById = new Map<string, TransferPlayer>(pool.map((p) => [p.id, p]));

  const [squadIds, setSquadIds] = useState<string[]>(initialSquad.map((s) => s.playerId));
  const originalIds = new Set(initialSquad.map((s) => s.playerId));

  const [swapTarget, setSwapTarget] = useState<string | null>(null); // player being replaced
  const [filter, setFilter] = useState("");

  const transferLimit = TRANSFERS_PER_WINDOW + extraTransferCount;
  const changedCount = squadIds.filter((id) => !originalIds.has(id)).length;
  const remaining = transferLimit - transfersUsed - changedCount;

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function pickReplacement(newPlayerId: string) {
    if (!swapTarget) return;
    setSquadIds((prev) => prev.map((id) => (id === swapTarget ? newPlayerId : id)));
    setSwapTarget(null);
    setFilter("");
  }

  function save() {
    startTransition(async () => {
      const res = await saveTransfers(squadIds, initialCaptainId);
      if (res.ok) {
        router.refresh();
        showToast("Transfers saved!", true);
      } else {
        showToast(res.error, false);
      }
    });
  }

  const swapTargetPlayer = swapTarget ? playerById.get(swapTarget) : null;

  // Available replacements: correct position, not already in squad, matches filter
  const replacements = swapTargetPlayer
    ? pool.filter(
        (p) =>
          p.position === swapTargetPlayer.position &&
          !squadIds.includes(p.id) &&
          (filter === "" ||
            p.name.toLowerCase().includes(filter.toLowerCase()) ||
            p.country.toLowerCase().includes(filter.toLowerCase())),
      )
    : [];

  const POS_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const squadPlayers = squadIds
    .map((id) => playerById.get(id))
    .filter(Boolean) as TransferPlayer[];
  const sortedSquad = [...squadPlayers].sort(
    (a, b) => POS_ORDER[a.position] - POS_ORDER[b.position],
  );

  const POS_LABEL: Record<string, string> = {
    GK: "Goalkeeper",
    DEF: "Defenders",
    MID: "Midfielders",
    FWD: "Forwards",
  };

  const groups = ["GK", "DEF", "MID", "FWD"].map((pos) => ({
    pos,
    label: POS_LABEL[pos],
    players: sortedSquad.filter((p) => p.position === pos),
  }));

  return (
    <div className="screen">
      {/* Header */}
      <div className="screen-head head-row">
        <div>
          <h1>Transfers</h1>
          <div className="sub">{gameweekLabel}</div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl border px-3 py-1.5 text-center"
            style={{ background: "var(--surface)", borderColor: changedCount > 0 ? "var(--accent)" : "var(--line-2)" }}
          >
            <div
              className="num text-lg font-extrabold"
              style={{ color: remaining < 0 ? "var(--live)" : remaining === 0 ? "var(--gold)" : "var(--accent)" }}
            >
              {remaining}
            </div>
            <div className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>
              left
            </div>
          </div>
          <button
            disabled={pending || changedCount === 0}
            onClick={save}
            className="btn btn-primary"
            style={{ opacity: changedCount === 0 ? 0.4 : 1 }}
          >
            {pending ? "Saving…" : `Save${changedCount > 0 ? ` (${changedCount})` : ""}`}
          </button>
        </div>
      </div>

      {/* Transfer allowance banner */}
      <div
        className="mb-4 rounded-2xl border px-4 py-3 text-sm"
        style={{ background: "var(--surface)", borderColor: "var(--line-2)" }}
      >
        <span style={{ color: "var(--text-2)" }}>
          {transfersUsed} of {transferLimit} transfers used this window
          {extraTransferCount > 0 && (
            <span style={{ color: "var(--gold)" }}> (+{extraTransferCount} from store)</span>
          )}
          {changedCount > 0 && (
            <span style={{ color: "var(--accent)" }}>
              {" "}· {changedCount} pending
            </span>
          )}
        </span>
      </div>

      {/* Squad list */}
      <div className="flex flex-col gap-4">
        {groups.map(({ pos, label, players }) => (
          <div key={pos}>
            <div
              className="mb-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}
            >
              {label}
            </div>
            <div className="flex flex-col gap-1.5">
              {players.map((p) => {
                const isNew = !originalIds.has(p.id);
                const isTarget = swapTarget === p.id;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                    style={{
                      background: isNew ? "rgba(24,224,138,0.07)" : "var(--surface)",
                      borderColor: isNew
                        ? "var(--accent)"
                        : isTarget
                        ? "var(--gold)"
                        : "var(--line)",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={"pos pos-" + p.position}
                        style={{ flexShrink: 0 }}
                      >
                        {p.position}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{p.name}</div>
                        <div className="text-xs" style={{ color: "var(--text-3)" }}>
                          {p.country} · £{(p.price / 10).toFixed(1)}m
                        </div>
                      </div>
                      {isNew && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: "rgba(24,224,138,0.18)", color: "var(--accent)" }}
                        >
                          IN
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (swapTarget === p.id) {
                          setSwapTarget(null);
                        } else {
                          setSwapTarget(p.id);
                          setFilter("");
                        }
                      }}
                      disabled={remaining <= 0 && !isNew}
                      className="ml-3 shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity disabled:opacity-30"
                      style={{
                        background: isTarget ? "var(--gold)" : "var(--surface-3)",
                        color: isTarget ? "#000" : "var(--text-2)",
                      }}
                    >
                      {isTarget ? "Cancel" : "Swap"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Swap picker */}
      {swapTarget && swapTargetPlayer && (
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--gold)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold" style={{ color: "var(--gold)" }}>
              Replace {swapTargetPlayer.name}
            </div>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              {swapTargetPlayer.position} · {replacements.length} available
            </span>
          </div>
          <input
            className="mb-3 w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--line-2)", color: "var(--text)" }}
            placeholder="Search by name or country…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
            {replacements.length === 0 ? (
              <div className="py-4 text-center text-sm" style={{ color: "var(--text-3)" }}>
                No players found
              </div>
            ) : (
              replacements.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickReplacement(p.id)}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:opacity-80"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className={"pos pos-" + p.position}>{p.position}</span>
                    <div>
                      <div className="text-sm font-bold">{p.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-3)" }}>
                        {p.country}
                      </div>
                    </div>
                  </div>
                  <div className="num text-sm font-bold" style={{ color: "var(--accent)" }}>
                    £{(p.price / 10).toFixed(1)}m
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lg"
          style={{
            background: "var(--surface-3)",
            borderColor: toast.ok ? "var(--accent)" : "var(--live)",
            color: "var(--text)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
