import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card, StatBox } from "@/components/ui/Card";
import { tradePnl, fmt$ } from "@/lib/tradeHelpers";
import { ChevronDown, ChevronUp, Trophy, AlertTriangle } from "lucide-react";

type Period = "daily" | "weekly" | "monthly";

function dayKey(d: string): string {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekKey(d: string): string {
  const dt = new Date(d);
  const jan1 = new Date(dt.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((dt.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${dt.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function monthKey(d: string): string {
  return d.slice(0, 7);
}

function fmtDateShort(dk: string): string {
  const [y, m, d] = dk.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtWeekLabel(wk: string): string {
  const [y, w] = wk.split("-W");
  return `Week ${parseInt(w)}, ${y}`;
}

function fmtMonthLabel(mk: string): string {
  const [y, m] = mk.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

interface RollupData {
  label: string;
  key: string;
  trades: any[];
  pnl: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  bestTrade: any | null;
  worstTrade: any | null;
  ruleViolations: string[];
  streak: { type: string; count: number };
}

function computeRollups(trades: any[], rules: any[], period: Period): RollupData[] {
  const closed = trades.filter((t) => t.status === "closed");
  const grouped: Record<string, any[]> = {};

  closed.forEach((t) => {
    const dk = dayKey(t.exitTime || t.entryTime);
    let key: string;
    if (period === "daily") key = dk;
    else if (period === "weekly") key = weekKey(dk);
    else key = monthKey(dk);

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, ts]) => {
      const wins = ts.filter((t) => tradePnl(t) > 0);
      const losses = ts.filter((t) => tradePnl(t) < 0);
      const pnl = ts.reduce((a, t) => a + tradePnl(t), 0);
      const grossWin = wins.reduce((a, t) => a + tradePnl(t), 0);
      const grossLoss = Math.abs(losses.reduce((a, t) => a + tradePnl(t), 0));

      const sorted = [...ts].sort((a, b) => new Date(a.exitTime || a.entryTime).getTime() - new Date(b.exitTime || b.entryTime).getTime());
      let streak = 0;
      let streakType = "";
      for (let i = sorted.length - 1; i >= 0; i--) {
        const pnlVal = tradePnl(sorted[i]);
        const type = pnlVal >= 0 ? "win" : "loss";
        if (i === sorted.length - 1) streakType = type;
        if (type === streakType) streak++;
        else break;
      }

      const violations: string[] = [];

      ts.forEach((t) => {
        if (t.customChecks) {
          Object.entries(t.customChecks).forEach(([ruleId, followed]) => {
            if (!followed) {
              const rule = rules.find((r) => r.id === ruleId);
              if (rule) {
                if (!violations.includes(rule.name)) violations.push(rule.name);
              }
            }
          });
        }
      });

      let label: string;
      if (period === "daily") label = fmtDateShort(key);
      else if (period === "weekly") label = fmtWeekLabel(key);
      else label = fmtMonthLabel(key);

      return {
        label,
        key,
        trades: ts,
        pnl,
        winCount: wins.length,
        lossCount: losses.length,
        winRate: ts.length ? wins.length / ts.length : 0,
        avgWin: wins.length ? grossWin / wins.length : 0,
        avgLoss: losses.length ? grossLoss / losses.length : 0,
        profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? 999 : 0,
        bestTrade: wins.length ? wins.reduce((best, t) => tradePnl(t) > tradePnl(best) ? t : best) : null,
        worstTrade: losses.length ? losses.reduce((worst, t) => tradePnl(t) < tradePnl(worst) ? t : worst) : null,
        ruleViolations: violations,
        streak: { type: streakType, count: streak },
      };
    });
}

export default function RollupsView() {
  const { trades, rules } = useAppStore();
  const [period, setPeriod] = useState<Period>("daily");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  const rollups = useMemo(() => computeRollups(trades, rules, period), [trades, rules, period]);

  const totalPnl = rollups.reduce((a, r) => a + r.pnl, 0);
  const totalTrades = rollups.reduce((a, r) => a + r.trades.length, 0);
  const totalWins = rollups.reduce((a, r) => a + r.winCount, 0);
  const avgDaily = rollups.length ? totalPnl / rollups.length : 0;
  const greenDays = rollups.filter((r) => r.pnl > 0).length;
  const redDays = rollups.filter((r) => r.pnl < 0).length;
  const bestPeriod = rollups.length ? rollups.reduce((best, r) => r.pnl > best.pnl ? r : best) : null;
  const worstPeriod = rollups.length ? rollups.reduce((worst, r) => r.pnl < worst.pnl ? r : worst) : null;

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-textFaint uppercase tracking-wider">Rollup Reports</div>
        <div className="flex gap-1.5">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold transition ${
                period === p ? "bg-gold text-[#1A1206]" : "bg-surface2 text-textDim hover:text-text"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <StatBox label={`Total PnL (${period})`} value={fmt$(totalPnl)} tone={totalPnl >= 0 ? "green" : "red"} />
        <StatBox label="Total trades" value={totalTrades} />
        <StatBox label="Win rate" value={totalTrades ? `${Math.round((totalWins / totalTrades) * 100)}%` : "—"} />
        <StatBox label={`Avg ${period}`} value={fmt$(avgDaily)} tone={avgDaily >= 0 ? "green" : "red"} />
        <StatBox label="Green" value={greenDays} tone="green" />
        <StatBox label="Red" value={redDays} tone="red" />
      </div>

      {bestPeriod && (
        <div className="flex gap-3">
          <Card className="p-3 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={12} className="text-[#D4A24E]" />
              <div className="text-[10px] text-textFaint uppercase tracking-wider">Best {period}</div>
            </div>
            <div className="text-sm font-semibold">{bestPeriod.label}</div>
            <div className={`font-mono font-bold ${bestPeriod.pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>{fmt$(bestPeriod.pnl)}</div>
            <div className="text-[11px] text-textFaint mt-0.5">{bestPeriod.winCount}W / {bestPeriod.lossCount}L</div>
          </Card>
          {worstPeriod && (
            <Card className="p-3 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={12} className="text-[#F1685E]" />
                <div className="text-[10px] text-textFaint uppercase tracking-wider">Worst {period}</div>
              </div>
              <div className="text-sm font-semibold">{worstPeriod.label}</div>
              <div className={`font-mono font-bold ${worstPeriod.pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>{fmt$(worstPeriod.pnl)}</div>
              <div className="text-[11px] text-textFaint mt-0.5">{worstPeriod.winCount}W / {worstPeriod.lossCount}L</div>
            </Card>
          )}
        </div>
      )}

      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Period Breakdown</div>
        {rollups.length === 0 ? (
          <div className="text-center py-10 text-textFaint text-sm">No closed trades yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rollups.map((r) => (
              <div key={r.key} className="bg-surface2 rounded-lg">
                <button
                  onClick={() => toggle(r.key)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold w-36">{r.label}</span>
                    <span className="text-[11px] text-textFaint">{r.trades.length} trade{r.trades.length !== 1 ? "s" : ""}</span>
                    <span className="text-[11px] text-textFaint">{Math.round(r.winRate * 100)}% WR</span>
                    {r.streak.count > 1 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.streak.type === "win" ? "text-accent-green bg-accent-greenDim" : "text-accent-red bg-accent-redDim"}`}>
                        {r.streak.count} {r.streak.type}{r.streak.count > 1 ? "s" : ""} 🔥
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold text-sm ${r.pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                      {fmt$(r.pnl)}
                    </span>
                    {expanded[r.key] ? <ChevronUp size={14} className="text-textDim" /> : <ChevronDown size={14} className="text-textDim" />}
                  </div>
                </button>

                {expanded[r.key] && (
                  <div className="px-3.5 pb-3 border-t border-border pt-2.5">
                    <div className="grid grid-cols-4 gap-3 mb-2">
                      <div>
                        <div className="text-[10px] text-textFaint uppercase">Win Rate</div>
                        <div className="text-sm font-mono font-bold">{Math.round(r.winRate * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-textFaint uppercase">Profit Factor</div>
                        <div className="text-sm font-mono font-bold">{r.profitFactor >= 999 ? "∞" : r.profitFactor.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-textFaint uppercase">Avg Win</div>
                        <div className="text-sm font-mono font-bold text-accent-green">{fmt$(r.avgWin)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-textFaint uppercase">Avg Loss</div>
                        <div className="text-sm font-mono font-bold text-accent-red">{fmt$(-r.avgLoss)}</div>
                      </div>
                    </div>

                    {r.ruleViolations.length > 0 && (
                      <div className="text-[11px] text-accent-red mt-1">
                        Rule violations: {r.ruleViolations.join(", ")}
                      </div>
                    )}

                    {r.bestTrade && (
                      <div className="flex gap-4 mt-2 text-[11px]">
                        <span className="text-accent-green">Best: {fmt$(tradePnl(r.bestTrade))} ({r.bestTrade.symbol})</span>
                        {r.worstTrade && <span className="text-accent-red">Worst: {fmt$(tradePnl(r.worstTrade))} ({r.worstTrade.symbol})</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
