// Loading skeleton for the Predictions screen (ROADMAP 3.3). Shown while the
// server component fetches fixtures + markets + the user's bets.

function Bar({ w, h = 12 }: { w: number | string; h?: number }) {
  return (
    <span
      className="block animate-pulse rounded"
      style={{ width: typeof w === "number" ? `${w}px` : w, height: h, background: "var(--surface-3)" }}
    />
  );
}

export default function PredictLoading() {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Bar w={170} h={28} />
          <Bar w={280} h={12} />
        </div>
        <div className="h-12 w-28 animate-pulse rounded-2xl" style={{ background: "var(--surface)" }} />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <div
              className="mb-3 flex items-center justify-between border-b pb-3"
              style={{ borderColor: "var(--line)" }}
            >
              <Bar w={180} h={16} />
              <Bar w={70} h={12} />
            </div>
            <Bar w={120} h={11} />
            <div className="mt-2 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  key={j}
                  className="h-10 animate-pulse rounded-lg"
                  style={{ background: "var(--surface-2)" }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
