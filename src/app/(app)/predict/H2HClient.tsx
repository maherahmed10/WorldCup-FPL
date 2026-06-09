"use client";

// H2H tab — shows incoming challenges, active rivalries, and history.
// Challenges are created from the "My Bets" tab (Challenge button on each open bet).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToH2HChallenge, cancelH2HChallenge } from "./h2h-actions";

export interface H2HChallengeView {
  id: string;
  creatorId: string;
  opponentId: string;
  fixtureId: string;
  selection: string;
  multiplier: number;
  pickLabel: string;
  stake: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SETTLED" | "CANCELLED";
  winnerId: string | null;
  createdAt: string;
  creator: { id: string; name: string };
  opponent: { id: string; name: string };
  fixture: { home: string; away: string };
}

function fmt(n: number) {
  return `£${n.toLocaleString("en-GB")}`;
}

function statusTone(s: H2HChallengeView["status"]) {
  if (s === "ACCEPTED") return "var(--accent)";
  if (s === "SETTLED") return "var(--gold)";
  if (s === "REJECTED" || s === "CANCELLED") return "var(--text-3)";
  return "var(--gold)"; // PENDING
}

// ─────────────────────────────────────────────────────────────────────────────

export function H2HClient({
  challenges,
  userId,
}: {
  challenges: H2HChallengeView[];
  userId: string;
}) {
  const incoming = challenges.filter((c) => c.opponentId === userId && c.status === "PENDING");
  const pending  = challenges.filter((c) => c.creatorId  === userId && c.status === "PENDING");
  const active   = challenges.filter((c) => c.status === "ACCEPTED");
  const history  = challenges.filter(
    (c) => c.status === "SETTLED" || c.status === "REJECTED" || c.status === "CANCELLED",
  );

  if (challenges.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border p-8 text-center" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <div className="text-lg font-bold">No Head-to-Head challenges yet</div>
        <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
          Go to <strong>My Bets</strong>, open any open bet, and tap{" "}
          <strong>Challenge a Friend</strong> to invite a league member.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      {incoming.length > 0 && (
        <Section title={`Incoming (${incoming.length})`} accent="var(--live)">
          {incoming.map((c) => <IncomingCard key={c.id} c={c} />)}
        </Section>
      )}
      {active.length > 0 && (
        <Section title="Active Rivalries" accent="var(--accent)">
          {active.map((c) => <ActiveCard key={c.id} c={c} userId={userId} />)}
        </Section>
      )}
      {pending.length > 0 && (
        <Section title="Pending (awaiting response)" accent="var(--gold)">
          {pending.map((c) => <PendingCard key={c.id} c={c} />)}
        </Section>
      )}
      {history.length > 0 && (
        <Section title="History" accent="var(--text-3)">
          {history.map((c) => <HistoryCard key={c.id} c={c} userId={userId} />)}
        </Section>
      )}
    </div>
  );
}

// ─── cards ────────────────────────────────────────────────────────────────────

function IncomingCard({ c }: { c: H2HChallengeView }) {
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function respond(accept: boolean) {
    setErr(null);
    startTransition(async () => {
      const res = await respondToH2HChallenge(c.id, accept);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border p-4 mb-2" style={{ background: "var(--surface)", borderColor: "var(--live)", borderLeft: "3px solid var(--live)" }}>
      <div className="text-xs font-bold mb-0.5" style={{ color: "var(--text-3)" }}>
        {c.creator.name} challenged you · {c.fixture.home} v {c.fixture.away}
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-extrabold">{c.pickLabel}</span>
        <span className="num text-sm" style={{ color: "var(--accent)" }}>{c.multiplier.toFixed(2)}x</span>
      </div>
      <div className="text-xs mb-3" style={{ color: "var(--text-2)" }}>
        Your stake if accepted: <span className="num font-bold">{fmt(c.stake)}</span>
        {" · "}Pot: <span className="num font-bold" style={{ color: "var(--gold)" }}>{fmt(c.stake * 2)}</span>
      </div>
      {err && <div className="mb-2 text-xs rounded px-2 py-1" style={{ background: "rgba(255,77,94,0.12)", color: "var(--live)" }}>{err}</div>}
      <div className="flex gap-2">
        <button onClick={() => respond(false)} disabled={busy}
          className="flex-1 rounded-xl py-2 text-sm font-bold border transition-opacity disabled:opacity-50"
          style={{ borderColor: "var(--line)", color: "var(--text-2)" }}>
          Reject
        </button>
        <button onClick={() => respond(true)} disabled={busy}
          className="flex-1 rounded-xl py-2 text-sm font-extrabold transition-opacity disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
          {busy ? "…" : `Accept · Lock ${fmt(c.stake)}`}
        </button>
      </div>
    </div>
  );
}

function PendingCard({ c }: { c: H2HChallengeView }) {
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function cancel() {
    setErr(null);
    startTransition(async () => {
      const res = await cancelH2HChallenge(c.id);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border p-4 mb-2" style={{ background: "var(--surface)", borderColor: "var(--gold)", borderLeft: "3px solid var(--gold)" }}>
      <div className="text-xs font-bold mb-0.5" style={{ color: "var(--text-3)" }}>
        vs {c.opponent.name} · {c.fixture.home} v {c.fixture.away}
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-extrabold">{c.pickLabel}</span>
        <span className="num text-sm" style={{ color: "var(--accent)" }}>{c.multiplier.toFixed(2)}x</span>
      </div>
      <div className="text-xs mb-3" style={{ color: "var(--text-2)" }}>
        Your stake locked: <span className="num font-bold" style={{ color: "var(--gold)" }}>{fmt(c.stake)}</span>
        {" · "}Awaiting response
      </div>
      {err && <div className="mb-2 text-xs rounded px-2 py-1" style={{ background: "rgba(255,77,94,0.12)", color: "var(--live)" }}>{err}</div>}
      <button onClick={cancel} disabled={busy}
        className="rounded-xl border px-4 py-1.5 text-xs font-bold transition-opacity disabled:opacity-50"
        style={{ borderColor: "var(--line)", color: "var(--text-3)" }}>
        {busy ? "…" : "Cancel & refund"}
      </button>
    </div>
  );
}

function ActiveCard({ c, userId }: { c: H2HChallengeView; userId: string }) {
  const isCreator = c.creatorId === userId;
  const opponent = isCreator ? c.opponent : c.creator;
  return (
    <div className="rounded-xl border p-4 mb-2" style={{ background: "var(--surface)", borderColor: "var(--accent)", borderLeft: "3px solid var(--accent)" }}>
      <div className="text-xs font-bold mb-0.5" style={{ color: "var(--text-3)" }}>
        vs {opponent.name} · {c.fixture.home} v {c.fixture.away}
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-extrabold">{c.pickLabel}</span>
        <span className="num text-sm" style={{ color: "var(--accent)" }}>{c.multiplier.toFixed(2)}x</span>
        {!isCreator && <span className="text-xs" style={{ color: "var(--text-3)" }}>(their pick — you took the other side)</span>}
      </div>
      <div className="flex gap-4 text-xs">
        <span style={{ color: "var(--text-3)" }}>Your stake <span className="num font-bold" style={{ color: "var(--text)" }}>{fmt(c.stake)}</span></span>
        <span style={{ color: "var(--text-3)" }}>Pot <span className="num font-bold" style={{ color: "var(--gold)" }}>{fmt(c.stake * 2)}</span></span>
      </div>
      <div className="mt-2 text-xs" style={{ color: "var(--accent)" }}>Settles automatically when the match finishes</div>
    </div>
  );
}

function HistoryCard({ c, userId }: { c: H2HChallengeView; userId: string }) {
  const isCreator = c.creatorId === userId;
  const opponent = isCreator ? c.opponent : c.creator;
  const tone = statusTone(c.status);
  const result =
    c.status === "SETTLED"
      ? c.winnerId === userId ? "Won ✓" : "Lost"
      : c.status === "REJECTED" ? "Rejected"
      : "Cancelled";

  return (
    <div className="rounded-xl border p-3 mb-2 flex items-center justify-between gap-3"
      style={{ background: "var(--surface)", borderColor: "var(--line)", borderLeft: `3px solid ${tone}` }}>
      <div className="min-w-0">
        <div className="text-xs" style={{ color: "var(--text-3)" }}>vs {opponent.name} · {c.fixture.home} v {c.fixture.away}</div>
        <div className="text-sm font-semibold">{c.pickLabel}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="num text-sm font-bold">{fmt(c.stake)}</div>
        <div className="text-xs font-bold" style={{ color: tone }}>{result}</div>
      </div>
    </div>
  );
}

// ─── shared layout ────────────────────────────────────────────────────────────

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <div style={{ width: 3, height: 16, background: accent, borderRadius: 9999 }} />
        <span className="text-sm font-bold" style={{ color: "var(--text-2)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
