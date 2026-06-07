"use client";

// App shell ported from design/app.jsx — desktop sidebar + mobile top bar +
// mobile bottom tab bar. Wraps every authed route. Active state derives from
// the current pathname.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

const NAV = [
  { id: "team", label: "My Team", icon: "team", href: "/team" },
  { id: "players", label: "Players", icon: "players", href: "/players" },
  { id: "predict", label: "Predictions", icon: "predictions", href: "/predict" },
  { id: "store", label: "Store", icon: "store", href: "/store" },
  { id: "leagues", label: "Leagues", icon: "leagues", href: "/leagues" },
  { id: "fixtures", label: "Fixtures", icon: "fixtures", href: "/fixtures" },
];

// Routes under the "team" tab group (dashboard, squad picker, transfers).
const TEAM_ROUTES = ["/team", "/squad", "/transfers"];

function activeTab(pathname: string): string {
  if (TEAM_ROUTES.some((r) => pathname.startsWith(r))) return "team";
  const match = NAV.find((n) => pathname.startsWith(n.href));
  return match?.id ?? "team";
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: { name: string; handle?: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tab = activeTab(pathname);
  const initial = (user?.name ?? "G").charAt(0).toUpperCase();

  async function logout() {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app">
      {/* ---- desktop sidebar ---- */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div className="brand-name">GAFFER</div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className={"nav-item" + (tab === n.id ? " on" : "")}
            >
              <span className="nav-ico">
                <Icon name={n.icon} size={20} />
              </span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <Link href="/squad" className="nav-item">
            <span className="nav-ico">
              <Icon name="plus" size={20} />
            </span>
            Pick / Edit Team
          </Link>
          <Link href="/transfers" className="nav-item">
            <span className="nav-ico">
              <Icon name="swap" size={20} />
            </span>
            Transfers
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
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark" style={{ width: 30, height: 30, fontSize: 17 }}>
            G
          </div>
          <div className="brand-name" style={{ fontSize: 19 }}>
            GAFFER
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <div
            className="avatar"
            style={{ width: 32, height: 32, fontSize: 14, cursor: "pointer" }}
            onClick={logout}
          >
            {initial}
          </div>
        </div>
      </header>

      {/* ---- content ---- */}
      <main className="app-main">{children}</main>

      {/* ---- mobile bottom tab bar ---- */}
      <nav className="tabbar">
        {NAV.map((n) => (
          <Link
            key={n.id}
            href={n.href}
            className={"tab" + (tab === n.id ? " on" : "")}
          >
            <span className="tab-ico">
              <Icon name={n.icon} size={23} />
            </span>
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
