"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STORE_ITEMS } from "@/lib/store";
import { purchaseItem } from "./actions";
import { fmtMoney } from "@/lib/format";

export interface OwnedPerk {
  id: string;
  storeItemId: string;
  gameweekId: string | null;
  usedAt: Date | null;
  createdAt: Date;
}

// What the user needs to know before buying — shown inline and in the confirm step.
const ACTIVATION_NOTE: Record<string, string> = {
  extra_captain:
    "Lets you name a SECOND captain for one gameweek — both captains score ×2. Set it from the Squad page (tap a starter → Make 2nd Captain) before the next kickoff.",
  extra_transfer:
    "Activates on purchase — grants one extra free transfer. Use it any time from the squad editor.",
  bench_boost:
    "Activates on purchase — your bench players' points count in full for one knockout gameweek.",
};

// Short hint shown in "Your Perks" so users know where to go next.
const USAGE_HINT: Record<string, string> = {
  extra_captain: "Head to Squad → tap a starter → Make 2nd Captain",
  extra_transfer: "Head to Squad → make your extra transfer",
  bench_boost: "Applies automatically to the current knockout round",
};

const PERK_ICON: Record<string, string> = {
  country_slot: "🌍",
  extra_captain: "⚡",
  extra_transfer: "🔄",
  bench_boost: "💺",
};

export function StoreClient({
  balance,
  ownedPerks,
  isGroupStage,
}: {
  balance: number;
  ownedPerks: OwnedPerk[];
  isGroupStage: boolean;
}) {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);
  const router = useRouter();

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function buy(itemId: string) {
    setConfirming(null);
    startTransition(async () => {
      const res = await purchaseItem(itemId);
      if (res.ok) {
        router.refresh();
        showToast("Perk purchased — active now!", true);
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
            <div className="num text-lg font-extrabold">{fmtMoney(balance)}</div>
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
          const benchBoostLocked = item.effectKey === "bench_boost" && isGroupStage;
          const canBuy = balance >= item.cost && !benchBoostLocked;
          const icon = PERK_ICON[item.effectKey] ?? "✨";
          const isConfirming = confirming === item.id;
          const note = ACTIVATION_NOTE[item.effectKey];

          return (
            <div
              key={item.id}
              className="rounded-2xl border p-4"
              style={{ background: "var(--surface)", borderColor: isConfirming ? "var(--accent)" : "var(--line)", transition: "border-color .15s" }}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
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
                    {fmtMoney(item.cost)}
                  </div>
                  {activeCount > 0 && (
                    <div className="mt-0.5 text-[11px] font-bold" style={{ color: "var(--gold)" }}>
                      {activeCount} owned
                    </div>
                  )}
                </div>
              </div>

              {/* Always-visible activation note */}
              {note && (
                <div
                  className="mb-3 rounded-lg px-3 py-2 text-xs"
                  style={{ background: "var(--surface-3)", color: "var(--text-2)", lineHeight: 1.5 }}
                >
                  {note}
                </div>
              )}

              {benchBoostLocked && (
                <div
                  className="mb-2 rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
                >
                  Available after the group stage
                </div>
              )}

              {/* Confirm step: replaces buy button to force the user to acknowledge */}
              {isConfirming ? (
                <div
                  className="rounded-xl border p-3"
                  style={{ borderColor: "rgba(24,224,138,.35)", background: "rgba(24,224,138,.07)" }}
                >
                  <div className="mb-2.5 text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                    Confirm purchase of <span style={{ color: "var(--text)" }}>{item.name}</span> for{" "}
                    <span style={{ color: "var(--accent)" }}>{fmtMoney(item.cost)}</span>?
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={pending}
                      onClick={() => buy(item.id)}
                      className="flex-1 rounded-xl py-2 text-sm font-extrabold transition-opacity disabled:opacity-50"
                      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                    >
                      {pending ? "Buying…" : `Confirm — ${fmtMoney(item.cost)}`}
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => setConfirming(null)}
                      className="rounded-xl px-4 py-2 text-sm font-bold transition-opacity disabled:opacity-50"
                      style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  disabled={!canBuy || pending}
                  onClick={() => canBuy && setConfirming(item.id)}
                  className="w-full rounded-xl py-2.5 text-sm font-extrabold transition-opacity disabled:opacity-40"
                  style={{
                    background: canBuy ? "var(--accent)" : "var(--surface-3)",
                    color: canBuy ? "var(--accent-ink)" : "var(--text-3)",
                  }}
                >
                  {pending
                    ? "Buying…"
                    : benchBoostLocked
                    ? "Locked"
                    : canBuy
                    ? `Buy — ${fmtMoney(item.cost)}`
                    : "Insufficient funds"}
                </button>
              )}
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
              const hint = USAGE_HINT[item.effectKey];
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
                      {!used && hint && (
                        <div className="text-xs" style={{ color: "var(--text-3)" }}>
                          {hint}
                        </div>
                      )}
                      {used && (
                        <div className="text-xs" style={{ color: "var(--text-3)" }}>
                          Consumed by the scoring system
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
