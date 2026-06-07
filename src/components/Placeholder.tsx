// Shared "not built yet" stub so route pages render something on-brand while
// the owning teammate builds the real screen. Renders inside the app shell.
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
    <div className="screen">
      <div className="screen-head">
        <h1>{title}</h1>
        <div className="sub">
          Owner: <strong>{owner}</strong> · Design: <code>{designRef}</code>
        </div>
      </div>
      <div className="card" style={{ padding: 20, color: "var(--text-2)", fontSize: 14 }}>
        {children ?? "Not built yet — see TASKS.md for acceptance criteria."}
      </div>
    </div>
  );
}
