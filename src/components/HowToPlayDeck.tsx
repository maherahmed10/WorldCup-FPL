"use client";

// How-to-play card deck (design handoff: home/deck.jsx). A slide-and-fade deck
// of 6 cards reused by the /home guide and the first-login WelcomeModal.
// Controls: Prev/Next, clickable dots, arrow keys, mobile swipe, progress bar.
// Respects prefers-reduced-motion (CSS swaps the slide for an instant fade).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";

interface Card {
  n: string;
  icon: string;
  cc: string; // per-card accent, set as --cc so badge/number/chips/CTA tint from it
  kicker: string;
  title: string;
  text: string;
  chips: string[];
}

const HTP_CARDS: Card[] = [
  {
    n: "01", icon: "team", cc: "var(--accent)", kicker: "Build",
    title: "Draft your squad",
    text: "Assemble a 15-player squad — 2 GK, 5 DEF, 5 MID, 3 FWD — inside a £100m budget. Pick a formation and hand the armband to a captain who banks double points.",
    chips: ["15 players", "£100m budget", "Max 3 / nation", "Captain ×2"],
  },
  {
    n: "02", icon: "swap", cc: "var(--blue)", kicker: "Adapt",
    title: "Make transfers",
    text: "Your squad locks through the group stage. Then one transfer window opens at the start of every knockout round — refresh your team as the field narrows.",
    chips: ["R32", "R16", "QF", "SF", "Final"],
  },
  {
    n: "03", icon: "search", cc: "var(--purple)", kicker: "Scout",
    title: "Search & scout players",
    text: "Browse the full player market. Filter by position, nation, price and form, then tap any player for their profile, season stats and upcoming fixtures.",
    chips: ["Filter by form", "Price & value", "Full profiles"],
  },
  {
    n: "04", icon: "trophy", cc: "var(--gold)", kicker: "Compete",
    title: "Leagues & friends",
    text: "Spin up a mini-league to get a join code, invite your mates, and scrap up the table on gameweek and total points all tournament long.",
    chips: ["Join codes", "Invite friends", "Live standings"],
  },
  {
    n: "05", icon: "coins", cc: "var(--live)", kicker: "Predict",
    title: "Bet on matches",
    text: "Stake your virtual bank on match markets — result, over/under, both teams to score — plus player props like anytime scorer, to assist or to be carded. Win = stake × odds.",
    chips: ["Match result", "Over / under", "BTTS", "Player props"],
  },
  {
    n: "06", icon: "store", cc: "var(--accent)", kicker: "Boost",
    title: "Buy power-ups",
    text: "Spend your winnings in the Store on one-shot perks that swing a gameweek your way when it matters most.",
    chips: ["+1 nation slot", "Triple-captain", "Extra transfer", "Bench boost", "Wildcard"],
  },
];

export function HowToPlayDeck({
  compact = false,
  finalCta,
}: {
  compact?: boolean;
  finalCta?: { label: string; href: string };
}) {
  const [index, setIndex] = useState(0);
  const total = HTP_CARDS.length;
  const last = index === total - 1;
  const touch = useRef({ x: 0, active: false });

  const go = useCallback(
    (n: number) => setIndex(Math.max(0, Math.min(total - 1, n))),
    [total],
  );
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);

  // arrow-key support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // swipe on mobile
  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, active: true };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touch.current.active) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    if (Math.abs(dx) > 44) (dx < 0 ? next : prev)();
    touch.current.active = false;
  }

  const count = (
    <div className="htp-count">
      <b>{String(index + 1).padStart(2, "0")}</b> / {String(total).padStart(2, "0")}
    </div>
  );

  return (
    <div className={"htp" + (compact ? " compact" : "")}>
      {!compact && (
        <div className="htp-head">
          <div className="section-title">How to play</div>
          {count}
        </div>
      )}

      <div className="htp-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {HTP_CARDS.map((c, i) => {
          const cls = i === index ? "active" : i < index ? "before" : "";
          return (
            <article
              key={c.n}
              className={"htp-card " + cls}
              style={{ "--cc": c.cc } as React.CSSProperties}
              aria-hidden={i !== index}
            >
              <div className="htp-num">{c.n}</div>
              <div className="htp-badge"><Icon name={c.icon} size={26} /></div>
              <div className="htp-kicker">{c.kicker}</div>
              <h3 className="htp-title">{c.title}</h3>
              <p className="htp-text">{c.text}</p>
              <div className="htp-chips">
                {c.chips.map((chip) => (
                  <span key={chip} className="htp-chip">{chip}</span>
                ))}
              </div>
              {i === total - 1 && finalCta && (
                <div className="htp-cta">
                  <Link className="btn" href={finalCta.href}>
                    {finalCta.label} <Icon name="arrowright" size={17} />
                  </Link>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="htp-foot">
        <div className="htp-arrows">
          <button className="htp-arrow" onClick={prev} disabled={index === 0} aria-label="Previous">
            <Icon name="chevleft" size={20} />
          </button>
          <button className="htp-arrow" onClick={next} disabled={last} aria-label="Next">
            <Icon name="chevright" size={20} />
          </button>
        </div>
        <div className="htp-dots">
          {HTP_CARDS.map((c, i) => (
            <button
              key={c.n}
              className={"htp-dot" + (i === index ? " on" : "")}
              onClick={() => go(i)}
              aria-label={"Go to card " + (i + 1)}
            />
          ))}
        </div>
        <div className="htp-bar">
          <i style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        {compact && count}
      </div>
    </div>
  );
}
