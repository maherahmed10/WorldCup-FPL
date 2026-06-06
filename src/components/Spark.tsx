// Form sparkline (ported from design/components.jsx `Spark`). Pure SVG, no
// state. Renders nothing useful with <2 points, so callers should hide it when
// a player has no settled matches yet.

export function Spark({ data, w = 58, h = 20 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) {
    return (
      <span className="num" style={{ color: "var(--text-3)", fontSize: 11 }}>
        —
      </span>
    );
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const rng = Math.max(1, max - min);
  const pts = data.map(
    (v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / rng) * (h - 3) - 1.5] as const,
  );
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = data[data.length - 1];
  const prev = data[data.length - 2] ?? last;
  const col = last >= prev ? "var(--accent)" : "var(--live)";
  const tail = pts[pts.length - 1];
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <path d={d} fill="none" stroke={col} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={tail[0]} cy={tail[1]} r={2.2} fill={col} />
    </svg>
  );
}
