// Loading skeleton for the Players market (ROADMAP 3.3). Shown by the App Router
// while the server component fetches the pool. Mirrors the list layout so the
// page doesn't jump when real data arrives.

function Bar({ w, h = 12 }: { w: number | string; h?: number }) {
  return (
    <span
      className="block animate-pulse rounded"
      style={{ width: typeof w === "number" ? `${w}px` : w, height: h, background: "var(--surface-3)" }}
    />
  );
}

export default function PlayersLoading() {
  return (
    <div>
      <Bar w={140} h={28} />
      <div className="mt-2">
        <Bar w={260} h={12} />
      </div>
      {/* filter bar placeholder */}
      <div
        className="mt-3.5 h-10 animate-pulse rounded-xl"
        style={{ background: "var(--surface-2)" }}
      />

      <div className="mt-4 flex flex-col gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border p-2.5 px-3.5"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <span
              className="h-[22px] w-[22px] shrink-0 animate-pulse rounded-full"
              style={{ background: "var(--surface-3)" }}
            />
            <div className="flex flex-1 flex-col gap-1.5">
              <Bar w="45%" />
              <Bar w="30%" h={10} />
            </div>
            <Bar w={40} h={16} />
            <Bar w={44} h={16} />
          </div>
        ))}
      </div>
    </div>
  );
}
