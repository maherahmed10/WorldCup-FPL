"use client";

// Live countdown ported from design/components.jsx. `to` is an epoch ms timestamp.
import { useEffect, useState } from "react";

function Seg({ v, l }: { v: number; l: string }) {
  return (
    <div className="cd-seg">
      <span className="cd-num num">{String(v).padStart(2, "0")}</span>
      <span className="cd-unit">{l}</span>
    </div>
  );
}

export function Countdown({ to, label }: { to: number; label?: string }) {
  // Mounted flag avoids SSR/client hydration mismatch: render zeros on the
  // server + first client paint, then start ticking after mount.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  let diff = now === null ? 0 : Math.max(0, Math.floor((to - now) / 1000));
  const d = Math.floor(diff / 86400);
  diff -= d * 86400;
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const m = Math.floor(diff / 60);
  const s = diff - m * 60;

  return (
    <div className="countdown">
      {label && <span className="cd-label">{label}</span>}
      <div className="cd-segs">
        <Seg v={d} l="days" />
        <Seg v={h} l="hrs" />
        <Seg v={m} l="min" />
        <Seg v={s} l="sec" />
      </div>
    </div>
  );
}
