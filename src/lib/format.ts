// Shared money formatting helpers.
//
// fmtMoney  — raw pound amounts (1_000_000 = £1M). Used for betting bank,
//             stakes, payouts, and store prices.
// fmtPrice  — squad/player prices stored as tenths-of-millions in the DB
//             (Player.price, BUDGET, squad spent, etc.). 130 → £13M.
//
// Display rules:
//   ≥ £1 M  → £2.5M   (one decimal, trailing .0 trimmed)
//   ≥ £1 k  → £500k
//   < £1 k  → £500

export function fmtMoney(pounds: number): string {
  const abs = Math.abs(pounds);
  const sign = pounds < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}£${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}£${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `${sign}£${abs}`;
}

export function fmtPrice(tenths: number): string {
  return fmtMoney(tenths * 100_000);
}
