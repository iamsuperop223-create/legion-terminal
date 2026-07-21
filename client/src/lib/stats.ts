import type { Trade, AttributeDefinition } from "@/types";
import { tradePnl } from "@/types";

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
      return {
        key,
        count: ts.length,
        winRate: ts.length ? wins.length / ts.length : 0,
        avgPnl: ts.length ? pnl / ts.length : 0,
        totalPnl: pnl,
      };
    })
    .sort((a, b) => b.totalPnl - a.totalPnl);
}
