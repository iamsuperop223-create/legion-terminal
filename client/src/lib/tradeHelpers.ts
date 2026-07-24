const SYMBOLS: Record<string, { multiplier: number }> = {
  NQ: { multiplier: 20 },
  MNQ: { multiplier: 2 },
  ES: { multiplier: 50 },
  MES: { multiplier: 5 },
};

function weightedEntryPrice(entryLegs: { price: number; qty: number }[]): number {
  let totalCost = 0;
  let totalQty = 0;
  for (const leg of entryLegs) {
    totalCost += leg.price * leg.qty;
    totalQty += leg.qty;
  }
  return totalQty > 0 ? totalCost / totalQty : 0;
}

export function tradePnl(t: any): number {
  if (t.status !== "closed") return 0;
  const sym = SYMBOLS[t.symbol] || { multiplier: 1 };
  const dir = t.direction === "long" ? 1 : -1;
  const entryPrice = (t.entryLegs && t.entryLegs.length > 0) ? weightedEntryPrice(t.entryLegs) : t.entryPrice;
  const legs = t.exitLegs;
  if (legs && legs.length > 0 && entryPrice != null) {
    let total = 0;
    for (const leg of legs) {
      total += (leg.price - entryPrice) * dir * leg.qty * sym.multiplier;
    }
    return total - (t.fee || 0);
  }
  if (t.pnlPoints != null) return t.pnlPoints - (t.fee || 0);
  if (t.exitPrice == null || entryPrice == null) return 0;
  return (t.exitPrice - entryPrice) * dir * t.qty * sym.multiplier - (t.fee || 0);
}

export function fmt$(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dayKey(d: string): string {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
      const limit = params.amount || 500;
      const sortedDay = closedTrades
        .filter((t: any) => dayKey(t.exitTime || t.entryTime) === dk)
        .sort((a: any, b: any) => new Date(a.exitTime || a.entryTime).getTime() - new Date(b.exitTime || b.entryTime).getTime());
      let cumPnl = 0;
      let hitTradeIdx = -1;
      for (let i = 0; i < sortedDay.length; i++) {
        cumPnl += tradePnl(sortedDay[i]);
        if (cumPnl >= limit && hitTradeIdx === -1) hitTradeIdx = i;
      }
      const thisIdx = sortedDay.findIndex((t: any) => t.id === trade.id);
      if (thisIdx < hitTradeIdx) {
        results.push({ rule: r, pass: true, detail: `Day PnL: ${fmt$(cumPnl)} (target: $${limit})` });
      } else if (thisIdx === hitTradeIdx) {
        results.push({ rule: r, pass: true, detail: `Hit $${limit} target — stop trading` });
      } else {
        results.push({ rule: r, pass: false, detail: `Target $${limit} already hit — trade ${thisIdx - hitTradeIdx + 1} past target` });
      }

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

export function computeDailyCompliance(trades: any[], rules: any[]): Record<string, { pnl: number; tradeCount: number; ruleResults: { rule: any; pass: boolean; detail: string }[]; trades: any[] }> {
  const closed = trades.filter((t: any) => t.status === "closed");
  const byDay: Record<string, any[]> = {};
  closed.forEach((t: any) => {
    const dk = dayKey(t.exitTime || t.entryTime);
    if (!byDay[dk]) byDay[dk] = [];
    byDay[dk].push(t);
  });

  const result: Record<string, { pnl: number; tradeCount: number; ruleResults: { rule: any; pass: boolean; detail: string }[]; trades: any[] }> = {};

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
        const sorted = [...dayTrades].sort((a: any, b: any) => new Date(a.exitTime || a.entryTime).getTime() - new Date(b.exitTime || b.entryTime).getTime());
        let cum = 0;
        let hitIdx = -1;
        for (let i = 0; i < sorted.length; i++) {
          cum += tradePnl(sorted[i]);
          if (cum >= limit && hitIdx === -1) hitIdx = i;
        }
        const overTrades = hitIdx >= 0 ? sorted.length - hitIdx - 1 : 0;
        if (hitIdx >= 0 && overTrades > 0) {
          ruleResults.push({ rule: r, pass: false, detail: `Hit $${limit} target, then took ${overTrades} more trade${overTrades > 1 ? "s" : ""}` });
        } else if (hitIdx >= 0) {
          ruleResults.push({ rule: r, pass: true, detail: `Hit $${limit} target — stopped` });
        } else {
          ruleResults.push({ rule: r, pass: true, detail: `${fmt$(pnl)} (target: $${limit})` });
        }
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

    result[dk] = { pnl, tradeCount: dayTrades.length, ruleResults, trades: dayTrades };
  });

  return result;
}

// ─── Auto-Calculated Attributes ────────────────────────────────────

export interface AutoAttribute {
  id: string;
  label: string;
  value: string;
  category: "auto";
}

export function computeAutoAttributes(trade: any, allTrades: any[]): AutoAttribute[] {
  const attrs: AutoAttribute[] = [];
  if (!trade) return attrs;

  const closedTrades = allTrades.filter((t: any) => t.status === "closed")
    .sort((a: any, b: any) => new Date(a.exitTime || a.entryTime).getTime() - new Date(b.exitTime || b.entryTime).getTime());

  // Parse hours/minutes directly from the entry time string (avoids timezone conversion)
  const parseTime = (iso: string | null | undefined): { h: number; m: number } | null => {
    if (!iso) return null;
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (!match) return null;
    return { h: parseInt(match[1]), m: parseInt(match[2]) };
  };

  const entryParsed = parseTime(trade.entryTime);

  // R-Multiple
  if (trade.status === "closed" && trade.entryPrice != null) {
    const sym = SYMBOLS[trade.symbol] || { multiplier: 1 };
    const stopTicks = Number(trade.stopTicks);
    if (stopTicks > 0) {
      const riskDollars = stopTicks * sym.multiplier * 0.25;
      const pnl = tradePnl(trade);
      const rMult = pnl / riskDollars;
      attrs.push({ id: "rMultiple", label: "R-Multiple", value: `${rMult >= 0 ? "+" : ""}${rMult.toFixed(2)}R`, category: "auto" });
    }
  }

  // Session (CST: ETH 5:00PM-8:30AM, RTH 8:30AM-3:15PM)
  if (entryParsed) {
    const { h, m } = entryParsed;
    const timeVal = h * 60 + m;
    let session = "ETH";
    if (timeVal >= 510 && timeVal <= 915) session = "RTH";
    else if (timeVal > 915) session = "After Hours";
    attrs.push({ id: "session", label: "Session", value: session, category: "auto" });
  }

  // Time of Day (CST)
  if (entryParsed) {
    const { h } = entryParsed;
    let tod = "Pre-Market";
    if (h >= 8 && h < 10) tod = "Morning";
    else if (h >= 10 && h < 12) tod = "Mid-Morning";
    else if (h >= 12 && h < 14) tod = "Midday";
    else if (h >= 14 && h < 16) tod = "Afternoon";
    else if (h >= 16) tod = "Late Session";
    attrs.push({ id: "timeOfDay", label: "Time of Day", value: tod, category: "auto" });
  }

  // Day of Week
  if (entryParsed) {
    const entryDate = trade.entryTime ? new Date(trade.entryTime) : null;
    if (entryDate) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      attrs.push({ id: "dayOfWeek", label: "Day of Week", value: days[entryDate.getDay()], category: "auto" });
    }
  }

  // Consecutive Wins/Losses (streak at time of this trade)
  if (trade.status === "closed") {
    const tradeTime = new Date(trade.exitTime || trade.entryTime).getTime();
    const prior = closedTrades.filter((t: any) => new Date(t.exitTime || t.entryTime).getTime() < tradeTime);
    let streak = 0;
    let streakType = "";
    for (let i = prior.length - 1; i >= 0; i--) {
      const pnl = tradePnl(prior[i]);
      if (i === prior.length - 1) {
        streakType = pnl >= 0 ? "win" : "loss";
      }
      if ((streakType === "win" && pnl >= 0) || (streakType === "loss" && pnl < 0)) {
        streak++;
      } else {
        break;
      }
    }
    if (streak > 0) {
      attrs.push({ id: "streak", label: "Streak", value: `${streak} ${streakType}${streak > 1 ? "s" : ""}`, category: "auto" });
    }
  }

  return attrs;
}

export const AUTO_ATTRIBUTE_IDS = ["rMultiple", "session", "timeOfDay", "dayOfWeek", "streak"];
