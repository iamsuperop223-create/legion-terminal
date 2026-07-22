import type { Trade, AttributeDefinition } from "@/types";
import { tradePnl } from "@/types";
import { computeAutoAttributes, AUTO_ATTRIBUTE_IDS } from "./tradeHelpers";

function attrValuesForTrade(trade: Trade, attributeId: string) {
  return trade.attributeValues?.find((v) => v.attributeDefinitionId === attributeId);
}

export function computeGroupedStat(trades: Trade[], attribute: AttributeDefinition) {
  const closed = trades.filter((t) => t.status === "closed");
  const buckets: Record<string, Trade[]> = {};

  closed.forEach((t) => {
    const av = attrValuesForTrade(t, attribute.id);
    const key = av && av.value !== "" && av.value != null ? String(av.value) : "(unset)";
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(t);
  });

  return Object.entries(buckets)
    .map(([key, ts]) => {
      const wins = ts.filter((t) => tradePnl(t) > 0);
      const pnl = ts.reduce((a, t) => a + tradePnl(t), 0);
      const grossWin = wins.reduce((a, t) => a + tradePnl(t), 0);
      const grossLoss = Math.abs(ts.filter((t) => tradePnl(t) < 0).reduce((a, t) => a + tradePnl(t), 0));
      return {
        key,
        count: ts.length,
        winRate: ts.length ? wins.length / ts.length : 0,
        avgPnl: ts.length ? pnl / ts.length : 0,
        totalPnl: pnl,
        profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? 999 : 0,
      };
    })
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

export interface GroupedStat {
  key: string;
  count: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
}

export function computeGroupedByAutoAttr(trades: Trade[], autoAttrId: string): GroupedStat[] {
  const closed = trades.filter((t) => t.status === "closed");
  const buckets: Record<string, Trade[]> = {};

  closed.forEach((t) => {
    const autoAttrs = computeAutoAttributes(t, trades);
    const found = autoAttrs.find((a) => a.id === autoAttrId);
    const key = found?.value || "(unset)";
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(t);
  });

  return Object.entries(buckets)
    .map(([key, ts]) => {
      const wins = ts.filter((t) => tradePnl(t) > 0);
      const pnl = ts.reduce((a, t) => a + tradePnl(t), 0);
      const grossWin = wins.reduce((a, t) => a + tradePnl(t), 0);
      const grossLoss = Math.abs(ts.filter((t) => tradePnl(t) < 0).reduce((a, t) => a + tradePnl(t), 0));
      return {
        key,
        count: ts.length,
        winRate: ts.length ? wins.length / ts.length : 0,
        avgPnl: ts.length ? pnl / ts.length : 0,
        totalPnl: pnl,
        profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? 999 : 0,
      };
    })
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

export const AUTO_ATTR_OPTIONS = [
  { id: "rMultiple", label: "R-Multiple" },
  { id: "session", label: "Session" },
  { id: "timeOfDay", label: "Time of Day" },
  { id: "dayOfWeek", label: "Day of Week" },
  { id: "streak", label: "Win/Loss Streak" },
];
