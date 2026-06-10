// Budget bar ported from design/components.jsx.
// spent & remaining are in TENTHS of a million (matches Player.price / BUDGET).
import { BUDGET } from "@/lib/squad-rules";
import { fmtPrice } from "@/lib/format";

export function BudgetBar({
  spent,
  count,
  bonusBudget = 0,
  note,
}: {
  spent: number;
  count: number;
  bonusBudget?: number; // tenths above the base £100M (one-pool cap in knockouts)
  note?: string; // short money message shown under the bar
}) {
  const effectiveBudget = BUDGET + bonusBudget;
  const remaining = effectiveBudget - spent;
  const pct = Math.min(100, (spent / effectiveBudget) * 100);
  const over = remaining < 0;
  return (
    <div>
      <div className={"budgetbar" + (over ? " over" : "")}>
        <div className="bb-stat">
          <div className="bb-label">Squad</div>
          <div className="bb-val num">{count}/15</div>
        </div>
        <div className="bb-track-wrap">
          <div className="bb-track">
            <div className="bb-fill" style={{ width: pct + "%" }} />
          </div>
          <div className="bb-track-labels">
            <span className="muted">{fmtPrice(spent)} spent</span>
            <span className="muted">{fmtPrice(effectiveBudget)} budget</span>
          </div>
        </div>
        <div className="bb-stat right">
          <div className="bb-label">{over ? "Over by" : "Remaining"}</div>
          <div className={"bb-val num " + (over ? "neg" : "pos")}>
            {fmtPrice(Math.abs(remaining))}
          </div>
        </div>
      </div>
      {note && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--text-2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingLeft: 4,
          }}
        >
          <span style={{ color: "var(--accent)" }}>●</span>
          {note}
        </div>
      )}
    </div>
  );
}
