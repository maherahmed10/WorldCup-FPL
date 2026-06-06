import Link from "next/link";

// Temporary landing / index of the app surface. Each link is a feature area
// owned by one teammate (see TASKS.md). Replace with the real auth-gated shell
// once the auth + app-shell work lands.
const AREAS = [
  { href: "/team", label: "My Team", note: "dashboard · squad · transfers" },
  { href: "/players", label: "Players", note: "player market / pool" },
  { href: "/predict", label: "Predictions", note: "betting markets" },
  { href: "/leagues", label: "Leagues", note: "mini-leagues + leaderboards" },
  { href: "/fixtures", label: "Fixtures", note: "schedule + standings" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="mb-10 flex items-center gap-3">
        <div
          className="grid h-11 w-11 place-items-center rounded-xl font-[family-name:var(--font-display)] text-2xl font-extrabold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          G
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
            GAFFER
          </h1>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            World Cup 2026 Fantasy — dev shell
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {AREAS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center justify-between rounded-2xl border p-4 transition-colors"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <span className="font-semibold">{a.label}</span>
            <span className="text-sm" style={{ color: "var(--text-3)" }}>
              {a.note}
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm" style={{ color: "var(--text-3)" }}>
        See <code>TASKS.md</code> for who owns what and{" "}
        <code>CONTRIBUTING.md</code> for the branch workflow. The clickable design
        reference lives in <code>design/index.html</code>.
      </p>
    </main>
  );
}
