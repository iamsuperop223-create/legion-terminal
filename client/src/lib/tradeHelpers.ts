const SYMBOLS: Record<string, { multiplier: number }> = {
  NQ: { multiplier: 20 },
  MNQ: { multiplier: 2 },
  ES: { multiplier: 50 },
  MES: { multiplier: 5 },
};

export function tradePnl(t: any): number {
  if (t.status !== "closed") return 0;
  const sym = SYMBOLS[t.symbol] || { multiplier: 1 };
  const legs = t.exitLegs;
  if (legs && legs.length > 0 && t.entryPrice != null) {
    const dir = t.direction === "long" ? 1 : -1;
    let total = 0;
    for (const leg of legs) {
      total += (leg.price - t.entryPrice) * dir * leg.qty * sym.multiplier;
    }
    return total - (t.fee || 0);
  }
  if (t.pnlPoints != null) return t.pnlPoints - (t.fee || 0);
  if (t.exitPrice == null) return 0;
  const dir = t.direction === "long" ? 1 : -1;
  return (t.exitPrice - (t.entryPrice || 0)) * dir * t.qty * sym.multiplier - (t.fee || 0);
}

export function fmt$(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function evaluateTradeRules(trade: any, rules: any[]): { rule: any; pass: boolean; detail: string }[] {
  const results: { rule: any; pass: boolean; detail: string }[] = [];
  rules.filter((r: any) => r.active).forEach((r: any) => {
    if (r.type === "maxContracts") {
      results.push({ rule: r, pass: Number(trade.qty) <= (r.params?.maxQty || r.maxQty || 6), detail: `${trade.qty} / max ${r.params?.maxQty || r.maxQty || 6}` });
    } else if (r.type === "stopRange") {
      if (trade.stopTicks === "" || trade.stopTicks == null) return;
      const t = Number(trade.stopTicks);
      const min = r.params?.minTicks || r.minTicks || 45;
      const max = r.params?.maxTicks || r.maxTicks || 50;
      results.push({ rule: r, pass: t >= min && t <= max, detail: `${t} ticks (want ${min}-${max})` });
    } else if (r.type === "breakeven") {
      if (trade.status !== "closed") return;
      results.push({ rule: r, pass: !!trade.movedToBreakeven, detail: trade.movedToBreakeven ? "moved" : "not moved" });
    } else if (r.type === "custom") {
      results.push({ rule: r, pass: !!trade.customChecks?.[r.id], detail: trade.customChecks?.[r.id] ? "followed" : "not marked" });
    }
  });
  return results;
}
