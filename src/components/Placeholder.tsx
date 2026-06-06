import Link from "next/link";

// Shared "not built yet" stub so route pages render something on-brand while
// the owning teammate builds the real screen. Delete the import when done.
export function Placeholder({
  title,
  owner,
  designRef,
  children,
}: {
  title: string;
  owner: string;
  designRef: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/" className="text-sm" style={{ color: "var(--text-3)" }}>
        ← dev shell
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-extrabold">
        {title}
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-2)" }}>
        Owner: <strong>{owner}</strong> · Design reference:{" "}
        <code>{designRef}</code>
      </p>
      <div
        className="mt-6 rounded-2xl border p-5 text-sm"
        style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--text-2)" }}
      >
        {children ?? "Not built yet — see TASKS.md for acceptance criteria."}
      </div>
    </main>
  );
}
