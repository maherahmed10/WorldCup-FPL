"use client";

// App shell ported from design/app.jsx — desktop sidebar + mobile top bar +
// mobile bottom tab bar. Wraps every authed route. Active state derives from
// the current pathname.
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { fmtPrice } from "@/lib/format";

const NAV = [
  { id: "home", label: "Home", icon: "home", href: "/home", mobileHidden: false },
  { id: "team", label: "My Team", icon: "team", href: "/team", mobileHidden: false },
  { id: "players", label: "Players", icon: "players", href: "/players", mobileHidden: false },
  { id: "predict", label: "Bets", icon: "predictions", href: "/predict", mobileHidden: false },
  { id: "leagues", label: "Leagues", icon: "leagues", href: "/leagues", mobileHidden: false },
  { id: "nations", label: "Nations", icon: "flag", href: "/nations", mobileHidden: false },
  { id: "fixtures", label: "Fixtures", icon: "fixtures", href: "/fixtures", mobileHidden: true },
  { id: "leaderboard", label: "Rankings", icon: "star", href: "/leaderboard", mobileHidden: true },
];

// Routes under the "team" tab group (dashboard, squad picker, transfers, store).
const TEAM_ROUTES = ["/team", "/squad", "/transfers", "/store"];

function activeTab(pathname: string): string {
  if (TEAM_ROUTES.some((r) => pathname.startsWith(r))) return "team";
  const match = NAV.find((n) => pathname.startsWith(n.href));
  return match?.id ?? "team";
}

export function AppShell({
  children,
  user,
  budgetRemaining = 1000,
  budgetTotal = 1000,
  pendingH2HCount = 0,
}: {
  children: React.ReactNode;
  user?: { name: string; handle?: string } | null;
  budgetRemaining?: number; // tenths of a million; 1000 = £100m
  budgetTotal?: number; // tenths of a million — the cap (= £100m in the group stage, the full pool in the knockouts)
  pendingH2HCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tab = activeTab(pathname);
  const initial = (user?.name ?? "G").charAt(0).toUpperCase();

  const budgetLabel = fmtPrice(budgetRemaining);
  const budgetPct = Math.max(0, Math.min(100, budgetTotal > 0 ? (budgetRemaining / budgetTotal) * 100 : 0));
  const budgetTone =
    budgetRemaining <= 0 ? "var(--live)" :
    budgetRemaining < 100 ? "var(--gold)" :
    "var(--accent)";

  async function logout() {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app">
      {/* ---- desktop sidebar ---- */}
      <aside className="sidebar">
        <Link href="/home" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="brand-mark" style={{ background: "transparent", boxShadow: "none" }}>
            <Image src="/logo.png" alt="TapIn" width={34} height={34} style={{ objectFit: "contain", mixBlendMode: "screen" }} />
          </div>
          <div className="brand-name">TapIn</div>
        </Link>
        <nav className="nav">
          {NAV.map((n) => {
            const badge = n.id === "predict" && pendingH2HCount > 0 ? pendingH2HCount : 0;
            return (
              <Link
                key={n.id}
                id={`tour-nav-${n.id}`}
                href={n.href}
                className={"nav-item" + (tab === n.id ? " on" : "")}
              >
                <span className="nav-ico" style={{ position: "relative" }}>
                  <Icon name={n.icon} size={20} />
                  {badge > 0 && (
                    <span className="nav-badge">{badge > 9 ? "9+" : badge}</span>
                  )}
                </span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Budget remaining */}
        <div id="tour-budget" style={{ padding: "10px 16px 0" }}>
          <div style={{
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            padding: "10px 12px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-3)", textTransform: "uppercase" }}>Squad Budget</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: budgetTone, fontVariantNumeric: "tabular-nums" }}>
                {budgetLabel} <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>left</span>
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 9999, background: "var(--line)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${budgetPct}%`, background: budgetTone, borderRadius: 9999, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>of £{(budgetTotal / 10).toFixed(1)}m total</div>
          </div>
        </div>
        <div className="side-foot">
          {/* Transfers happen in the squad editor now (knockout rounds). */}
          <Link href="/squad" className={"nav-item" + (pathname.startsWith("/squad") ? " on" : "")}>
            <span className="nav-ico">
              <Icon name="swap" size={20} />
            </span>
            Transfers
          </Link>
          <Link href="/settings" className={"nav-item" + (pathname.startsWith("/settings") ? " on" : "")}>
            <span className="nav-ico">
              <Icon name="settings" size={20} />
            </span>
            Settings
          </Link>
          <div className="side-user" style={{ marginTop: 10 }} onClick={logout}>
            <div className="avatar">{initial}</div>
            <div style={{ flex: 1 }}>
              <div className="su-name">{user?.name ?? "Manager"}</div>
              <div className="su-sub">{user?.handle ?? "log out"}</div>
            </div>
            <Icon name="chevright" size={16} style={{ color: "var(--text-3)" }} />
          </div>
        </div>
      </aside>

      {/* ---- mobile top bar ---- */}
      <header className="topbar">
        <Link href="/home" className="brand" style={{ padding: 0, textDecoration: "none", color: "inherit" }}>
          <div className="brand-mark" style={{ width: 30, height: 30, background: "transparent", boxShadow: "none" }}>
            <Image src="/logo.png" alt="TapIn" width={30} height={30} style={{ objectFit: "contain", mixBlendMode: "screen" }} />
          </div>
          <div className="brand-name" style={{ fontSize: 19 }}>
            TapIn
          </div>
        </Link>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <div
            id="tour-budget-mobile"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              borderRadius: 20, border: "1px solid var(--line)",
              background: "var(--surface-2)", padding: "4px 10px",
            }}
          >
            <Icon name="coins" size={13} style={{ color: budgetTone }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: budgetTone, fontVariantNumeric: "tabular-nums" }}>
              {budgetLabel}
            </span>
          </div>
          <div
            className="avatar"
            style={{ width: 32, height: 32, fontSize: 14, cursor: "pointer" }}
            onClick={() => router.push("/settings")}
            title="Settings"
          >
            {initial}
          </div>
        </div>
      </header>

      {/* ---- content ---- */}
      <main className="app-main">{children}</main>

      {/* ---- mobile bottom tab bar ---- */}
      <nav className="tabbar">
        {NAV.filter((n) => !n.mobileHidden).map((n) => {
          const badge = n.id === "predict" && pendingH2HCount > 0 ? pendingH2HCount : 0;
          return (
            <Link
              key={n.id}
              id={`tour-tab-${n.id}`}
              href={n.href}
              className={"tab" + (tab === n.id ? " on" : "")}
            >
              <span className="tab-ico" style={{ position: "relative" }}>
                <Icon name={n.icon} size={23} />
                {badge > 0 && (
                  <span className="nav-badge">{badge > 9 ? "9+" : badge}</span>
                )}
              </span>
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
