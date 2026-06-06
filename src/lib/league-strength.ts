// ─────────────────────────────────────────────────────────────────────────
// League-strength weighting for pricing (build-plan §6). A goal in the Premier
// League is worth more than one in a regional state league, so we discount each
// player's prior-season output by the quality of the competition it came from.
//
// Pure + unit-tested. `leagueWeight(name, country)` returns a 0–1.1 multiplier.
// We match by NAME for unambiguous competitions (continental cups, big-5 names),
// then fall back to the COUNTRY's top-flight weight, discounting obvious lower
// divisions by name keyword. Unknown competitions get a neutral default; the
// pricing job logs whatever defaults so the table can be tightened.
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHT = 0.55;

// Top-flight weight by country (the league a national-team player most often
// plays its club football in). Lower divisions are discounted from these.
const COUNTRY_TOP_FLIGHT: Record<string, number> = {
  England: 1.0, Spain: 1.0, Italy: 1.0, Germany: 1.0, France: 1.0,
  Netherlands: 0.82, Portugal: 0.82, Belgium: 0.78,
  Turkey: 0.68, "Türkiye": 0.68, Mexico: 0.66, USA: 0.62, Greece: 0.6,
  Austria: 0.6, Switzerland: 0.6, Scotland: 0.6, "Saudi Arabia": 0.6,
  Japan: 0.6, Russia: 0.62, Ukraine: 0.58,
  Brazil: 0.72, Argentina: 0.68, Croatia: 0.55, "Czech Republic": 0.55,
  Denmark: 0.58, Norway: 0.55, Sweden: 0.55, Poland: 0.55, Serbia: 0.55,
  "South Korea": 0.55, Qatar: 0.5, "United Arab Emirates": 0.5, China: 0.5,
};

// Competitions matched by name (substring, case-insensitive). Checked first.
const NAME_RULES: Array<[RegExp, number]> = [
  // International (national-team) competitions — small samples, weak-opponent risk.
  [/friendl/i, 0.4],
  [/nations league/i, 0.8],
  [/qualif/i, 0.7], // World Cup / Euro / etc. qualifiers
  [/world cup|euro\b|copa america|africa cup|asian cup|gold cup/i, 0.85],
  // Continental club cups.
  [/uefa champions league/i, 1.05],
  [/uefa europa league/i, 0.88],
  [/conference league/i, 0.8],
  [/libertadores/i, 0.8], // API name: "CONMEBOL Libertadores"
  [/sudamericana/i, 0.68], // API name: "CONMEBOL Sudamericana"
  [/afc champions league/i, 0.6],
  [/caf champions league/i, 0.55],
  [/concacaf/i, 0.55],
  // Unambiguous domestic top flights (name is globally unique).
  [/premier league/i, 1.0], // England
  [/la liga|laliga/i, 1.0],
  [/bundesliga(?!.*2|.*ii)/i, 1.0], // exclude 2.Bundesliga
  [/ligue 1/i, 1.0],
  [/eredivisie/i, 0.82],
  [/primeira liga|liga portugal/i, 0.82],
  [/jupiler/i, 0.78], // Belgian top flight (bare "Pro League" disambiguated by country)
  [/süper lig|super lig/i, 0.68],
  [/major league soccer|^mls$/i, 0.62],
  [/liga mx|liga bbva mx/i, 0.66],
  [/j1 league/i, 0.6],
  [/k league 1/i, 0.55],
  // Obvious lower divisions / regional cups → low.
  [/championship/i, 0.7], // England 2nd tier
  [/2\. ?bundesliga|2\.liga/i, 0.65],
  [/ligue 2|serie b|segunda|league one|league two|3\. ?liga/i, 0.5],
  [/paulista|carioca|mineiro|gaúcho|gaucho|baiano|state league|regional/i, 0.45],
  [/king'?s cup|domestic cup|copa do brasil|coppa italia|dfb pokal|fa cup|copa del rey/i, 0.6],
];

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/** Strength multiplier for a competition. */
export function leagueWeight(name: string, country?: string | null): number {
  const n = norm(name);
  for (const [re, w] of NAME_RULES) {
    if (re.test(n)) return w;
  }
  // Fall back to the country's top flight, discounting clear lower divisions.
  // This API hyphenates multi-word countries ("Czech-Republic") — normalise.
  const c = norm(country).replace(/-/g, " ");
  const base = COUNTRY_TOP_FLIGHT[c];
  if (base != null) {
    if (/\b(2|ii|b|segunda|second|reserve|u2[01]|youth)\b/i.test(n)) return base * 0.6;
    return base;
  }
  return DEFAULT_WEIGHT;
}
