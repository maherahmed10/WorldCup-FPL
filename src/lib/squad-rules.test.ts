// Unit tests for squad-validation rules (build-plan §2). Run: `npm test`.
// Pure functions — no DB/network — so the FPL rules are provably enforced.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSquad,
  isValidFormation,
  formationName,
  isNamedFormation,
  canSwap,
  canAddCountry,
  canAddPosition,
  canFieldFormation,
  splitStartingXI,
  defaultFormationFor,
  applyAutoSubs,
  totalPrice,
  BUDGET,
  type SquadPlayer,
  type Position,
  type PlayerWithMinutes,
} from "./squad-rules.js";

let seq = 0;
const mk = (position: Position, price: number, country: string): SquadPlayer => ({
  id: `p${++seq}`,
  position,
  price,
  country,
});

// Build a valid 15-player squad: 2 GK, 5 DEF, 5 MID, 3 FWD, ≤1000, ≤3/country.
function validFifteen(): SquadPlayer[] {
  const countries = ["ARG", "FRA", "BRA", "ENG", "ESP", "GER", "POR", "NED", "USA", "MEX", "JPN", "MAR", "CRO", "BEL", "ITA"];
  const spec: Position[] = [
    "GK", "GK",
    "DEF", "DEF", "DEF", "DEF", "DEF",
    "MID", "MID", "MID", "MID", "MID",
    "FWD", "FWD", "FWD",
  ];
  // 15 players × 60 = 900 ≤ 1000 budget, each a distinct country (≤3 rule safe).
  return spec.map((pos, i) => mk(pos, 60, countries[i]));
}

test("a correct 15-player squad is valid", () => {
  const r = validateSquad(validFifteen());
  assert.equal(r.valid, true);
  assert.equal(r.complete, true);
  assert.equal(r.total, 15);
  assert.equal(r.errors.length, 0);
});

test("incomplete squad is flagged with a size error", () => {
  const r = validateSquad(validFifteen().slice(0, 10));
  assert.equal(r.complete, false);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === "size"));
});

test("over budget is rejected", () => {
  const squad = validFifteen();
  squad[0] = mk("GK", 200, "ZZ1"); // bump one player so total > 1000
  // total = 900 - 60 + 200 = 1040 > 1000
  const r = validateSquad(squad);
  assert.ok(totalPrice(squad) > BUDGET);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === "budget"));
});

test("exactly at budget (1000) is allowed", () => {
  const squad = validFifteen(); // 900
  squad[0] = mk("GK", 160, "ZZ2"); // +100 => 1000
  const r = validateSquad(squad);
  assert.equal(totalPrice(squad), 1000);
  assert.equal(r.valid, true);
});

test("max 3 per country enforced", () => {
  const squad = validFifteen();
  // make 4 players share a country
  squad[2] = mk("DEF", 60, "ARG");
  squad[3] = mk("DEF", 60, "ARG");
  squad[4] = mk("DEF", 60, "ARG");
  squad[7] = mk("MID", 60, "ARG"); // squad[0] is also ARG-adjacent? no — index 0 is ARG via countries[0]
  const r = validateSquad(squad);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === "country"));
});

test("wrong composition (full 15 but bad position counts) is flagged", () => {
  const squad = validFifteen();
  squad[14] = mk("MID", 60, "ZZ3"); // now 6 MID / 2 FWD instead of 5/3
  const r = validateSquad(squad);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === "quota"));
});

test("isValidFormation: 4-4-2 passes, 11 with no GK fails", () => {
  const ok = [
    mk("GK", 50, "A"),
    ...Array.from({ length: 4 }, () => mk("DEF", 50, "B")),
    ...Array.from({ length: 4 }, () => mk("MID", 50, "C")),
    ...Array.from({ length: 2 }, () => mk("FWD", 50, "D")),
  ];
  assert.equal(isValidFormation(ok), true);

  const noKeeper = [
    ...Array.from({ length: 5 }, () => mk("DEF", 50, "B")),
    ...Array.from({ length: 4 }, () => mk("MID", 50, "C")),
    ...Array.from({ length: 2 }, () => mk("FWD", 50, "D")),
  ];
  assert.equal(isValidFormation(noKeeper), false); // 0 GK

  const tooManyFwd = [
    mk("GK", 50, "A"),
    ...Array.from({ length: 3 }, () => mk("DEF", 50, "B")),
    ...Array.from({ length: 3 }, () => mk("MID", 50, "C")),
    ...Array.from({ length: 4 }, () => mk("FWD", 50, "D")), // 4 FWD > max 3
  ];
  assert.equal(isValidFormation(tooManyFwd), false);
});

test("canAddCountry / canAddPosition guards", () => {
  const three = [mk("DEF", 50, "ARG"), mk("MID", 50, "ARG"), mk("FWD", 50, "ARG")];
  assert.equal(canAddCountry(three, "ARG"), false);
  assert.equal(canAddCountry(three, "FRA"), true);

  const twoGk = [mk("GK", 50, "A"), mk("GK", 50, "B")];
  assert.equal(canAddPosition(twoGk, "GK"), false); // quota is 2
  assert.equal(canAddPosition(twoGk, "DEF"), true);
});

// ───────────── starting XI / bench (FPL formation model) ─────────────

test("full 15-squad can field every standard formation", () => {
  const squad = validFifteen(); // 2 GK, 5 DEF, 5 MID, 3 FWD
  for (const f of ["4-4-2", "4-3-3", "3-5-2", "3-4-3", "5-3-2", "4-5-1"]) {
    assert.equal(canFieldFormation(squad, f), true, `should field ${f}`);
  }
});

test("splitStartingXI gives 11 starters + 4 bench, formation-correct", () => {
  const squad = validFifteen();
  const split = splitStartingXI(squad, "3-5-2");
  assert.ok(split);
  assert.equal(split!.starters.length, 11);
  assert.equal(split!.bench.length, 4);
  // 3-5-2 => starters have 1 GK, 3 DEF, 5 MID, 2 FWD
  const startPos = (p: Position) => split!.starters.filter((s) => s.position === p).length;
  assert.equal(startPos("GK"), 1);
  assert.equal(startPos("DEF"), 3);
  assert.equal(startPos("MID"), 5);
  assert.equal(startPos("FWD"), 2);
});

test("switching formation NEVER drops a squad player (the bug we fixed)", () => {
  const squad = validFifteen();
  const ids = new Set(squad.map((p) => p.id));
  for (const f of ["3-4-3", "5-3-2", "4-5-1"]) {
    const split = splitStartingXI(squad, f)!;
    const after = new Set([...split.starters, ...split.bench].map((p) => p.id));
    assert.equal(after.size, 15, `${f} keeps all 15`);
    for (const id of ids) assert.ok(after.has(id), `${f} keeps ${id}`);
  }
});

test("bench always lists the reserve GK first", () => {
  const squad = validFifteen();
  const split = splitStartingXI(squad, "4-4-2")!;
  assert.equal(split.bench[0].position, "GK"); // the 2nd keeper benches, listed first
});

test("defaultFormationFor returns a fieldable formation", () => {
  const squad = validFifteen();
  const f = defaultFormationFor(squad);
  assert.ok(f);
  assert.equal(canFieldFormation(squad, f!), true);
});

// ───────────── allowable named formations (picker restriction) ─────────────

// Build a starting XI for a given line shape (always 1 GK).
function xi(def: number, mid: number, fwd: number): SquadPlayer[] {
  return [
    mk("GK", 50, "A"),
    ...Array.from({ length: def }, () => mk("DEF", 50, "B")),
    ...Array.from({ length: mid }, () => mk("MID", 50, "C")),
    ...Array.from({ length: fwd }, () => mk("FWD", 50, "D")),
  ];
}

test("formationName identifies each allowed formation", () => {
  assert.equal(formationName(xi(4, 3, 3)), "4-3-3");
  assert.equal(formationName(xi(4, 4, 2)), "4-4-2");
  assert.equal(formationName(xi(3, 5, 2)), "3-5-2");
  assert.equal(formationName(xi(5, 3, 2)), "5-3-2");
});

test("5-4-1 is now an allowed named formation", () => {
  const shape = xi(5, 4, 1);
  assert.equal(isValidFormation(shape), true); // within line bounds
  assert.equal(isNamedFormation(shape), true); // and a named formation
  assert.equal(formationName(shape), "5-4-1");
});

test("5-2-3 is now an allowed named formation", () => {
  const shape = xi(5, 2, 3);
  assert.equal(isNamedFormation(shape), true);
  assert.equal(formationName(shape), "5-2-3");
});

test("4-1-5 is still NOT an allowed formation (too few mids)", () => {
  const shape = xi(4, 1, 5);
  assert.equal(isNamedFormation(shape), false);
  assert.equal(formationName(shape), null);
});

test("canSwap: 4-3-3 → sub a FWD for a MID gives 4-4-2 (allowed)", () => {
  const starters = xi(4, 3, 3);
  const fwdOut = starters.find((p) => p.position === "FWD")!;
  const midIn = mk("MID", 50, "Z");
  assert.equal(canSwap(starters, fwdOut, midIn), true);
});

test("canSwap: 4-4-2 → sub a FWD for a DEF gives 5-4-1 (now allowed)", () => {
  const starters = xi(4, 4, 2);
  const fwdOut = starters.find((p) => p.position === "FWD")!;
  const defIn = mk("DEF", 50, "Z");
  assert.equal(canSwap(starters, fwdOut, defIn), true);
});

test("canSwap: 4-4-2 → sub a MID for a DEF gives 5-3-2 (allowed)", () => {
  const starters = xi(4, 4, 2);
  const midOut = starters.find((p) => p.position === "MID")!;
  const defIn = mk("DEF", 50, "Z");
  assert.equal(canSwap(starters, midOut, defIn), true); // 5-3-2 is a named formation
});

test("canSwap: same-position sub is always allowed", () => {
  const starters = xi(4, 3, 3);
  const midOut = starters.find((p) => p.position === "MID")!;
  const midIn = mk("MID", 50, "Z");
  assert.equal(canSwap(starters, midOut, midIn), true);
});

// ───────────── bench auto-subs ─────────────────────────────────────

const mkM = (pos: Position, mins: number): PlayerWithMinutes =>
  ({ ...mk(pos, 50, pos + mins), minutesPlayed: mins });

// Build a 4-3-3 starting XI with one non-playing FWD.
function starters433(nonPlayingPos: Position, nonPlayingIdx = 0): PlayerWithMinutes[] {
  const xi: PlayerWithMinutes[] = [
    mkM("GK", 90),
    mkM("DEF", 90), mkM("DEF", 90), mkM("DEF", 90), mkM("DEF", 90),
    mkM("MID", 90), mkM("MID", 90), mkM("MID", 90),
    mkM("FWD", 90), mkM("FWD", 90), mkM("FWD", 90),
  ];
  // Zero out the nth player of nonPlayingPos
  let count = 0;
  for (let i = 0; i < xi.length; i++) {
    if (xi[i].position === nonPlayingPos && count++ === nonPlayingIdx) {
      xi[i] = { ...xi[i], minutesPlayed: 0 };
      break;
    }
  }
  return xi;
}

test("applyAutoSubs: replaces non-playing starter with first eligible bench player", () => {
  // 4-3-3, one FWD didn't play. Bench: bench_GK(0 mins), bench_FWD(90 mins), bench_DEF, bench_MID.
  const starters = starters433("FWD");
  const bench: PlayerWithMinutes[] = [
    mkM("GK", 0),   // priority 1 — didn't play, skip
    mkM("FWD", 90), // priority 2 — played, same position → sub in
    mkM("DEF", 90),
    mkM("MID", 90),
  ];

  const { starters: after, subs } = applyAutoSubs(starters, bench);

  assert.equal(subs.length, 1);
  assert.equal(subs[0].out.position, "FWD");
  assert.equal(subs[0].in.position, "FWD");
  // The non-playing FWD is gone; bench FWD is now starting.
  assert.ok(after.some((p) => p.id === subs[0].in.id));
  assert.ok(!after.some((p) => p.id === subs[0].out.id));
  // Formation still valid (FWD for FWD, shape unchanged).
  assert.ok(formationName(after) !== null);
});

test("applyAutoSubs: skips sub when every eligible bench player would break the formation", () => {
  // 3-5-2 — one DEF didn't play. Only bench player who played is a FWD.
  // Swapping DEF for FWD → 2-5-3 which is not a legal named formation → no sub.
  const s: PlayerWithMinutes[] = [
    mkM("GK", 90),
    mkM("DEF", 0), mkM("DEF", 90), mkM("DEF", 90), // first DEF didn't play
    mkM("MID", 90), mkM("MID", 90), mkM("MID", 90), mkM("MID", 90), mkM("MID", 90),
    mkM("FWD", 90), mkM("FWD", 90),
  ];
  const bench: PlayerWithMinutes[] = [
    mkM("GK", 0),   // didn't play
    mkM("FWD", 90), // played, but DEF→FWD would give 2-5-3 (illegal)
    mkM("FWD", 90),
    mkM("FWD", 90),
  ];

  const { subs } = applyAutoSubs(s, bench);
  assert.equal(subs.length, 0, "no sub should happen when formation would break");
});

test("applyAutoSubs: GK only replaced by GK even when outfielders have higher bench priority", () => {
  // Bench priority: DEF first, then GK. Non-playing starter is the GK.
  // DEF cannot legally replace GK (would leave 0 GKs → fails formation).
  const starters = starters433("GK");
  const bench: PlayerWithMinutes[] = [
    mkM("DEF", 90), // priority 1 — can't replace GK (formation fails)
    mkM("GK", 90),  // priority 2 — same position, legal
    mkM("MID", 90),
    mkM("FWD", 90),
  ];

  const { subs } = applyAutoSubs(starters, bench);
  assert.equal(subs.length, 1);
  assert.equal(subs[0].out.position, "GK");
  assert.equal(subs[0].in.position, "GK", "GK must be replaced by GK");
});
