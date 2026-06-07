// Country jersey ported from design/components.jsx. <Jersey country="Argentina" size={46} />
// KIT keyed by full country name (matches the real Player.country from the API).
const KIT: Record<string, [string, string]> = {
  Brazil: ["#FFD000", "#1B9E4B"],
  France: ["#1B3A8C", "#E11D2E"],
  England: ["#FFFFFF", "#E11D2E"],
  Spain: ["#C60B1E", "#FFC400"],
  Argentina: ["#74ACDF", "#FFFFFF"],
  Germany: ["#FFFFFF", "#16161A"],
  Portugal: ["#C8102E", "#0E6B3C"],
  Netherlands: ["#F36C21", "#16161A"],
  Belgium: ["#E2353C", "#FFD500"],
  Croatia: ["#E2353C", "#FFFFFF"],
  USA: ["#1B3A8C", "#FFFFFF"],
  "United States": ["#1B3A8C", "#FFFFFF"],
  Mexico: ["#0E7A3C", "#FFFFFF"],
  Canada: ["#D1182B", "#FFFFFF"],
  Japan: ["#1B2E8C", "#FFFFFF"],
  Morocco: ["#C60B1E", "#0E6B3C"],
  Senegal: ["#0E8A3C", "#FFD500"],
  Uruguay: ["#5BA8E0", "#16161A"],
  Italy: ["#1E68C8", "#FFFFFF"],
  Australia: ["#FFCE00", "#0E7A3C"],
};

export function Jersey({ country, size = 42 }: { country: string; size?: number }) {
  const [body, acc] = KIT[country] ?? ["#2A3649", "#5E6B7E"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,.45))" }}
    >
      <path
        d="M17 7 L24 11 L31 7 L42 14 L37 22 L33 19 V41 H15 V19 L11 22 L6 14 Z"
        fill={body}
        stroke="rgba(0,0,0,.25)"
        strokeWidth={0.8}
      />
      <path d="M17 7 L24 11 L31 7 L34 9 L24 14 L14 9 Z" fill={acc} />
      <path d="M11 22 L6 14 L11 11 L15 19 Z" fill={acc} opacity={0.92} />
      <path d="M37 22 L42 14 L37 11 L33 19 Z" fill={acc} opacity={0.92} />
    </svg>
  );
}
