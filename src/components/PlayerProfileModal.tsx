"use client";

// Player profile modal (API-Football-widget style), ported from the design
// handoff. Opened with a player id; fetches the PlayerProfileView from
// /api/player/[id] (our DB only) and renders hero + vitals + 3 tabs.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Flag } from "@/components/Flag";
import { Jersey } from "@/components/Jersey";
import { Spark } from "@/components/Spark";
import { FDR_LABEL, type PlayerProfileView } from "@/lib/player-profile";
import { fmtMoney } from "@/lib/format";

type Tab = "stats" | "matches" | "fixtures";
const POS_RING = { GK: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" } as const;
const lastName = (n: string) => n.split(" ").slice(-1)[0];
const initials = (n: string) =>
  n.replace(/[^A-Za-zÀ-ÿ\s].*/, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const dash = (v: number | null | undefined) => (v == null ? "—" : v);

export function PlayerProfileModal({
  playerId,
  onClose,
}: {
  playerId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PlayerProfileView | null>(null);
  const [tab, setTab] = useState<Tab>("stats");
  const [photoFailed, setPhotoFailed] = useState(false);

  // Esc to close.
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Load the profile.
  useEffect(() => {
    let alive = true;
    setData(null);
    setPhotoFailed(false);
    fetch(`/api/player/${playerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [playerId]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal wide" onMouseDown={(e) => e.stopPropagation()} style={{ animation: "popIn .2s ease" }}>
        <div className="pp">
          <button className="pp-close icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>

          {!data ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Loading…</div>
          ) : (
            <>
              {/* ── hero ── */}
              <div className={"pp-hero pos-bg-" + data.position}>
                <div className="pp-photo">
                  <div className={"pp-photo-ring pos-ring-" + POS_RING[data.position]} />
                  {photoFailed || !data.photoUrl ? (
                    <div className="pp-photo-fallback">
                      <Jersey country={data.country} size={74} />
                      <span className="pp-initials">{initials(data.name)}</span>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      className="pp-img"
                      src={data.photoUrl}
                      alt={data.name}
                      onError={() => setPhotoFailed(true)}
                    />
                  )}
                  <span className="pp-photo-flag">
                    <Flag country={data.country} size={18} round />
                  </span>
                </div>
                <div className="pp-hero-id">
                  <div className="pp-hero-top">
                    <span className={"pos pos-" + data.position}>{data.position}</span>
                    {data.injured ? (
                      <span className="pill pill-live">
                        <Icon name="info" size={12} /> Injured
                      </span>
                    ) : (
                      <span className="pill pill-accent">
                        <Icon name="check" size={12} /> Match fit
                      </span>
                    )}
                  </div>
                  <h2 className="pp-name">{data.name}</h2>
                  <div className="pp-sub">
                    <Flag country={data.country} size={14} round />
                    <span>{data.nationality ?? data.country.replace(/-/g, " ")}</span>
                  </div>
                  <div className="pp-price">
                    <span className="pp-price-v num">{fmtMoney(data.price * 1_000_000)}</span>
                    <span className="pp-price-l">GAFFER price</span>
                  </div>
                </div>
              </div>

              {/* ── vitals ── */}
              <div className="pp-vitals">
                <Vital label="Age" value={dash(data.age)} />
                <Vital label="Height" value={dash(data.heightCm)} sub="cm" />
                <Vital label="Weight" value={dash(data.weightKg)} sub="kg" />
                <Vital label="Nation" value={data.country.replace(/-/g, " ")} />
              </div>

              {/* ── tabs ── */}
              <div className="pp-tabs">
                <div className="seg seg-sm">
                  {(["stats", "matches", "fixtures"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      className={"seg-btn" + (tab === t ? " on" : "")}
                      onClick={() => setTab(t)}
                    >
                      {t === "stats" ? "Statistics" : t === "matches" ? "Matches" : "Fixtures"}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "stats" && <StatsTab data={data} />}
              {tab === "matches" && <MatchesTab data={data} />}
              {tab === "fixtures" && <FixturesTab data={data} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Vital({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="pp-vital">
      <div className="pp-vital-val num">
        {value}
        {sub && <span className="pp-vital-sub">{sub}</span>}
      </div>
      <div className="pp-vital-lab">{label}</div>
    </div>
  );
}

function StatsTab({ data }: { data: PlayerProfileView }) {
  const s = data.season;
  const ratingPct = s.rating != null ? Math.max(0, Math.min(100, ((s.rating - 5) / 5) * 100)) : 0;
  const Stat = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="pp-stat">
      <div className="pp-stat-v num">{v}</div>
      <div className="pp-stat-k">{k}</div>
    </div>
  );
  return (
    <div className="pp-tabbody">
      <div className="pp-section">
        <div className="pp-sec-head">
          <span>Season statistics</span>
          <span className="pp-sec-note">2025/26 club season · all competitions</span>
        </div>
        <div className="pp-rating">
          <div className="pp-rating-top">
            <span className="pp-rating-lab">Avg. match rating</span>
            <span className="pp-rating-num num">{s.rating != null ? s.rating.toFixed(2) : "—"}</span>
          </div>
          <div className="pp-rating-track">
            <div className="pp-rating-fill" style={{ width: ratingPct + "%" }} />
          </div>
          <div className="pp-rating-scale">
            <span>5.0</span>
            <span>7.5</span>
            <span>10</span>
          </div>
        </div>
        <div className="pp-stat-grid">
          <Stat k="Apps" v={dash(s.apps)} />
          <Stat k="Minutes" v={s.minutes != null ? s.minutes.toLocaleString() : "—"} />
          <Stat k="Goals" v={dash(s.goals)} />
          <Stat k="Assists" v={dash(s.assists)} />
          {s.cleanSheets != null && <Stat k="Clean sheets" v={s.cleanSheets} />}
        </div>
      </div>

      <div className="pp-section">
        <div className="pp-sec-head">
          <span>GAFFER fantasy</span>
          <span className="pp-sec-note">points from settled matches</span>
        </div>
        <div className="pp-fantasy">
          <div className="pp-fan-cell">
            <div className="pp-fan-v num accent">{data.pts}</div>
            <div className="pp-fan-k">Total pts</div>
          </div>
          <div className="pp-fan-cell">
            <div className="pp-fan-v num">{data.ppg.toFixed(1)}</div>
            <div className="pp-fan-k">Per game</div>
          </div>
          <div className="pp-fan-cell">
            <div className="pp-fan-v num">{data.matches.length}</div>
            <div className="pp-fan-k">Played</div>
          </div>
          <div className="pp-fan-cell pp-fan-spark">
            {data.form.length ? (
              <Spark data={data.form} w={108} h={34} />
            ) : (
              <span style={{ color: "var(--text-3)", fontSize: 12 }}>No games yet</span>
            )}
            <div className="pp-fan-k">Last 5 form</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ratingTone = (r: number) => (r >= 7.5 ? " r-hi" : r >= 6.5 ? " r-mid" : " r-lo");

function MatchesTab({ data }: { data: PlayerProfileView }) {
  const [open, setOpen] = useState<number | null>(null);
  if (data.matches.length === 0) {
    return (
      <div className="pp-tabbody">
        <p style={{ textAlign: "center", color: "var(--text-3)", padding: "32px 0", fontSize: 14 }}>
          No matches played yet — check back once the tournament kicks off.
        </p>
      </div>
    );
  }
  return (
    <div className="pp-tabbody">
      <div className="pp-matches">
        <div className="pp-mh">
          <span className="pp-mh-rd">Round</span>
          <span className="pp-mh-opp">Opponent</span>
          <span className="pp-mh-c">Min</span>
          <span className="pp-mh-c">G</span>
          <span className="pp-mh-c">A</span>
          <span className="pp-mh-c">Rtg</span>
          <span className="pp-mh-c pts">Pts</span>
        </div>
        {data.matches.map((m, i) => (
          <div key={i}>
            <button
              type="button"
              className={"pp-mrow" + (m.minutes === 0 ? " dnp" : "") + (open === i ? " open" : "")}
              onClick={() => setOpen(open === i ? null : i)}
              title="Tap for the points breakdown"
            >
              <span className="pp-mrow-rd">{m.round}</span>
              <span className="pp-mrow-opp">
                <span className="pp-ha">{m.home ? "H" : "A"}</span>
                <Flag country={m.opp} size={15} round />
                <span className="pp-opp-name">{lastName(m.opp.replace(/-/g, " "))}</span>
                <span className={"pp-res res-" + m.result}>
                  {m.score[0]}–{m.score[1]}
                </span>
                <span className="pp-cards">
                  {m.yellow && <span className="pp-card yellow" />}
                  {m.red && <span className="pp-card red" />}
                </span>
              </span>
              <span className="pp-mrow-c num">{m.minutes === 0 ? "—" : m.minutes + "'"}</span>
              <span className="pp-mrow-c num">{m.minutes === 0 ? "—" : m.goals}</span>
              <span className="pp-mrow-c num">{m.minutes === 0 ? "—" : m.assists}</span>
              <span className={"pp-mrow-c num" + (m.rating ? ratingTone(m.rating) : "")}>
                {m.rating ? m.rating.toFixed(1) : "—"}
              </span>
              <span className="pp-mrow-c pts">
                <span className={"pp-fp num" + (m.fantasy >= 8 ? " hot" : m.fantasy <= 1 ? " cold" : "")}>
                  {m.fantasy}
                </span>
              </span>
            </button>
            {open === i && (
              <div className="pp-breakdown">
                {m.components.length === 0 ? (
                  <span className="pp-bd-empty">No points this match.</span>
                ) : (
                  m.components.map((c, j) => (
                    <span key={j} className="pp-bd-row">
                      <span className="pp-bd-label">{c.label}</span>
                      <span className={"pp-bd-pts num" + (c.pts < 0 ? " neg" : "")}>
                        {c.pts > 0 ? `+${c.pts}` : c.pts}
                      </span>
                    </span>
                  ))
                )}
                <span className="pp-bd-row pp-bd-total">
                  <span className="pp-bd-label">Total</span>
                  <span className="pp-bd-pts num">{m.fantasy}</span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FixturesTab({ data }: { data: PlayerProfileView }) {
  if (data.upcoming.length === 0) {
    return (
      <div className="pp-tabbody">
        <p style={{ textAlign: "center", color: "var(--text-3)", padding: "32px 0", fontSize: 14 }}>
          No upcoming fixtures scheduled.
        </p>
      </div>
    );
  }
  return (
    <div className="pp-tabbody">
      <div className="pp-fixtures">
        {data.upcoming.map((f, i) => (
          <div key={i} className="pp-fix">
            <div className="pp-fix-l">
              <div className="pp-fix-rd">{f.round}</div>
              <div className="pp-fix-when">{f.when}</div>
            </div>
            <div className="pp-fix-opp">
              <span className="pp-ha">{f.home ? "H" : "A"}</span>
              <Flag country={f.opp} size={18} round />
              <span className="pp-opp-name big">{f.opp.replace(/-/g, " ")}</span>
            </div>
            <div className={"pp-fdr fdr-" + f.fdr} title="Fixture difficulty">
              <span className="pp-fdr-n num">{f.fdr}</span>
              <span className="pp-fdr-l">{FDR_LABEL[f.fdr]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
