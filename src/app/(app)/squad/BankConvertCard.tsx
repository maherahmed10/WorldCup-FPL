"use client";

// Shown in the squad page after the group stage ends.
// Lets the user convert some or all of their betting bank into squad budget.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { allocateBankToSquad } from "./actions";
import { fmtMoney, fmtPrice } from "@/lib/format";

const STEP = 100_000; // minimum conversion unit = £100k = 0.1M budget

export function BankConvertCard({
  bettingBalance,
  currentBonus,
}: {
  bettingBalance: number;
  currentBonus: number; // tenths already converted
}) {
  const maxConvert = Math.floor(bettingBalance / STEP) * STEP;
  const [amount, setAmount] = useState(Math.min(maxConvert, 1_000_000));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const addedM = (Math.floor(amount / STEP) / 10).toFixed(1);
  const totalBonusM = ((currentBonus + Math.floor(amount / STEP)) / 10).toFixed(1);

  function convert() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await allocateBankToSquad(amount);
      if (res.ok) {
        router.refresh();
        setSuccess(`+${fmtMoney(amount)} added to your squad budget.`);
      } else {
        setError(res.error);
      }
    });
  }

  if (maxConvert < STEP) return null;

  return (
    <div
      className="mb-4 rounded-2xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--gold)", borderLeft: "3px solid var(--gold)" }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base font-extrabold">Boost Your Squad Budget</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: "rgba(255,200,0,0.15)", color: "var(--gold)" }}
        >
          Knockout Phase
        </span>
      </div>
      <p className="mb-3 text-sm" style={{ color: "var(--text-2)" }}>
        Convert your betting bank into extra squad budget. £1M betting = £1M squad budget.
        {currentBonus > 0 && (
          <span style={{ color: "var(--accent)" }}> You&apos;ve already added {fmtPrice(currentBonus)}.</span>
        )}
      </p>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs font-bold" style={{ color: "var(--text-3)" }}>
          <span>Convert amount</span>
          <span style={{ color: "var(--text-2)" }}>Bank: {fmtMoney(bettingBalance)}</span>
        </div>
        <input
          type="range"
          min={STEP}
          max={maxConvert}
          step={STEP}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full accent-[var(--gold)]"
        />
        <div className="mt-1 flex items-center justify-between text-xs" style={{ color: "var(--text-2)" }}>
          <span>£100k</span>
          <span className="num font-bold text-sm">{fmtMoney(amount)}</span>
          <span>{fmtMoney(maxConvert)}</span>
        </div>
      </div>

      <div
        className="mb-3 flex items-center justify-between rounded-xl p-3"
        style={{ background: "var(--surface-2)" }}
      >
        <span className="text-sm" style={{ color: "var(--text-2)" }}>Squad budget boost</span>
        <span className="num font-extrabold" style={{ color: "var(--gold)" }}>+{fmtMoney(amount)} → total {fmtPrice(currentBonus + Math.floor(amount / STEP))} bonus</span>
      </div>

      {error && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,77,94,0.12)", color: "var(--live)" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(0,200,100,0.1)", color: "var(--accent)" }}>
          {success}
        </div>
      )}

      <button
        onClick={convert}
        disabled={pending || amount < STEP}
        className="w-full rounded-xl py-2.5 text-sm font-extrabold transition-opacity disabled:opacity-50"
        style={{ background: "var(--gold)", color: "#000" }}
      >
        {pending ? "Converting…" : `Add ${fmtMoney(amount)} to Squad Budget`}
      </button>
      <p className="mt-2 text-center text-xs" style={{ color: "var(--text-3)" }}>
        Your remaining bank ({fmtMoney(bettingBalance - amount)}) stays for betting.
      </p>
    </div>
  );
}
