// Stat card ported from design/components.jsx.
import { Icon } from "@/components/Icon";

export function StatCard({
  label,
  value,
  sub,
  tone = "",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "" | "accent" | "gold" | "live" | "blue";
  icon?: string;
}) {
  return (
    <div className="statcard">
      <div className="sc-top">
        <span className="sc-label">{label}</span>
        {icon && (
          <span className={"sc-icon " + (tone ? "tone-" + tone : "")}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className={"sc-value num " + (tone ? "tone-" + tone : "")}>{value}</div>
      {sub && <div className="sc-sub">{sub}</div>}
    </div>
  );
}
