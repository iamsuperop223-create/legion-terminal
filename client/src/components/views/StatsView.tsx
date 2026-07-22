import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card, StatBox } from "@/components/ui/Card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { tradePnl, fmt$ } from "@/types";
import { computeGroupedStat, computeGroupedByAutoAttr, AUTO_ATTR_OPTIONS } from "@/lib/stats";

export default function StatsView() {
  const { trades, attributes } = useAppStore();
  const closed = [...trades.filter((t) => t.status === "closed")].sort(
    (a, b) => new Date(a.exitTime || a.entryTime).getTime() - new Date(b.exitTime || b.entryTime).getTime()
  );

  const wins = closed.filter((t) => tradePnl(t) > 0);
  const losses = closed.filter((t) => tradePnl(t) < 0);
  const totalPnl = closed.reduce((a, t) => a + tradePnl(t), 0);
  const grossWin = wins.reduce((a, t) => a + tradePnl(t), 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + tradePnl(t), 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : 0;
  const winRate = closed.length ? wins.length / closed.length : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = closed.length ? winRate * avgWin - (1 - winRate) * avgLoss : 0;
  const largestWin = wins.length ? Math.max(...wins.map(tradePnl)) : 0;
  const largestLoss = losses.length ? Math.min(...losses.map(tradePnl)) : 0;
  const avgRR = useMemo(() => {
    const withR = closed.filter((t) => t.stopTicks && t.stopTicks > 0);
    if (!withR.length) return 0;
    const sum = withR.reduce((a, t) => {
      const sym = { NQ: 20, MNQ: 2, ES: 50, MES: 5 }[t.symbol] || 1;
      const riskDollars = (t.stopTicks || 0) * sym * 0.25;
      return a + (riskDollars > 0 ? tradePnl(t) / riskDollars : 0);
    }, 0);
    return sum / withR.length;
  }, [closed]);

  let running = 0;
  const equity = closed.map((t, i) => {
    running += tradePnl(t);
    return { i: i + 1, equity: Math.round(running * 100) / 100 };
  });

  const bySymbol: Record<string, number> = {};
  closed.forEach((t) => { bySymbol[t.symbol] = (bySymbol[t.symbol] || 0) + tradePnl(t); });

  // Grouped stats
  const customGroupable = attributes.filter((a) => a.active);
  const allGroupOptions = [
    ...AUTO_ATTR_OPTIONS.map((a) => ({ id: `auto:${a.id}`, label: `⚡ ${a.label}`, isAuto: true })),
    ...customGroupable.map((a) => ({ id: `custom:${a.id}`, label: `✎ ${a.name}`, isAuto: false })),
  ];

  const [groupKey, setGroupKey] = useState("");
  const groupKeyResolved = groupKey || allGroupOptions[0]?.id || "";

  const rows = useMemo(() => {
    if (!groupKeyResolved) return [];
    if (groupKeyResolved.startsWith("auto:")) {
      return computeGroupedByAutoAttr(trades, groupKeyResolved.replace("auto:", ""));
    }
    if (groupKeyResolved.startsWith("custom:")) {
      const attr = customGroupable.find((a) => a.id === groupKeyResolved.replace("custom:", ""));
      if (attr) return computeGroupedStat(trades, attr);
    }
    return [];
  }, [groupKeyResolved, trades, customGroupable]);

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <StatBox label="P&L" value={fmt$(totalPnl)} tone={totalPnl >= 0 ? "green" : "red"} />
        <StatBox label="Win rate" value={`${Math.round(winRate * 100)}%`} />
        <StatBox label="Profit factor" value={profitFactor.toFixed(2)} />
        <StatBox label="Avg R" value={`${avgRR >= 0 ? "+" : ""}${avgRR.toFixed(2)}R`} tone={avgRR >= 0 ? "green" : "red"} />
        <StatBox label="Total trades" value={closed.length} />
        <StatBox label="Avg win" value={fmt$(avgWin)} tone="green" />
        <StatBox label="Avg loss" value={fmt$(-avgLoss)} tone="red" />
        <StatBox label="Largest win" value={fmt$(largestWin)} tone="green" />
        <StatBox label="Largest loss" value={fmt$(largestLoss)} tone="red" />
        <StatBox label="Expectancy" value={fmt$(expectancy)} tone={expectancy >= 0 ? "green" : "red"} />
      </div>

      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Equity curve</div>
        {equity.length === 0 ? (
          <div className="text-center py-10 text-textFaint text-sm">No closed trades yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={equity}>
              <CartesianGrid stroke="#232B38" strokeDasharray="3 3" />
              <XAxis dataKey="i" stroke="#5B6478" fontSize={11} />
              <YAxis stroke="#5B6478" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#1A2029", border: "1px solid #232B38", borderRadius: 8 }}
                labelStyle={{ color: "#8891A3" }}
              />
              <Line type="monotone" dataKey="equity" stroke="#D4A24E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">P&L by symbol</div>
        {Object.keys(bySymbol).length === 0 ? (
          <div className="text-center py-10 text-textFaint text-sm">No data.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {Object.entries(bySymbol).map(([s, v]) => (
              <div key={s} className="flex justify-between items-center px-3 py-2 bg-surface2 rounded-lg text-sm">
                <span>{s}</span>
                <span className={`font-mono font-bold ${v >= 0 ? "text-accent-green" : "text-accent-red"}`}>{fmt$(v)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Grouped by attribute */}
      {allGroupOptions.length > 0 && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-textFaint uppercase tracking-wider">Performance grouped by</div>
            <select
              value={groupKeyResolved}
              onChange={(e) => setGroupKey(e.target.value)}
              className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-text text-xs font-mono"
            >
              {allGroupOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          {rows.length === 0 ? (
            <div className="text-center py-10 text-textFaint text-sm">No closed trades with data for this dimension.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* Header */}
              <div className="flex items-center px-3 py-1 text-[10px] text-textFaint uppercase tracking-wider">
                <span className="flex-1">Value</span>
                <span className="w-16 text-right">Trades</span>
                <span className="w-20 text-right">Win Rate</span>
                <span className="w-20 text-right">Avg PnL</span>
                <span className="w-16 text-right">PF</span>
                <span className="w-24 text-right">Total PnL</span>
              </div>
              {rows.map((r) => (
                <div key={r.key} className="flex items-center px-3 py-2 bg-surface2 rounded-lg text-sm">
                  <span className="flex-1 font-semibold">{r.key}</span>
                  <span className="w-16 text-right font-mono text-textDim">{r.count}</span>
                  <span className={`w-20 text-right font-mono ${r.winRate >= 0.5 ? "text-accent-green" : "text-accent-red"}`}>
                    {Math.round(r.winRate * 100)}%
                  </span>
                  <span className={`w-20 text-right font-mono ${r.avgPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                    {fmt$(r.avgPnl)}
                  </span>
                  <span className="w-16 text-right font-mono text-textDim">
                    {r.profitFactor >= 999 ? "∞" : r.profitFactor.toFixed(1)}
                  </span>
                  <span className={`w-24 text-right font-mono font-bold ${r.totalPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                    {fmt$(r.totalPnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
