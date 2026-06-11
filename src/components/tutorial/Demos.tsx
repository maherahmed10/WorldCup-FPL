"use client";

// ─────────────────────────────────────────────────────────────────────────────
// How-to-play demos — one looping, pure-CSS animation per HTP_CARDS entry
// (see HowToPlayDeck.tsx). Each renders inside the card's .htp-media box and
// tints from the card's --cc variable (falls back to --accent standalone).
//
// CSS: paste the marked "HOW-TO-PLAY DEMOS" block (demos.css) at the end of
// src/styles/screens.css. No JS animation, no timers — keyframes only, and
// every demo freezes to a clean composed frame under prefers-reduced-motion
// (the base styles ARE the composed frame; keyframes animate through it).
//
// Money/units mirror the app: fmtMoney style (£12.5M / £50k), £100M budget,
// decimal odds via toFixed(2), gold ×2 captain badge, real store prices.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import { Jersey } from "@/components/Jersey";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/Icon";

interface DemoProps {
  className?: string;
}

type DemoStyle = CSSProperties & Record<`--${string}`, string>;

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ── 01 · Draft your squad ─────────────────────────────────────────────────
   Jerseys pop into a formation on a mini pitch; the budget bar fills. */

const DRAFT_SLOTS: Array<{ x: number; y: number; country: string }> = [
  { x: 50, y: 84, country: "Belgium" }, // GK
  { x: 20, y: 62, country: "England" },
  { x: 50, y: 65, country: "Brazil" },
  { x: 80, y: 62, country: "Netherlands" },
  { x: 30, y: 36, country: "Spain" },
  { x: 70, y: 36, country: "France" },
  { x: 50, y: 13, country: "Argentina" }, // FWD
];

export function DraftDemo({ className }: DemoProps) {
  return (
    <div className={cx("htpd htpd-draft", className)} aria-hidden="true">
      <div className="htpd-pitch">
        <span className="htpd-pitch-half"></span>
        <span className="htpd-pitch-circle"></span>
        {DRAFT_SLOTS.map((s, i) => (
          <span
            key={s.country}
            className="htpd-draft-slot"
            style={{ left: `${s.x}%`, top: `${s.y}%`, "--i": String(i) } as DemoStyle}
          >
            <Jersey country={s.country} size={30} />
          </span>
        ))}
      </div>
      <div className="htpd-draft-budget">
        <span className="htpd-draft-tag">Budget</span>
        <span className="htpd-draft-track"><i className="htpd-draft-fill"></i></span>
        <span className="htpd-draft-spent num"><b>£78.5M</b> / £100M</span>
      </div>
    </div>
  );
}

/* ── 02 · Make transfers ───────────────────────────────────────────────────
   Two jersey tokens swap places; the incoming player lands with the
   accent-green drop-glow. */

export function TransfersDemo({ className }: DemoProps) {
  return (
    <div className={cx("htpd htpd-swap", className)} aria-hidden="true">
      <div className="htpd-swap-stage">
        <div className="htpd-swap-token htpd-swap-out">
          <span className="pill pill-live">Out</span>
          <span className="htpd-swap-shirt"><Jersey country="Netherlands" size={44} /></span>
          <span className="htpd-swap-name">Depay</span>
          <span className="htpd-swap-price num">£9M</span>
        </div>
        <span className="htpd-swap-hub"><Icon name="swap" size={17} /></span>
        <div className="htpd-swap-token htpd-swap-in">
          <span className="pill pill-accent">In</span>
          <span className="htpd-swap-shirt"><Jersey country="France" size={44} /></span>
          <span className="htpd-swap-name">Mbappé</span>
          <span className="htpd-swap-price num">£12.5M</span>
        </div>
      </div>
    </div>
  );
}

/* ── 03 · Search & scout players ───────────────────────────────────────────
   A query types into the search bar, the matching row highlights, and a
   mini profile card slides in. */

const SCOUT_ROWS: Array<{ name: string; country: string; pos: string; price: string; hit?: boolean }> = [
  { name: "Vitinha", country: "Portugal", pos: "MID", price: "£7.5M" },
  { name: "Bellingham", country: "England", pos: "MID", price: "£11M", hit: true },
  { name: "Modrić", country: "Croatia", pos: "MID", price: "£9.5M" },
];

export function ScoutDemo({ className }: DemoProps) {
  return (
    <div className={cx("htpd htpd-scout", className)} aria-hidden="true">
      <div className="htpd-scout-search">
        <Icon name="search" size={13} />
        <span className="htpd-scout-q">bell</span>
      </div>
      <div className="htpd-scout-rows">
        {SCOUT_ROWS.map((p) => (
          <div key={p.name} className={cx("htpd-scout-row", p.hit && "htpd-hit")}>
            <Flag country={p.country} size={13} round />
            <span className="htpd-scout-name">{p.name}</span>
            <span className={`pos pos-${p.pos}`}>{p.pos}</span>
            <span className="htpd-scout-price num">{p.price}</span>
          </div>
        ))}
      </div>
      <div className="htpd-scout-card">
        <Jersey country="England" size={34} />
        <span className="htpd-scout-card-info">
          <b>Bellingham</b>
          <small className="num">MID · £11M · Form 8.2</small>
        </span>
      </div>
    </div>
  );
}

/* ── 04 · Leagues & friends ────────────────────────────────────────────────
   Mini standings — "You" climbs a place (rows swap), points tick up,
   join-code chip up top. Rank numbers live in a static column so they
   stay put while rows move. */

const LEAGUE_ROWS: Array<{
  name: string; country: string; pts: string; oldPts?: string; you?: boolean; drop?: boolean;
}> = [
  { name: "Sofia", country: "Spain", pts: "412" },
  { name: "You", country: "Argentina", pts: "401", oldPts: "396", you: true },
  { name: "Marco", country: "Italy", pts: "398", drop: true },
  { name: "Dan", country: "England", pts: "371" },
];

export function LeaguesDemo({ className }: DemoProps) {
  return (
    <div className={cx("htpd htpd-league", className)} aria-hidden="true">
      <div className="htpd-league-head">
        <Icon name="trophy" size={14} />
        <span className="htpd-league-title">Office League</span>
        <span className="htpd-chip num htpd-league-code"><Icon name="plus" size={10} />WC26-7F3K</span>
      </div>
      <div className="htpd-league-grid">
        <div className="htpd-league-ranks num">
          <span>1</span><span>2</span><span>3</span><span>4</span>
        </div>
        <div className="htpd-league-rows">
          {LEAGUE_ROWS.map((r) => (
            <div key={r.name} className={cx("htpd-league-row", r.you && "htpd-you", r.drop && "htpd-drop")}>
              <Flag country={r.country} size={15} round />
              <span className="htpd-league-name">{r.name}</span>
              {r.you ? <span className="htpd-league-up"><Icon name="arrowup" size={11} /></span> : null}
              <span className="htpd-league-pts num">
                {r.oldPts ? <em className="htpd-pts-old">{r.oldPts}</em> : null}
                <em className="htpd-pts-new">{r.pts}</em>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 05 · Bet on matches ───────────────────────────────────────────────────
   An odds button presses in, slip legs slide on, the combined odds tick up.
   Odds values stay accent-green like the predict screen; chrome tints --cc. */

export function BetsDemo({ className }: DemoProps) {
  return (
    <div className={cx("htpd htpd-bets", className)} aria-hidden="true">
      <div className="htpd-bets-fixture">
        <Flag country="Brazil" size={14} round />
        <b>BRA</b><span className="htpd-bets-vs">v</span><b>FRA</b>
        <Flag country="France" size={14} round />
      </div>
      <div className="htpd-odds-row">
        <span className="htpd-odds htpd-picked"><small>BRA</small><b className="num">2.10</b></span>
        <span className="htpd-odds"><small>Draw</small><b className="num">3.40</b></span>
        <span className="htpd-odds"><small>FRA</small><b className="num">2.95</b></span>
      </div>
      <div className="htpd-slip">
        <div className="htpd-slip-leg htpd-leg1"><i></i><span>Brazil to win</span><b className="num">2.10</b></div>
        <div className="htpd-slip-leg htpd-leg2"><i></i><span>Over 2.5 goals</span><b className="num">1.85</b></div>
        <div className="htpd-slip-foot num">
          <span className="htpd-slip-stake">Stake <b>£50k</b></span>
          <span className="htpd-combo">
            <em className="htpd-combo-c1">@2.10</em>
            <em className="htpd-combo-c2">@3.89</em>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── 06 · Buy power-ups ────────────────────────────────────────────────────
   Store rows with a Buy press (real catalogue prices), then the captain
   token earns its gold ×2 badge — the Extra Captain perk. */

export function PowerupsDemo({ className }: DemoProps) {
  return (
    <div className={cx("htpd htpd-store", className)} aria-hidden="true">
      <div className="htpd-store-rows">
        <div className="htpd-store-row htpd-buying">
          <span className="htpd-store-ic"><Icon name="bolt" size={15} /></span>
          <span className="htpd-store-info"><b>Extra Captain</b><small className="num">£2.5M</small></span>
          <span className="htpd-buy htpd-buy-1">
            <em className="htpd-buy-label">Buy</em>
            <em className="htpd-buy-done"><Icon name="check" size={12} /></em>
          </span>
        </div>
        <div className="htpd-store-row">
          <span className="htpd-store-ic"><Icon name="swap" size={15} /></span>
          <span className="htpd-store-info"><b>Extra Transfer</b><small className="num">£1M</small></span>
          <span className="htpd-buy"><em className="htpd-buy-label">Buy</em></span>
        </div>
      </div>
      <div className="htpd-store-cap">
        <span className="htpd-cap-shirt">
          <Jersey country="Argentina" size={34} />
          <span className="htpd-cap-badge num">×2</span>
        </span>
        <small>2nd captain named</small>
      </div>
    </div>
  );
}
