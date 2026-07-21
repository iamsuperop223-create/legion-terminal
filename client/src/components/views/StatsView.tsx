import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card, StatBox } from "@/components/ui/Card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { tradePnl, fmt$ } from "@/types";
import { computeGroupedStat } from "@/lib/stats";

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

  let running = 0;
  const equity = closed.map((t, i) => {
    running += tradePnl(t);
    return { i: i + 1, equity: Math.round(running * 100) / 100 };
  });

  const bySymbol: Record<string, number> = {};
  closed.forEach((t) => { bySymbol[t.symbol] = (bySymbol[t.symbol] || 0) + tradePnl(t); });

  // Grouped stats
  const groupable = attributes.filter((a) => a.active);
  const [attrId, setAttrId] = useState(groupable[0]?.id || "");
  const attribute = groupable.find((a) => a.id === attrId);
  const rows = attribute ? computeGroupedStat(trades, attribute) : [];

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <StatBox label="P&L" value={fmt$(totalPnl)} tone={totalPnl >= 0 ? "green" : "red"} />
        <StatBox label="Win rate" value={`${Math.round(winRate * 100)}%`} />
        <StatBox label="Profit factor" value={profitFactor.toFixed(2)} />
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
      {groupable.length > 0 && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-textFaint uppercase tracking-wider">Performance grouped by</div>
            <select
              value={attrId}
              onChange={(e) => setAttrId(e.target.value)}
              className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-text text-xs font-mono"
            >
              {groupable.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          {rows.length === 0 ? (
            <div className="text-center py-10 text-textFaint text-sm">No closed trades with this attribute yet.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {rows.map((r) => (
                <div key={r.key} className="flex justify-between items-center px-3 py-2 bg-surface2 rounded-lg text-sm">
                  <span>{r.key} <span className="text-textFaint text-[11px]">({r.count})</span></span>
                  <span className="flex gap-4 font-mono">
                    <span className="text-textDim">{Math.round(r.winRate * 100)}% win</span>
                    <span className={`font-bold ${r.totalPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>{fmt$(r.totalPnl)}</span>
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
