// ─────────────────────────────────────────────────────────────────────────
// Player-profile view-model (for the player-detail modal). Reads everything
// from our DB — bio + season stats from the Player row, the match-by-match
// breakdown + form from PlayerMatchStat, upcoming fixtures from Fixture.
// Pure mapper + FDR helper here; the page/modal loads via Prisma and maps.
// ─────────────────────────────────────────────────────────────────────────

import type { Position } from "@/lib/players";
import { breakdownMatch, type PointComponent, type Position as ScoringPosition } from "@/lib/scoring";

// Fixture Difficulty Rating by country (1 very easy … 5 very hard).
// From the design handoff's STRENGTH map, keyed by our Team.country names.
const STRENGTH: Record<string, number> = {
  Brazil: 5, France: 5, England: 5, Spain: 5, Argentina: 5,
  Germany: 4, Portugal: 4, Netherlands: 4, Belgium: 4, Italy: 4,
  Croatia: 3, Uruguay: 3, USA: 3, Mexico: 3, Senegal: 3, Morocco: 3, Japan: 3,
  Colombia: 3, Ecuador: 3, "South-Korea": 3, Switzerland: 3, Austria: 3,
  Canada: 2, Australia: 2, Norway: 3, Sweden: 3, Egypt: 3, Ghana: 3,
};
export function fdrFor(country: string): number {
  return STRENGTH[country] ?? 3; // unknown = even
}
export const FDR_LABEL = ["", "Very easy", "Easy", "Even", "Hard", "Very hard"];

export interface ProfileMatchRow {
  round: string; // gameweek label, abbreviated
  opp: string; // opponent country/name (for Flag + display)
  home: boolean; // player's team was home
  score: [number, number]; // from the player's team's perspective
  result: "W" | "D" | "L";
  minutes: number;
  goals: number;
  assists: number;
  yellow: boolean;
  red: boolean;
  rating: number | null;
  fantasy: number;
  components: PointComponent[]; // itemised point breakdown for this match
}

export interface ProfileFixtureRow {
  round: string;
  opp: string; // opponent country
  home: boolean;
  when: string; // formatted kickoff
  fdr: number; // 1–5
}

export interface PlayerProfileView {
  id: string;
  name: string;
  position: Position;
  price: number; // millions
  country: string; // team display name (drives Flag)
  photoUrl: string | null;
  // bio
  nationality: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  injured: boolean;
  // season stats
  season: {
    apps: number | null;
    minutes: number | null;
    goals: number | null;
    assists: number | null;
    rating: number | null;
    cleanSheets: number | null; // derived; null for MID/FWD
  };
  // fantasy (derived from settled matchStats)
  pts: number;
  ppg: number;
  form: number[];
  // tables
  matches: ProfileMatchRow[];
  upcoming: ProfileFixtureRow[];
}

const FORM_WINDOW = 5;

// Shapes we read off Prisma (kept local so the mapper has no Prisma import).
export interface ProfilePlayerRecord {
  id: string;
  name: string;
  position: Position;
  price: number; // tenths
  photoUrl: string | null;
  nationality: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  injured: boolean;
  seasonAppearances: number | null;
  seasonMinutes: number | null;
  seasonGoals: number | null;
  seasonAssists: number | null;
  seasonRating: number | null;
  teamId: string;
  team: { name: string };
  matchStats: Array<{
    minutes: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    goalsConceded: number;
    saves: number;
    penaltiesSaved: number;
    penaltiesMissed: number;
    ownGoals: number;
    rating: number | null;
    fantasyPoints: number | null;
    fixture: {
      kickoff: Date;
      homeScore: number | null;
      awayScore: number | null;
      homeTeamId: string;
      awayTeamId: string;
      homeTeam: { name: string };
      awayTeam: { name: string };
      gameweek: { label: string };
    };
  }>;
}

export interface ProfileFixtureRecord {
  kickoff: Date;
  homeTeamId: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  gameweek: { label: string };
}

function abbrevRound(label: string): string {
  return label
    .replace("Round of ", "R")
    .replace("Group ", "")
    .replace("Quarter-finals", "QF")
    .replace("Semi-finals", "SF")
    .replace("Final & 3rd place", "Final");
}

function fmtKickoff(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "UTC",
  }).format(d).replace(",", "");
}

/** Build the full profile view-model from a DB player + its upcoming fixtures. */
export function toPlayerProfile(
  p: ProfilePlayerRecord,
  upcomingFixtures: ProfileFixtureRecord[],
): PlayerProfileView {
  const settled = p.matchStats
    .filter((s) => s.fantasyPoints != null)
    .sort((a, b) => a.fixture.kickoff.getTime() - b.fixture.kickoff.getTime());

  const scores = settled.map((s) => s.fantasyPoints as number);
  const pts = scores.reduce((sum, n) => sum + n, 0);
  const ppg = scores.length ? pts / scores.length : 0;

  // Clean sheets: GK/DEF only, derived (60+ min, 0 conceded).
  const tracksCleanSheets = p.position === "GK" || p.position === "DEF";
  const cleanSheets = tracksCleanSheets
    ? settled.filter((s) => s.minutes >= 60 && s.goalsConceded === 0).length
    : null;

  const matches: ProfileMatchRow[] = settled.map((s) => {
    const f = s.fixture;
    const home = f.homeTeamId === p.teamId;
    const oppName = home ? f.awayTeam.name : f.homeTeam.name;
    const myGoals = (home ? f.homeScore : f.awayScore) ?? 0;
    const oppGoals = (home ? f.awayScore : f.homeScore) ?? 0;
    const result: "W" | "D" | "L" = myGoals > oppGoals ? "W" : myGoals < oppGoals ? "L" : "D";
    const components = breakdownMatch({
      position: p.position as ScoringPosition,
      minutes: s.minutes,
      goals: s.goals,
      assists: s.assists,
      yellowCards: s.yellowCards,
      redCards: s.redCards,
      saves: s.saves,
      penaltiesSaved: s.penaltiesSaved,
      penaltiesMissed: s.penaltiesMissed,
      goalsConceded: s.goalsConceded,
      ownGoals: s.ownGoals,
    });
    return {
      round: abbrevRound(f.gameweek.label),
      opp: oppName,
      home,
      score: [myGoals, oppGoals],
      result,
      minutes: s.minutes,
      goals: s.goals,
      assists: s.assists,
      yellow: s.yellowCards > 0,
      red: s.redCards > 0,
      rating: s.rating,
      fantasy: s.fantasyPoints ?? 0,
      components,
    };
  });

  const upcoming: ProfileFixtureRow[] = upcomingFixtures.map((f) => {
    const home = f.homeTeamId === p.teamId;
    const oppName = home ? f.awayTeam.name : f.homeTeam.name;
    return {
      round: abbrevRound(f.gameweek.label),
      opp: oppName,
      home,
      when: fmtKickoff(f.kickoff),
      fdr: fdrFor(oppName),
    };
  });

  return {
    id: p.id,
    name: p.name,
    position: p.position,
    price: p.price / 10,
    country: p.team.name,
    photoUrl: p.photoUrl,
    nationality: p.nationality,
    age: p.age,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    injured: p.injured,
    season: {
      apps: p.seasonAppearances,
      minutes: p.seasonMinutes,
      goals: p.seasonGoals,
      assists: p.seasonAssists,
      rating: p.seasonRating,
      cleanSheets,
    },
    pts,
    ppg,
    form: scores.slice(-FORM_WINDOW),
    matches,
    upcoming,
  };
}
