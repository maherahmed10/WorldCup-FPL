"use client";

// Predictions screen (Lane 2). Markets tab = match cards with odd buttons that
// open a bet slip; My Bets tab = open + settled bets. Placing a bet calls the
// placeBet server action; the page revalidates with a fresh balance + bet list.
// Maps to design: screens_predict.jsx.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { potentialReturn, type MarketType } from "@/lib/betting";
import { Flag } from "@/components/Flag";
import { placeBet } from "./actions";

export interface MarketOptionView {
  name: string;
  selection: string;
  multiplier: number;
}
export interface MarketGroupView {
  marketType: MarketType;
  label: string;
  options: MarketOptionView[];
}
export interface FixtureMarketsView {
  fixtureId: string;
  home: TeamView;
  away: TeamView;
  time: string;
  groups: MarketGroupView[];
}
export interface TeamView {
  name: string;
  logoUrl: string | null;
}
export interface BetView {
  id: string;
  home: TeamView;
  away: TeamView;
  marketLabel: string;
  pick: string;
  stake: number;
  multiplier: number;
  status: "OPEN" | "WON" | "LOST" | "VOID";
  payout: number | null;
}

interface SlipState {
  fixtureId: string;
  home: TeamView;
  away: TeamView;
  marketType: MarketType;
  marketLabel: string;
  pick: string;
  selection: string;
  multiplier: number;
}

function MatchTitle({ home, away, size = 20 }: { home: TeamView; away: TeamView; size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Flag country={home.name} size={size} round />
      <span className="text-sm font-bold">
        {home.name} <span style={{ color: "var(--text-3)" }}>v</span> {away.name}
      </span>
      <Flag country={away.name} size={size} round />
    </div>
  );
}

export function PredictClient({
  markets,
  bets,
  balance,
}: {
  markets: FixtureMarketsView[];
  bets: BetView[];
  balance: number;
}) {
  const [tab, setTab] = useState<"markets" | "mybets">("markets");
  const [slip, setSlip] = useState<SlipState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const open = bets.filter((b) => b.status === "OPEN");
  const settled = bets.filter((b) => b.status !== "OPEN");

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Predictions</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
            Stake virtual points on match markets for bonus points. No real money.
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2"
          style={{ background: "var(--surface)", borderColor: "var(--line-2)" }}
        >
          <span style={{ color: "var(--gold)" }}>◎</span>
          <div className="text-right">
            <div className="num text-lg font-extrabold">{balance}</div>
            <div className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>
              points balance
            </div>
          </div>
        </div>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "markets", label: "Markets" },
          { value: "mybets", label: `My Bets${open.length ? ` (${open.length})` : ""}` },
        ]}
      />

      {tab === "markets" ? (
        <div className="mt-4 flex flex-col gap-3">
          {markets.length === 0 ? (
            <Empty title="No open markets" sub="Markets appear here for upcoming fixtures." />
          ) : (
            markets.map((m) => (
              <div
                key={m.fixtureId}
                className="rounded-2xl border p-4"
                style={{ background: "var(--surface)", borderColor: "var(--line)" }}
              >
                <div
                  className="mb-3 flex items-center justify-between border-b pb-3"
                  style={{ borderColor: "var(--line)" }}
                >
                  <MatchTitle home={m.home} away={m.away} />
                  <span className="text-[13px]" style={{ color: "var(--text-2)" }}>
                    {m.time}
                  </span>
                </div>
                {m.groups.map((g) => (
                  <div key={g.label} className="mb-3 last:mb-0">
                    <div className="mb-1.5 text-xs font-bold" style={{ color: "var(--text-3)" }}>
                      {g.label}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {g.options.map((o) => (
                        <button
                          key={o.selection}
                          onClick={() =>
                            setSlip({
                              fixtureId: m.fixtureId,
                              home: m.home,
                              away: m.away,
                              marketType: g.marketType,
                              marketLabel: g.label,
                              pick: o.name,
                              selection: o.selection,
                              multiplier: o.multiplier,
                            })
                          }
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-[var(--accent)]"
                          style={{ background: "var(--surface-2)", borderColor: "var(--line-2)" }}
                        >
                          <span className="truncate text-[13px] font-semibold">{o.name}</span>
                          <span className="num text-sm font-bold" style={{ color: "var(--accent)" }}>
                            {o.multiplier.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ) : (
        <MyBets open={open} settled={settled} />
      )}

      {slip && (
        <BetSlip
          slip={slip}
          balance={balance}
          onClose={() => setSlip(null)}
          onPlaced={(msg) => {
            setSlip(null);
            setToast(msg);
            setTimeout(() => setToast(null), 2600);
          }}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lg"
          style={{ background: "var(--surface-3)", borderColor: "var(--line-2)", color: "var(--text)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function BetSlip({
  slip,
  balance,
  onClose,
  onPlaced,
}: {
  slip: SlipState;
  balance: number;
  onClose: () => void;
  onPlaced: (msg: string) => void;
}) {
  const [stake, setStake] = useState(Math.min(50, balance));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const ret = potentialReturn(stake, slip.multiplier);
  const tooHigh = stake > balance;
  const valid = stake >= 1 && !tooHigh;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await placeBet({
        fixtureId: slip.fixtureId,
        marketType: slip.marketType,
        selection: slip.selection,
        multiplier: slip.multiplier,
        stake,
      });
      if (res.ok) {
        router.refresh();
        onPlaced(`Bet placed · ${stake} pts staked`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line-2)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-xl font-extrabold">Place Bet</h3>
          <button onClick={onClose} style={{ color: "var(--text-3)" }} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mb-3 flex justify-center">
          <MatchTitle home={slip.home} away={slip.away} size={18} />
        </div>

        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border p-3"
          style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
        >
          <div>
            <div className="text-xs" style={{ color: "var(--text-3)" }}>
              {slip.marketLabel}
            </div>
            <div className="text-base font-extrabold">{slip.pick}</div>
          </div>
          <span
            className="num rounded-full px-2.5 py-1 text-sm font-bold"
            style={{ background: "rgba(61,165,255,0.16)", color: "var(--blue)" }}
          >
            {slip.multiplier.toFixed(2)}
          </span>
        </div>

        <label className="mb-1.5 block text-xs font-bold" style={{ color: "var(--text-2)" }}>
          Stake (points)
        </label>
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
        >
          <span style={{ color: "var(--gold)" }}>◎</span>
          <input
            type="number"
            value={stake}
            min={1}
            max={balance}
            onChange={(e) => setStake(Math.max(0, Math.min(balance, Math.trunc(+e.target.value || 0))))}
            className="num w-full bg-transparent text-base font-bold outline-none"
            style={{ color: "var(--text)" }}
          />
        </div>
        <div className="mt-2 flex gap-2">
          {[25, 50, 100, balance].map((v, i) => (
            <button
              key={i}
              onClick={() => setStake(Math.min(balance, v))}
              className="num rounded-lg border px-3 py-1 text-[13px] font-bold"
              style={{ background: "var(--surface-2)", borderColor: "var(--line)", color: "var(--text-2)" }}
            >
              {i === 3 ? "Max" : v}
            </button>
          ))}
        </div>

        <div className="my-4 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-2)" }}>
              Potential return
            </span>
            <span className="num text-lg font-extrabold" style={{ color: "var(--accent)" }}>
              {ret}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-2)" }}>
              Profit
            </span>
            <span className="num font-bold">+{ret - stake}</span>
          </div>
        </div>

        {(tooHigh || error) && (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-sm"
            style={{ background: "rgba(255,77,94,0.12)", color: "var(--live)" }}
          >
            {error ?? "Stake exceeds your balance."}
          </div>
        )}

        <button
          disabled={!valid || pending}
          onClick={confirm}
          className="w-full rounded-xl py-3 text-sm font-extrabold transition-opacity disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {pending ? "Placing…" : `Confirm Bet · ${stake} pts`}
        </button>
      </div>
    </div>
  );
}

function MyBets({ open, settled }: { open: BetView[]; settled: BetView[] }) {
  if (!open.length && !settled.length) {
    return <Empty title="No bets yet" sub="Head to Markets and stake some points on an upcoming match." />;
  }
  return (
    <div className="mt-4">
      {open.length > 0 && (
        <>
          <div className="mb-2.5 text-sm font-bold" style={{ color: "var(--text-2)" }}>
            Open bets
          </div>
          {open.map((b) => (
            <BetRow key={b.id} b={b} />
          ))}
        </>
      )}
      {settled.length > 0 && (
        <>
          <div className="mb-2.5 mt-5 text-sm font-bold" style={{ color: "var(--text-2)" }}>
            Settled
          </div>
          {settled.map((b) => (
            <BetRow key={b.id} b={b} />
          ))}
        </>
      )}
    </div>
  );
}

function BetRow({ b }: { b: BetView }) {
  const accent =
    b.status === "WON" ? "var(--accent)" : b.status === "LOST" ? "var(--live)" : b.status === "VOID" ? "var(--text-3)" : "var(--gold)";
  return (
    <div
      className="mb-2 flex items-center justify-between gap-3 rounded-xl border p-3"
      style={{ background: "var(--surface)", borderColor: "var(--line)", borderLeft: `3px solid ${accent}` }}
    >
      <div className="min-w-0">
        <MatchTitle home={b.home} away={b.away} size={16} />
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="font-bold">{b.pick}</span>
          <span style={{ color: "var(--text-3)" }}>{b.marketLabel}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="num text-sm font-bold">
          {b.stake} <span style={{ color: "var(--text-3)" }}>@{b.multiplier.toFixed(2)}</span>
        </div>
        <div className="num text-[13px] font-bold" style={{ color: accent }}>
          {b.status === "OPEN"
            ? "Open"
            : b.status === "WON"
              ? `+${b.payout ?? 0}`
              : b.status === "VOID"
                ? "Void"
                : "Lost"}
        </div>
      </div>
    </div>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      className="mt-4 rounded-2xl border p-8 text-center"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="text-lg font-bold">{title}</div>
      <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
        {sub}
      </p>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div
      className="inline-flex rounded-xl border p-1"
      style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="rounded-lg px-4 py-1.5 text-sm font-bold transition-colors"
            style={{
              background: on ? "var(--accent)" : "transparent",
              color: on ? "var(--accent-ink)" : "var(--text-2)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
