"use client";

// First-login Welcome modal (design handoff: home/deck.jsx + app.jsx show-once).
// Auto-shows ONCE per account: server source of truth is User.onboardedAt
// (passed as `firstLogin`), with a localStorage anti-flash fast-path so it never
// double-flashes before the server round-trips. Reuses <HowToPlayDeck compact />.

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { HowToPlayDeck } from "@/components/HowToPlayDeck";
import { setOnboarded } from "@/app/(app)/home/actions";

const ONBOARD_KEY = "gaffer_onboarded";

export function WelcomeModal({ firstLogin }: { firstLogin: boolean }) {
  // Start hidden so SSR and first client render agree (no hydration mismatch);
  // decide in an effect using the server flag + the localStorage anti-flash key.
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!firstLogin) return;
    let seen = false;
    try {
      seen = localStorage.getItem(ONBOARD_KEY) === "1";
    } catch {
      // localStorage unavailable — fall back to the server flag only
    }
    // SSR-safe reveal: render starts closed (matches server HTML), then opens
    // on the client only after the localStorage anti-flash check.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setOpen(true);
  }, [firstLogin]);

  function dismiss() {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    startTransition(() => {
      setOnboarded();
    });
    router.push("/squad");
  }

  function replay() {
    setOpen(false);
    startTransition(() => {
      setOnboarded();
    });
    router.push("/home");
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={dismiss}>
      <div className="modal wm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="wm-hero">
          <button className="icon-btn wm-skip" onClick={dismiss} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
          <div className="brand">
            <div className="brand-mark" style={{ background: "transparent", boxShadow: "none" }}>
                <Image src="/TheLogo.png" alt="TapIn" width={34} height={34} style={{ objectFit: "contain", mixBlendMode: "screen" }} />
              </div>
              <div className="brand-name">TapIn</div>
          </div>
          <div className="wm-welcome">
            Welcome to the <span className="g">game</span>.
          </div>
          <div className="wm-sub">Six things to know before you pick your squad.</div>
        </div>
        <div className="wm-body">
          <HowToPlayDeck compact />
        </div>
        <div className="wm-foot">
          <div className="wm-actions">
            <button className="btn btn-ghost" onClick={replay}>
              Replay the guide
            </button>
            <button className="btn btn-primary" onClick={dismiss}>
              Got it, let&apos;s play
            </button>
          </div>
          <div className="wm-legal">Virtual points only — no real-money gambling.</div>
        </div>
      </div>
    </div>
  );
}
