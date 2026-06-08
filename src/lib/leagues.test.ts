// Unit tests for leagues pure helpers. Run: `npm test`.
// No DB / no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateJoinCode,
  sortGroupStandings,
  sortLeagueStandings,
  rankStandings,
  type GroupTableRow,
  type LeagueStandingRow,
} from "./leagues.js";

// ── Join code ──────────────────────────────────────────────────────────────

test("generateJoinCode: matches GAF-XXXX pattern", () => {
  const code = generateJoinCode();
  assert.match(code, /^GAF-[A-HJ-NP-Z2-9]{4}$/);
});

test("generateJoinCode: no confusable chars (0, 1, O, I)", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateJoinCode();
    const suffix = code.slice(4);
    assert.ok(!/[01OI]/.test(suffix), `confusable char found in ${code}`);
  }
});

test("generateJoinCode: produces unique codes across 100 draws", () => {
  const codes = new Set(Array.from({ length: 100 }, () => generateJoinCode()));
  assert.ok(codes.size > 90, `only ${codes.size} unique codes in 100 draws`);
});

// ── Group standings sort ───────────────────────────────────────────────────

const row = (teamId: string, pts: number, gf: number, ga: number): GroupTableRow => ({
  teamId,
  teamName: teamId,
  played: 3,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: gf,
  goalsAgainst: ga,
  points: pts,
});

test("sortGroupStandings: primary sort by points", () => {
  const sorted = sortGroupStandings([
    row("c", 1, 1, 4),
    row("a", 3, 2, 4),
    row("d", 7, 6, 2),
    row("b", 6, 5, 3),
  ]);
  assert.deepEqual(sorted.map((r) => r.teamId), ["d", "b", "a", "c"]);
});

test("sortGroupStandings: goal difference as tiebreaker on equal points", () => {
  const sorted = sortGroupStandings([
    row("x", 6, 5, 4), // GD +1
    row("y", 6, 6, 3), // GD +3
  ]);
  assert.equal(sorted[0].teamId, "y");
});

test("sortGroupStandings: goals for as final tiebreaker on equal pts + GD", () => {
  const sorted = sortGroupStandings([
    row("p", 6, 4, 3), // GF 4, GD +1
    row("q", 6, 5, 4), // GF 5, GD +1
  ]);
  assert.equal(sorted[0].teamId, "q");
});

test("sortGroupStandings: does not mutate the input array", () => {
  const input = [row("b", 6, 3, 1), row("a", 9, 6, 0)];
  sortGroupStandings(input);
  assert.equal(input[0].teamId, "b"); // original order unchanged
});

// ── League standings sort ──────────────────────────────────────────────────

test("sortLeagueStandings: total points first, gw points as tiebreaker", () => {
  const rows = [
    { userId: "a", name: "Alice", gwPoints: 50, totalPoints: 800 },
    { userId: "b", name: "Bob", gwPoints: 70, totalPoints: 850 },
    { userId: "c", name: "Carol", gwPoints: 60, totalPoints: 800 },
  ];
  const sorted = sortLeagueStandings(rows);
  assert.equal(sorted[0].userId, "b");
  assert.equal(sorted[1].userId, "c"); // same total as a, higher gw
  assert.equal(sorted[2].userId, "a");
});

test("sortLeagueStandings: does not mutate the input array", () => {
  const rows = [
    { userId: "x", name: "X", gwPoints: 10, totalPoints: 200 },
    { userId: "y", name: "Y", gwPoints: 20, totalPoints: 300 },
  ];
  sortLeagueStandings(rows);
  assert.equal(rows[0].userId, "x");
});

// ── rankStandings: ranks + movement ──────────────────────────────────────────

const lr = (userId: string, total: number, gw: number): LeagueStandingRow => ({
  userId,
  name: userId.toUpperCase(),
  totalPoints: total,
  gwPoints: gw,
});

test("rankStandings: assigns 1-based ranks by total points", () => {
  const ranked = rankStandings([lr("a", 100, 10), lr("b", 250, 30), lr("c", 180, 5)]);
  // sorted b(250) > c(180) > a(100)
  assert.deepEqual(
    ranked.map((r) => [r.userId, r.rank]),
    [["b", 1], ["c", 2], ["a", 3]],
  );
});

test("rankStandings: ties share a rank (standard competition ranking)", () => {
  // a and b both 200 total + 10 gw → tie at rank 1; c is 3rd (not 2nd)
  const ranked = rankStandings([lr("a", 200, 10), lr("b", 200, 10), lr("c", 150, 5)]);
  const byUser = Object.fromEntries(ranked.map((r) => [r.userId, r.rank]));
  assert.equal(byUser.a, 1);
  assert.equal(byUser.b, 1);
  assert.equal(byUser.c, 3);
});

test("rankStandings: delta reflects movement vs before this gameweek", () => {
  // Before this GW (strip gwPoints):
  //   a: 100-40=60, b: 90-5=85, c: 80-0=80  → prev order b(1) c(2) a(3)
  // Now (with gw): a:100, b:90, c:80         → now order  a(1) b(2) c(3)
  // a climbed 3→1 (delta +2), b 1→2 (-1), c 2→3 (-1)
  const ranked = rankStandings([lr("a", 100, 40), lr("b", 90, 5), lr("c", 80, 0)]);
  const byUser = Object.fromEntries(ranked.map((r) => [r.userId, r.delta]));
  assert.equal(byUser.a, 2); // up 2
  assert.equal(byUser.b, -1); // down 1
  assert.equal(byUser.c, -1); // down 1
});

test("rankStandings: no points yet → everyone rank-tied with delta 0", () => {
  const ranked = rankStandings([lr("a", 0, 0), lr("b", 0, 0)]);
  assert.ok(ranked.every((r) => r.rank === 1 && r.delta === 0));
});
