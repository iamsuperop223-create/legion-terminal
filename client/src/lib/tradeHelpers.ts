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

function dayKey(d: string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function sessionKey(d: string): string {
  const dt = new Date(d);
  const dk = dayKey(d);
  const hour = dt.getHours();
  const minute = dt.getMinutes();
  const timeVal = hour * 60 + minute;
  const session = timeVal < 9 * 60 ? "ovn" : "rth";
  return `${dk}_${session}`;
}

export function evaluateTradeRules(trade: any, rules: any[], allTrades?: any[]): { rule: any; pass: boolean; detail: string }[] {
  const results: { rule: any; pass: boolean; detail: string }[] = [];
  const closedTrades = allTrades?.filter((t: any) => t.status === "closed") || [];

  rules.filter((r: any) => r.active).forEach((r: any) => {
    const params = r.params || {};

    if (r.type === "maxContracts") {
      const max = params.maxQty || 6;
      results.push({ rule: r, pass: Number(trade.qty) <= max, detail: `${trade.qty} / max ${max}` });

    } else if (r.type === "stopRange") {
      if (trade.stopTicks == null) return;
      const t = Number(trade.stopTicks);
      const min = params.minTicks || 45;
      const max = params.maxTicks || 50;
      results.push({ rule: r, pass: t >= min && t <= max, detail: `${t} ticks (want ${min}-${max})` });

    } else if (r.type === "dailyLossLimit") {
      if (trade.status !== "closed") return;
      const dk = dayKey(trade.exitTime || trade.entryTime);
      const dayPnl = closedTrades
        .filter((t: any) => dayKey(t.exitTime || t.entryTime) === dk)
        .reduce((a: number, t: any) => a + tradePnl(t), 0);
      const limit = params.amount || 300;
      results.push({ rule: r, pass: dayPnl >= -limit, detail: `Day PnL: ${fmt$(dayPnl)} (limit: -$${limit})` });

    } else if (r.type === "breakeven") {
      if (trade.status !== "closed") return;
      results.push({ rule: r, pass: !!trade.movedToBreakeven, detail: trade.movedToBreakeven ? "moved to BE" : "NOT moved to BE" });

    } else if (r.type === "maxTradesPerDay") {
      if (trade.status !== "closed") return;
      const dk = dayKey(trade.exitTime || trade.entryTime);
      const dayTradeCount = closedTrades.filter((t: any) => dayKey(t.exitTime || t.entryTime) === dk).length;
      const max = params.maxTrades || 3;
      results.push({ rule: r, pass: dayTradeCount <= max, detail: `${dayTradeCount} trades today (max ${max})` });

    } else if (r.type === "maxTradesPerSession") {
      if (trade.status !== "closed") return;
      const sk = sessionKey(trade.exitTime || trade.entryTime);
      const sessionCount = closedTrades.filter((t: any) => sessionKey(t.exitTime || t.entryTime) === sk).length;
      const max = params.maxTrades || 2;
      results.push({ rule: r, pass: sessionCount <= max, detail: `${sessionCount} trades this session (max ${max})` });

    } else if (r.type === "breakevenAtR") {
      if (trade.status !== "closed") return;
      if (!trade.movedToBreakeven) {
        results.push({ rule: r, pass: false, detail: "NOT moved to BE" });
        return;
      }
      const sym = SYMBOLS[trade.symbol] || { multiplier: 1 };
      const dir = trade.direction === "long" ? 1 : -1;
      if (trade.stopTicks == null || trade.entryPrice == null) {
        results.push({ rule: r, pass: true, detail: "moved to BE (no tick data to verify R)" });
        return;
      }
      const riskDollars = trade.stopTicks * sym.multiplier * 0.25;
      const pnlVal = tradePnl(trade);
      const rMultiple = pnlVal / riskDollars;
      const minR = params.minR || 1.5;
      results.push({ rule: r, pass: rMultiple >= minR, detail: `${rMultiple.toFixed(2)}R achieved (need ${minR}R)` });

    } else if (r.type === "scaleOut") {
      const legs = trade.exitLegs;
      if (!legs || legs.length < 2) {
        results.push({ rule: r, pass: false, detail: "no multi-leg exit" });
        return;
      }
      const totalQtyAll = trade.qty;
      const firstLegQty = legs[0].qty;
      const scalePercent = (firstLegQty / totalQtyAll) * 100;
      const minPct = params.minPercent || 30;
      const maxPct = params.maxPercent || 50;
      results.push({ rule: r, pass: scalePercent >= minPct && scalePercent <= maxPct, detail: `scaled ${Math.round(scalePercent)}% first (want ${minPct}-${maxPct}%)` });

    } else if (r.type === "maxDailyProfit") {
      if (trade.status !== "closed") return;
      const dk = dayKey(trade.exitTime || trade.entryTime);
      const dayPnl = closedTrades
        .filter((t: any) => dayKey(t.exitTime || t.entryTime) === dk)
        .reduce((a: number, t: any) => a + tradePnl(t), 0);
      const limit = params.amount || 500;
      results.push({ rule: r, pass: dayPnl <= limit, detail: `Day PnL: ${fmt$(dayPnl)} (cap: $${limit})` });

    } else if (r.type === "losingDayBreak") {
      if (trade.status !== "closed") return;
      const consecDays = params.consecutiveDays || 3;
      const breakDays = params.breakDays || 1;
      const tradeDate = new Date(trade.exitTime || trade.entryTime);
      const byDay: Record<string, number> = {};
      closedTrades.forEach((t: any) => {
        const dk = dayKey(t.exitTime || t.entryTime);
        byDay[dk] = (byDay[dk] || 0) + tradePnl(t);
      });
      const sortedDays = Object.keys(byDay).sort();
      let losingStreak = 0;
      for (const d of sortedDays) {
        if (byDay[d] < 0) losingStreak++;
        else losingStreak = 0;
      }
      const currentDk = dayKey(trade.exitTime || trade.entryTime);
      const prevDays = sortedDays.filter((d) => d < currentDk);
      let recentLosingStreak = 0;
      for (let i = prevDays.length - 1; i >= 0; i--) {
        if (byDay[prevDays[i]] < 0) recentLosingStreak++;
        else break;
      }
      const shouldBreak = recentLosingStreak >= consecDays;
      results.push({ rule: r, pass: !shouldBreak, detail: shouldBreak ? `${recentLosingStreak} consecutive losing days — should take ${breakDays} day break` : "ok" });

    } else if (r.type === "custom") {
      results.push({ rule: r, pass: !!trade.customChecks?.[r.id], detail: trade.customChecks?.[r.id] ? "followed" : "not marked" });
    }
  });
  return results;
}

export function computeDailyCompliance(trades: any[], rules: any[]): Record<string, { pnl: number; tradeCount: number; ruleResults: { rule: any; pass: boolean; detail: string }[] }> {
  const closed = trades.filter((t: any) => t.status === "closed");
  const byDay: Record<string, any[]> = {};
  closed.forEach((t: any) => {
    const dk = dayKey(t.exitTime || t.entryTime);
    if (!byDay[dk]) byDay[dk] = [];
    byDay[dk].push(t);
  });

  const result: Record<string, { pnl: number; tradeCount: number; ruleResults: { rule: any; pass: boolean; detail: string }[] }> = {};

  Object.entries(byDay).forEach(([dk, dayTrades]) => {
    const pnl = dayTrades.reduce((a: number, t: any) => a + tradePnl(t), 0);
    const ruleResults: { rule: any; pass: boolean; detail: string }[] = [];

    rules.filter((r: any) => r.active).forEach((r: any) => {
      const params = r.params || {};

      if (r.type === "dailyLossLimit") {
        const limit = params.amount || 300;
        ruleResults.push({ rule: r, pass: pnl >= -limit, detail: pnl >= -limit ? `Within -$${limit}` : `Breached -$${limit} (${fmt$(pnl)})` });
      }

      if (r.type === "maxTradesPerDay") {
        const max = params.maxTrades || 3;
        ruleResults.push({ rule: r, pass: dayTrades.length <= max, detail: dayTrades.length <= max ? `${dayTrades.length}/${max} trades` : `${dayTrades.length}/${max} trades — OVER LIMIT` });
      }

      if (r.type === "maxDailyProfit") {
        const limit = params.amount || 500;
        ruleResults.push({ rule: r, pass: pnl <= limit, detail: pnl <= limit ? `Under $${limit} cap` : `Exceeded $${limit} cap (${fmt$(pnl)})` });
      }

      if (r.type === "losingDayBreak" && dayTrades.length > 0) {
        const consecDays = params.consecutiveDays || 3;
        const byDayInner: Record<string, number> = {};
        closed.forEach((t: any) => {
          const k = dayKey(t.exitTime || t.entryTime);
          byDayInner[k] = (byDayInner[k] || 0) + tradePnl(t);
        });
        const sortedDays = Object.keys(byDayInner).sort();
        let streak = 0;
        for (const d of sortedDays) {
          if (d >= dk) break;
          if (byDayInner[d] < 0) streak++;
          else streak = 0;
        }
        const shouldBreak = streak >= consecDays;
        ruleResults.push({ rule: r, pass: !shouldBreak, detail: shouldBreak ? `Should be on break (${streak} losing days prior)` : `${streak} losing days prior — ok` });
      }
    });

    result[dk] = { pnl, tradeCount: dayTrades.length, ruleResults };
  });

  return result;
}
