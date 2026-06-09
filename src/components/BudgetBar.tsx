// Budget bar ported from design/components.jsx.
// spent & remaining are in TENTHS of a million (matches Player.price / BUDGET).
import { BUDGET } from "@/lib/squad-rules";

export function BudgetBar({
  spent,
  count,
  bonusBudget = 0,
}: {
  spent: number;
  count: number;
  bonusBudget?: number;
}) {
  const effectiveBudget = BUDGET + bonusBudget;
  const remaining = effectiveBudget - spent;
  const pct = Math.min(100, (spent / effectiveBudget) * 100);
  const over = remaining < 0;
  return (
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
          <span className="muted">£{(spent / 10).toFixed(1)}m spent</span>
          <span className="muted">
            £{(effectiveBudget / 10).toFixed(1)}m budget
            {bonusBudget > 0 && (
              <span style={{ color: "var(--accent)" }}> (+£{(bonusBudget / 10).toFixed(1)}m bonus)</span>
            )}
          </span>
        </div>
      </div>
      <div className="bb-stat right">
        <div className="bb-label">{over ? "Over by" : "Remaining"}</div>
        <div className={"bb-val num " + (over ? "neg" : "pos")}>
          £{(Math.abs(remaining) / 10).toFixed(1)}m
        </div>
      </div>
    </div>
  );
}
