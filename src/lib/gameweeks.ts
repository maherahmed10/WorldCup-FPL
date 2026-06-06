// ─────────────────────────────────────────────────────────────────────────
// Gameweek / round date-buckets (build-plan §4).
//
// CRITICAL: do NOT use one global matchday deadline. Group rounds 2 & 3 overlap
// across the 12 groups, so gameweeks are CALENDAR RANGES, not matchdays.
// There is a clean break between every knockout round, so transfer windows are
// calendar-clean. These ranges come from API-Football's official 2026 schedule.
//
// Dates are UTC. Deadlines default to the first kickoff in the bucket (set the
// real per-bucket deadline when fixtures are synced — see jobs/sync.ts).
// ─────────────────────────────────────────────────────────────────────────

import type { RoundType } from "@prisma/client";

export interface GameweekDef {
  label: string;
  roundType: RoundType;
  startsAt: string; // ISO date (UTC)
  endsAt: string;
  isKnockout: boolean;
}

// Matches the §4 structure. Group stage is split into 3 matchday buckets by
// calendar window; knockout rounds are one bucket each = one transfer window.
export const GAMEWEEK_DEFS: GameweekDef[] = [
  { label: "Group MD1", roundType: "GROUP", startsAt: "2026-06-11", endsAt: "2026-06-17", isKnockout: false },
  { label: "Group MD2", roundType: "GROUP", startsAt: "2026-06-18", endsAt: "2026-06-23", isKnockout: false },
  { label: "Group MD3", roundType: "GROUP", startsAt: "2026-06-24", endsAt: "2026-06-27", isKnockout: false },
  { label: "Round of 32", roundType: "R32", startsAt: "2026-06-28", endsAt: "2026-07-03", isKnockout: true },
  { label: "Round of 16", roundType: "R16", startsAt: "2026-07-04", endsAt: "2026-07-07", isKnockout: true },
  { label: "Quarter-finals", roundType: "QF", startsAt: "2026-07-09", endsAt: "2026-07-11", isKnockout: true },
  { label: "Semi-finals", roundType: "SF", startsAt: "2026-07-14", endsAt: "2026-07-15", isKnockout: true },
  { label: "Final & 3rd place", roundType: "FINAL", startsAt: "2026-07-18", endsAt: "2026-07-19", isKnockout: true },
];

/** Map a fixture kickoff (UTC) to its gameweek bucket by calendar range. */
export function bucketForKickoff(kickoff: Date): GameweekDef | undefined {
  return GAMEWEEK_DEFS.find((g) => {
    const start = new Date(`${g.startsAt}T00:00:00Z`);
    const end = new Date(`${g.endsAt}T23:59:59Z`);
    return kickoff >= start && kickoff <= end;
  });
}

/** Best-effort mapping from API-Football round string to our RoundType. */
export function roundTypeFromApiRound(round: string): RoundType {
  const r = round.toLowerCase();
  if (r.includes("round of 32")) return "R32";
  if (r.includes("round of 16")) return "R16";
  if (r.includes("quarter")) return "QF";
  if (r.includes("semi")) return "SF";
  if (r.includes("3rd place") || r.includes("third place")) return "THIRD_PLACE";
  if (r.includes("final")) return "FINAL";
  return "GROUP";
}
