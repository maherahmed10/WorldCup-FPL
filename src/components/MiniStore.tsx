"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STORE_ITEMS, type PerkLike } from "@/lib/store";
import { purchaseItem } from "@/app/(app)/store/actions";

const PERK_ICON: Record<string, string> = {
  extra_captain: "⚡",
  extra_transfer: "🔄",
  bench_boost: "💺",
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
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function buy(itemId: string) {
    setBuyingId(itemId);
    startTransition(async () => {
      const res = await purchaseItem(itemId);
      setBuyingId(null);
      if (res.ok) {
        router.refresh();
        showToast("Perk purchased!");
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
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="sum-title">Store</div>
        <div className="flex items-center gap-1">
          <span className="num text-sm font-extrabold" style={{ color: "var(--accent)" }}>
            £{balance.toLocaleString("en-GB")}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>bank</span>
        </div>
      </div>

      {/* Perk rows */}
      <div className="flex flex-col gap-2">
        {STORE_ITEMS.map((item) => {
          const icon = PERK_ICON[item.effectKey] ?? "✨";
          const ownedCount = activeCountByItem.get(item.id) ?? 0;
          const locked = item.effectKey === "bench_boost" && isGroupStage;
          const affordable = balance >= item.cost;
          const disabled = locked || !affordable || (pending && buyingId === item.id);

          return (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
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
                  {locked ? "After group stage" : `£${item.cost.toLocaleString("en-GB")}`}
                </div>
              </div>
              <button
                disabled={disabled}
                onClick={() => buy(item.id)}
                className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-opacity disabled:opacity-35"
                style={{
                  background: disabled ? "var(--surface-3)" : "var(--accent)",
                  color: disabled ? "var(--text-3)" : "var(--accent-ink)",
                }}
              >
                {pending && buyingId === item.id ? "…" : locked ? "🔒" : `Buy`}
              </button>
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
