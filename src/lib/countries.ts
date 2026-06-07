// Maps the API's country names (as stored in Team.country) to ISO-3166 alpha-2
// codes used by flag-icons, plus a short display code for fallbacks.
// England/Scotland use the GB sub-region codes flag-icons supports.

export interface CountryMeta {
  iso: string; // flag-icons code (lowercase), e.g. "ma", "gb-eng"
  code: string; // 3-letter display code, e.g. "MAR"
}

export const COUNTRIES: Record<string, CountryMeta> = {
  Algeria: { iso: "dz", code: "ALG" },
  Argentina: { iso: "ar", code: "ARG" },
  Australia: { iso: "au", code: "AUS" },
  Austria: { iso: "at", code: "AUT" },
  Belgium: { iso: "be", code: "BEL" },
  Bosnia: { iso: "ba", code: "BIH" },
  Brazil: { iso: "br", code: "BRA" },
  Canada: { iso: "ca", code: "CAN" },
  "Cape-Verde-Islands": { iso: "cv", code: "CPV" },
  Colombia: { iso: "co", code: "COL" },
  "Congo-DR": { iso: "cd", code: "COD" },
  Croatia: { iso: "hr", code: "CRO" },
  Curacao: { iso: "cw", code: "CUW" },
  "Czech-Republic": { iso: "cz", code: "CZE" },
  Ecuador: { iso: "ec", code: "ECU" },
  Egypt: { iso: "eg", code: "EGY" },
  England: { iso: "gb-eng", code: "ENG" },
  France: { iso: "fr", code: "FRA" },
  Germany: { iso: "de", code: "GER" },
  Ghana: { iso: "gh", code: "GHA" },
  Haiti: { iso: "ht", code: "HAI" },
  Iran: { iso: "ir", code: "IRN" },
  Iraq: { iso: "iq", code: "IRQ" },
  "Ivory-Coast": { iso: "ci", code: "CIV" },
  Italy: { iso: "it", code: "ITA" },
  Japan: { iso: "jp", code: "JPN" },
  Jordan: { iso: "jo", code: "JOR" },
  Mexico: { iso: "mx", code: "MEX" },
  Morocco: { iso: "ma", code: "MAR" },
  Netherlands: { iso: "nl", code: "NED" },
  "New-Zealand": { iso: "nz", code: "NZL" },
  Norway: { iso: "no", code: "NOR" },
  Panama: { iso: "pa", code: "PAN" },
  Paraguay: { iso: "py", code: "PAR" },
  Portugal: { iso: "pt", code: "POR" },
  Qatar: { iso: "qa", code: "QAT" },
  "Saudi-Arabia": { iso: "sa", code: "KSA" },
  Scotland: { iso: "gb-sct", code: "SCO" },
  Senegal: { iso: "sn", code: "SEN" },
  "South-Africa": { iso: "za", code: "RSA" },
  "South-Korea": { iso: "kr", code: "KOR" },
  Spain: { iso: "es", code: "ESP" },
  Sweden: { iso: "se", code: "SWE" },
  Switzerland: { iso: "ch", code: "SUI" },
  Tunisia: { iso: "tn", code: "TUN" },
  Turkey: { iso: "tr", code: "TUR" },
  Uruguay: { iso: "uy", code: "URU" },
  USA: { iso: "us", code: "USA" },
  "United States": { iso: "us", code: "USA" },
  Uzbekistan: { iso: "uz", code: "UZB" },
};

// Team.name uses spaces + full names ("South Africa", "Bosnia & Herzegovina"),
// while COUNTRIES keys use the hyphenated Team.country form ("South-Africa",
// "Bosnia"). Map the name variants → canonical key so flags resolve either way.
const NAME_ALIASES: Record<string, string> = {
  "South Africa": "South-Africa",
  "South Korea": "South-Korea",
  "Czech Republic": "Czech-Republic",
  "Cape Verde Islands": "Cape-Verde-Islands",
  "Congo DR": "Congo-DR",
  "Ivory Coast": "Ivory-Coast",
  "New Zealand": "New-Zealand",
  "Saudi Arabia": "Saudi-Arabia",
  "Bosnia & Herzegovina": "Bosnia",
  "Bosnia and Herzegovina": "Bosnia",
  "United States": "USA",
  Türkiye: "Turkey",
  Curaçao: "Curacao",
};

/** Resolve any country/team string to its canonical COUNTRIES key, or null. */
function canonical(country: string): string | null {
  if (COUNTRIES[country]) return country; // exact (hyphenated) key
  const alias = NAME_ALIASES[country];
  if (alias && COUNTRIES[alias]) return alias;
  const hyphenated = country.replace(/\s+/g, "-"); // "South Africa" → "South-Africa"
  if (COUNTRIES[hyphenated]) return hyphenated;
  return null;
}

export function countryIso(country: string): string | null {
  const key = canonical(country);
  return key ? COUNTRIES[key].iso : null;
}

export function countryCode(country: string): string {
  const key = canonical(country);
  return key ? COUNTRIES[key].code : country.slice(0, 3).toUpperCase();
}
