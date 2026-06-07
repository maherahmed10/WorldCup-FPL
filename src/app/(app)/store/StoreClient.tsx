"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STORE_ITEMS } from "@/lib/store";
import { purchaseItem } from "./actions";

export interface OwnedPerk {
  id: string;
  storeItemId: string;
  gameweekId: string | null;
  usedAt: Date | null;
  createdAt: Date;
}

export function StoreClient({
  balance,
  ownedPerks,
}: {
  balance: number;
  ownedPerks: OwnedPerk[];
}) {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function buy(itemId: string) {
    startTransition(async () => {
      const res = await purchaseItem(itemId);
      if (res.ok) {
        router.refresh();
        showToast("Perk purchased!", true);
      } else {
        showToast(res.error, false);
      }
    });
  }

  // Group owned perks by storeItemId for display
  const ownedByItem = new Map<string, OwnedPerk[]>();
  for (const p of ownedPerks) {
    const list = ownedByItem.get(p.storeItemId) ?? [];
    list.push(p);
    ownedByItem.set(p.storeItemId, list);
  }

  const PERK_ICON: Record<string, string> = {
    country_slot: "🌍",
    extra_captain: "⚡",
    extra_transfer: "🔄",
    bench_boost: "💺",
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Store</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>
            Spend your winnings on perks that boost your squad or scoring.
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2"
          style={{ background: "var(--surface)", borderColor: "var(--line-2)" }}
        >
          <span className="font-bold" style={{ color: "var(--accent)" }}>£</span>
          <div className="text-right">
            <div className="num text-lg font-extrabold">{balance.toLocaleString("en-GB")}</div>
            <div className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>
              betting bank
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STORE_ITEMS.map((item) => {
          const owned = ownedByItem.get(item.id) ?? [];
          const activeCount = owned.filter((p) => p.usedAt === null).length;
          const canBuy = balance >= item.cost;
          const icon = PERK_ICON[item.effectKey] ?? "✨";

          return (
            <div
              key={item.id}
              className="rounded-2xl border p-4"
              style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <div className="font-bold">{item.name}</div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--text-2)" }}>
                      {item.description}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num font-extrabold" style={{ color: "var(--accent)" }}>
                    £{item.cost.toLocaleString("en-GB")}
                  </div>
                  {activeCount > 0 && (
                    <div className="mt-0.5 text-[11px] font-bold" style={{ color: "var(--gold)" }}>
                      {activeCount} owned
                    </div>
                  )}
                </div>
              </div>

              <button
                disabled={!canBuy || pending}
                onClick={() => buy(item.id)}
                className="w-full rounded-xl py-2.5 text-sm font-extrabold transition-opacity disabled:opacity-40"
                style={{
                  background: canBuy ? "var(--accent)" : "var(--surface-3)",
                  color: canBuy ? "var(--accent-ink)" : "var(--text-3)",
                }}
              >
                {pending ? "Buying…" : canBuy ? `Buy for £${item.cost}` : "Insufficient funds"}
              </button>
            </div>
          );
        })}
      </div>

      {ownedPerks.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 text-sm font-bold" style={{ color: "var(--text-2)" }}>
            Your Perks
          </div>
          <div className="flex flex-col gap-2">
            {ownedPerks.map((p) => {
              const item = STORE_ITEMS.find((s) => s.id === p.storeItemId);
              if (!item) return null;
              const icon = PERK_ICON[item.effectKey] ?? "✨";
              const used = p.usedAt !== null;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--line)",
                    opacity: used ? 0.5 : 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span>{icon}</span>
                    <div>
                      <div className="text-sm font-bold">{item.name}</div>
                      {p.gameweekId && (
                        <div className="text-xs" style={{ color: "var(--text-3)" }}>
                          GW: {p.gameweekId}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{
                      background: used ? "var(--surface-3)" : "rgba(24,224,138,0.14)",
                      color: used ? "var(--text-3)" : "var(--accent)",
                    }}
                  >
                    {used ? "Used" : "Active"}
                  </span>
                </div>
              );
            })}
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
