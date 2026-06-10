"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STORE_ITEMS, type PerkLike } from "@/lib/store";
import { purchaseItem } from "@/app/(app)/store/actions";
import { fmtMoney } from "@/lib/format";

const PERK_ICON: Record<string, string> = {
  extra_captain: "⚡",
  extra_transfer: "🔄",
  bench_boost: "💺",
};

const ACTIVATION_NOTE: Record<string, string> = {
  extra_captain: "Captain scores ×3 — activate from Squad before kickoff",
  extra_transfer: "One extra free transfer — use it from Transfers",
  bench_boost: "Bench points count in full — applies this knockout round",
};

export function MiniStore({
  balance,
  ownedPerks,
  isGroupStage,
}: {
  balance: number;
  ownedPerks: PerkLike[];
  isGroupStage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function buy(itemId: string) {
    setConfirming(null);
    setBuyingId(itemId);
    startTransition(async () => {
      const res = await purchaseItem(itemId);
      setBuyingId(null);
      if (res.ok) {
        router.refresh();
        showToast("Perk purchased — active now!");
      } else {
        showToast(res.error);
      }
    });
  }

  const activeCountByItem = new Map<string, number>();
  for (const p of ownedPerks) {
    if (p.usedAt === null) {
      activeCountByItem.set(p.storeItemId, (activeCountByItem.get(p.storeItemId) ?? 0) + 1);
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      {/* Header row */}
      <div className="flex items-center justify-between" style={{ marginBottom: isGroupStage ? 6 : 12 }}>
        <div className="sum-title">Store</div>
        <div className="flex items-center gap-1">
          <span className="num text-sm font-extrabold" style={{ color: "var(--accent)" }}>
            {fmtMoney(balance)}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>bank</span>
        </div>
      </div>

      {isGroupStage && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-[11px] font-semibold"
          style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-3)" }}
        >
          🔒 Unlocks after the group stage — your bank merges your leftover squad
          budget, your £5M betting stipend, and any winnings.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {STORE_ITEMS.map((item) => {
          const icon = PERK_ICON[item.effectKey] ?? "✨";
          const ownedCount = activeCountByItem.get(item.id) ?? 0;
          const locked = isGroupStage;
          const affordable = balance >= item.cost;
          const isConfirming = confirming === item.id;
          const isBuying = pending && buyingId === item.id;
          const disabled = locked || !affordable;

          return (
            <div key={item.id}>
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  background: "var(--surface-2)",
                  border: `1px solid ${isConfirming ? "rgba(24,224,138,.4)" : "var(--line)"}`,
                  transition: "border-color .15s",
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate">{item.name}</span>
                    {ownedCount > 0 && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ background: "rgba(24,224,138,0.18)", color: "var(--accent)" }}
                      >
                        {ownedCount}×
                      </span>
                    )}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
                    {locked ? "After group stage" : isConfirming ? ACTIVATION_NOTE[item.effectKey] : fmtMoney(item.cost)}
                  </div>
                </div>

                {/* Confirm step: two micro-buttons replace Buy */}
                {isConfirming ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      disabled={isBuying}
                      onClick={() => buy(item.id)}
                      className="rounded-lg px-2 py-1 text-[11px] font-extrabold transition-opacity disabled:opacity-50"
                      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                    >
                      {isBuying ? "…" : "✓ Confirm"}
                    </button>
                    <button
                      disabled={isBuying}
                      onClick={() => setConfirming(null)}
                      className="rounded-lg px-2 py-1 text-[11px] font-bold transition-opacity disabled:opacity-50"
                      style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={disabled || isBuying}
                    onClick={() => !disabled && setConfirming(item.id)}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-opacity disabled:opacity-35"
                    style={{
                      background: disabled ? "var(--surface-3)" : "var(--accent)",
                      color: disabled ? "var(--text-3)" : "var(--accent-ink)",
                    }}
                  >
                    {locked ? "🔒" : !affordable ? "—" : "Buy"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div
          className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold"
          style={{
            background: "var(--surface-3)",
            color: toast.startsWith("Perk") ? "var(--accent)" : "var(--live)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
