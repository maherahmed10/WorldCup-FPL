// Team crest / flag. Uses the real API-Football logo (Team.logoUrl); falls back
// to a tinted initials chip when the crest is missing. Plain <img> keeps us out
// of next.config remote-image setup (a shared file).

export function Flag({
  logoUrl,
  name,
  size = 22,
  round = true,
}: {
  logoUrl: string | null;
  name: string;
  size?: number;
  round?: boolean;
}) {
  const radius = round ? "9999px" : "3px";
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: radius, objectFit: "cover", flex: "0 0 auto" }}
      />
    );
  }
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <span
      aria-label={name}
      className="grid place-items-center font-[family-name:var(--font-display)] font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: size * 0.4,
        background: "var(--surface-3)",
        color: "var(--text-2)",
        flex: "0 0 auto",
      }}
    >
      {initials}
    </span>
  );
}
