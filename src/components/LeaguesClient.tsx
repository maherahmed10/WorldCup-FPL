"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { createLeague, joinLeague, type ActionResult } from "@/app/(app)/leagues/actions";
import { sortLeagueStandings } from "@/lib/leagues";

// ── Types (serialisable — passed from server component) ─────────────────────

export interface LeagueMemberRow {
  userId: string;
  name: string;
  gwPoints: number;
  totalPoints: number;
}

export interface LeagueData {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  members: LeagueMemberRow[];
  isOwner: boolean;
}

interface Props {
  leagues: LeagueData[];
  userId: string | null;
}

// ── Main component ───────────────────────────────────────────────────────────

export function LeaguesClient({ leagues: initialLeagues, userId }: Props) {
  const [leagues, setLeagues] = useState(initialLeagues);
  const [activeId, setActiveId] = useState(initialLeagues[0]?.id ?? null);
  const [view, setView] = useState<"total" | "gw">("total");
  const [modal, setModal] = useState<"create" | "join" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Update leagues list when server revalidates (new league added via action)
  useEffect(() => {
    setLeagues(initialLeagues);
    if (initialLeagues.length && !initialLeagues.find((l) => l.id === activeId)) {
      setActiveId(initialLeagues[0].id);
    }
  }, [initialLeagues]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleDone = (newLeague?: LeagueData) => {
    setModal(null);
    if (newLeague) {
      setLeagues((prev) => [...prev, newLeague]);
      setActiveId(newLeague.id);
    }
  };

  const active = leagues.find((l) => l.id === activeId) ?? leagues[0] ?? null;
  const sorted = active ? sortLeagueStandings(active.members) : [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-[family-name:var(--font-display)] text-3xl font-extrabold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Leagues
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
            Compete with friends and the world.
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--line-2)", color: "var(--text-2)" }}
            onClick={() => setModal("join")}
          >
            + Join
          </button>
          <button
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            onClick={() => setModal("create")}
          >
            🏆 Create League
          </button>
        </div>
      </div>

      {/* League tabs */}
      {leagues.length === 0 ? (
        <EmptyState onJoin={() => setModal("join")} onCreate={() => setModal("create")} />
      ) : (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {leagues.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                className="flex min-w-0 flex-shrink-0 flex-col rounded-xl border px-4 py-3 text-left transition-colors"
                style={{
                  borderColor: l.id === activeId ? "var(--accent)" : "var(--line)",
                  background: l.id === activeId ? "var(--surface-2)" : "var(--surface)",
                }}
              >
                <span className="truncate text-sm font-semibold">{l.name}</span>
                <span className="text-xs" style={{ color: "var(--text-3)" }}>
                  {l.memberCount} member{l.memberCount !== 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>

          {active && (
            <>
              {/* League bar */}
              <div
                className="mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                style={{ background: "var(--surface)", borderColor: "var(--line)" }}
              >
                <div className="flex items-center gap-3">
                  {active.joinCode && (
                    <>
                      <span className="text-xs" style={{ color: "var(--text-3)" }}>
                        Code:{" "}
                        <strong className="font-mono" style={{ color: "var(--text)" }}>
                          {active.joinCode}
                        </strong>
                      </span>
                      <button
                        className="rounded-lg border px-2 py-1 text-xs transition-colors hover:bg-white/5"
                        style={{ borderColor: "var(--line-2)", color: "var(--text-2)" }}
                        onClick={() => {
                          navigator.clipboard.writeText(active.joinCode);
                          showToast("Invite code copied!");
                        }}
                      >
                        Copy invite
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-3)" }}>
                  {(["total", "gw"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                      style={{
                        background: view === v ? "var(--surface-hi)" : "transparent",
                        color: view === v ? "var(--text)" : "var(--text-3)",
                      }}
                    >
                      {v === "total" ? "Overall" : "This round"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Standings table */}
              <StandingsTable rows={sorted} view={view} currentUserId={userId} />
            </>
          )}
        </>
      )}

      {/* Modals */}
      {modal === "create" && (
        <LeagueModal
          mode="create"
          onClose={() => setModal(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setModal(null);
          }}
        />
      )}
      {modal === "join" && (
        <LeagueModal
          mode="join"
          onClose={() => setModal(null)}
          onSuccess={(msg) => {
            showToast(msg);
            setModal(null);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg"
          style={{ background: "var(--accent)", color: "var(--accent-ink)", zIndex: 100 }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

// ── Standings table ──────────────────────────────────────────────────────────

function StandingsTable({
  rows,
  view,
  currentUserId,
}: {
  rows: LeagueMemberRow[];
  view: "total" | "gw";
  currentUserId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--text-3)" }}>
        No members yet.
      </p>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {/* Head */}
      <div
        className="grid grid-cols-[40px_1fr_72px_72px] gap-2 border-b px-4 py-2 text-xs font-semibold uppercase"
        style={{ color: "var(--text-3)", borderColor: "var(--line)" }}
      >
        <span>#</span>
        <span>Manager</span>
        <span className="text-right">{view === "gw" ? "Round" : "GW"}</span>
        <span className="text-right">{view === "gw" ? "Round pts" : "Total"}</span>
      </div>
      {rows.map((row, i) => {
        const isYou = row.userId === currentUserId;
        return (
          <div
            key={row.userId}
            className="grid grid-cols-[40px_1fr_72px_72px] items-center gap-2 border-b px-4 py-3 last:border-b-0"
            style={{
              borderColor: "var(--line)",
              background: isYou ? "rgba(24,224,138,0.06)" : undefined,
            }}
          >
            <span
              className="font-[family-name:var(--font-display)] text-sm font-bold tabular-nums"
              style={{ color: "var(--text-3)" }}
            >
              {i + 1}
            </span>
            <span>
              <div className="flex items-center gap-2">
                <div
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{ background: "var(--surface-3)", color: "var(--text)" }}
                >
                  {row.name[0]?.toUpperCase()}
                </div>
                <span className="truncate text-sm font-medium">
                  {row.name}
                  {isYou && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                    >
                      You
                    </span>
                  )}
                </span>
              </div>
            </span>
            <span
              className="text-right font-[family-name:var(--font-display)] text-sm tabular-nums"
              style={{ color: "var(--text-2)" }}
            >
              +{row.gwPoints}
            </span>
            <span
              className="text-right font-[family-name:var(--font-display)] text-sm font-bold tabular-nums"
            >
              {view === "gw" ? `+${row.gwPoints}` : row.totalPoints}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  onJoin,
  onCreate,
}: {
  onJoin: () => void;
  onCreate: () => void;
}) {
  return (
    <div
      className="rounded-2xl border py-14 text-center"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="mb-3 text-4xl">🏆</div>
      <h2
        className="mb-1 font-[family-name:var(--font-display)] text-lg font-bold"
      >
        No leagues yet
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-2)" }}>
        Create your own or join a friend's mini-league.
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={onJoin}
          className="rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
          style={{ borderColor: "var(--line-2)", color: "var(--text-2)" }}
        >
          Join with code
        </button>
        <button
          onClick={onCreate}
          className="rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          Create a league
        </button>
      </div>
    </div>
  );
}

// ── Create / Join modal ──────────────────────────────────────────────────────

function LeagueModal({
  mode,
  onClose,
  onSuccess,
}: {
  mode: "create" | "join";
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const isCreate = mode === "create";
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    isCreate ? createLeague : joinLeague,
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state && "success" in state) {
      onSuccess(state.message);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{ background: "var(--surface-2)", borderColor: "var(--line-2)" }}
      >
        <h2
          className="mb-1 font-[family-name:var(--font-display)] text-xl font-bold"
        >
          {isCreate ? "Create a League" : "Join a League"}
        </h2>
        <p className="mb-5 text-sm" style={{ color: "var(--text-2)" }}>
          {isCreate
            ? "Name your league. We'll generate a join code to share with friends."
            : "Enter the invite code your friend shared."}
        </p>

        <form action={formAction}>
          <label className="mb-1.5 block text-xs font-semibold uppercase" style={{ color: "var(--text-3)" }}>
            {isCreate ? "League name" : "Invite code"}
          </label>
          <input
            ref={inputRef}
            name={isCreate ? "name" : "code"}
            required
            placeholder={isCreate ? "e.g. Sunday League Legends" : "GAF-XXXX"}
            className="mb-4 w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            style={{ borderColor: "var(--line-2)", color: "var(--text)" }}
          />
          {state && "error" in state && (
            <p className="mb-3 text-sm" style={{ color: "var(--live)" }}>
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--line-2)", color: "var(--text-2)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              {pending ? "..." : isCreate ? "Create League" : "Join League"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
