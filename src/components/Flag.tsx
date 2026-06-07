// Country flag backed by the flag-icons library — full coverage of all 48
// World Cup nations. Pass the country NAME (as stored in Team.country).
// Falls back to a 2-letter code badge for anything unmapped.
import { countryIso, countryCode } from "@/lib/countries";

export function Flag({
  country,
  size = 18,
  round = false,
  style,
}: {
  country: string;
  size?: number;
  round?: boolean;
  style?: React.CSSProperties;
}) {
  const iso = countryIso(country);
  const w = round ? size : size * 1.5;
  const base: React.CSSProperties = {
    display: "inline-flex",
    flex: "0 0 auto",
    width: `${w}px`,
    height: `${size}px`,
    borderRadius: round ? "50%" : "3px",
    overflow: "hidden",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
    ...style,
  };

  if (iso) {
    return (
      <span
        className={`fi fi-${iso}${round ? " fis" : ""}`}
        style={{ ...base, backgroundSize: "cover", backgroundPosition: "center" }}
      />
    );
  }

  // Fallback: 2-letter code badge.
  return (
    <span
      style={{
        ...base,
        width: `${size}px`,
        background: "#222C3D",
        color: "#97A4B6",
        fontSize: size * 0.46,
        fontWeight: 700,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {countryCode(country).slice(0, 2)}
    </span>
  );
}
