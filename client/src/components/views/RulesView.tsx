import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card } from "@/components/ui/Card";
import { Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { tradePnl, fmt$, computeDailyCompliance } from "@/lib/tradeHelpers";

const RULE_TYPES = [
  { value: "maxContracts", label: "Max Contracts" },
  { value: "stopRange", label: "Stop Distance Range" },
  { value: "dailyLossLimit", label: "Daily Loss Limit" },
  { value: "breakeven", label: "Move to Breakeven" },
  { value: "maxTradesPerDay", label: "Max Trades Per Day" },
  { value: "maxTradesPerSession", label: "Max Trades Per Session" },
  { value: "breakevenAtR", label: "BE @ R Multiple" },
  { value: "scaleOut", label: "Scale Out Range" },
  { value: "maxDailyProfit", label: "Max Daily Profit" },
  { value: "losingDayBreak", label: "Losing Day Break" },
  { value: "custom", label: "Custom Checklist" },
];

export default function RulesView() {
  const { rules, trades, createRule, updateRule, deleteRule } = useAppStore();
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState("custom");

  const addRule = async () => {
    if (!newRuleName.trim()) return;
    const params: Record<string, any> = {};
    if (newRuleType === "maxContracts") params.maxQty = 6;
    if (newRuleType === "stopRange") { params.minTicks = 45; params.maxTicks = 50; }
    if (newRuleType === "dailyLossLimit") params.amount = 300;
    if (newRuleType === "maxTradesPerDay") params.maxTrades = 3;
    if (newRuleType === "maxTradesPerSession") params.maxTrades = 2;
    if (newRuleType === "breakevenAtR") params.minR = 1.5;
    if (newRuleType === "scaleOut") { params.minPercent = 30; params.maxPercent = 50; }
    if (newRuleType === "maxDailyProfit") params.amount = 500;
    if (newRuleType === "losingDayBreak") { params.consecutiveDays = 3; params.breakDays = 1; }
    await createRule({ name: newRuleName.trim(), type: newRuleType, params });
    setNewRuleName("");
    setNewRuleType("custom");
  };

  const updateField = (id: string, field: string, value: any) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    if (field.startsWith("params.")) {
      const key = field.split(".")[1];
      updateRule(id, { params: { ...rule.params, [key]: value } });
    } else {
      updateRule(id, { [field]: value });
    }
  };

  const dailyCompliance = useMemo(() => computeDailyCompliance(trades, rules), [trades, rules]);
  const days = Object.entries(dailyCompliance)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 14);

  const activeRuleCount = rules.filter((r) => r.active).length;

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Rules List */}
      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Trading rules ({activeRuleCount} active)</div>
        <div className="flex flex-col gap-2.5">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-3.5 py-2.5 bg-surface2 rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={() => updateRule(r.id, { active: !r.active })}
                  className="accent-gold"
                />
                <div>
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="text-[11px] text-textFaint flex items-center gap-1 flex-wrap">
                    {r.type === "maxContracts" && (
                      <>max <input type="number" value={r.params.maxQty || 6} onChange={(e) => updateField(r.id, "params.maxQty", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" /> contracts</>
                    )}
                    {r.type === "stopRange" && (
                      <>between <input type="number" value={r.params.minTicks || 45} onChange={(e) => updateField(r.id, "params.minTicks", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-12" /> and <input type="number" value={r.params.maxTicks || 50} onChange={(e) => updateField(r.id, "params.maxTicks", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-12" /> ticks</>
                    )}
                    {r.type === "dailyLossLimit" && (
                      <>limit $<input type="number" value={r.params.amount || 300} onChange={(e) => updateField(r.id, "params.amount", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-16" /> per day</>
                    )}
                    {r.type === "breakeven" && "checked per trade (moved to breakeven)"}
                    {r.type === "maxTradesPerDay" && (
                      <>max <input type="number" value={r.params.maxTrades || 3} onChange={(e) => updateField(r.id, "params.maxTrades", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" /> trades per day</>
                    )}
                    {r.type === "maxTradesPerSession" && (
                      <>max <input type="number" value={r.params.maxTrades || 2} onChange={(e) => updateField(r.id, "params.maxTrades", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" /> trades per session</>
                    )}
                    {r.type === "breakevenAtR" && (
                      <>move to BE at <input type="number" step="0.1" value={r.params.minR || 1.5} onChange={(e) => updateField(r.id, "params.minR", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" />R</>
                    )}
                    {r.type === "scaleOut" && (
                      <>scale out <input type="number" value={r.params.minPercent || 30} onChange={(e) => updateField(r.id, "params.minPercent", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" />%–<input type="number" value={r.params.maxPercent || 50} onChange={(e) => updateField(r.id, "params.maxPercent", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" />% of position</>
                    )}
                    {r.type === "maxDailyProfit" && (
                      <>cap $<input type="number" value={r.params.amount || 500} onChange={(e) => updateField(r.id, "params.amount", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-16" /> daily profit</>
                    )}
                    {r.type === "losingDayBreak" && (
                      <>after <input type="number" value={r.params.consecutiveDays || 3} onChange={(e) => updateField(r.id, "params.consecutiveDays", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" /> losing days, take <input type="number" value={r.params.breakDays || 1} onChange={(e) => updateField(r.id, "params.breakDays", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" /> day break</>
                    )}
                    {r.type === "custom" && "manual checklist item"}
                  </div>
                </div>
              </div>
              <button onClick={() => deleteRule(r.id)} className="text-textDim hover:text-accent-red transition">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3.5">
          <input
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            placeholder="Rule name..."
            className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-text text-sm"
          />
          <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value)} className="bg-surface2 border border-border rounded-lg px-3 py-2 text-text text-sm">
            {RULE_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </select>
          <button onClick={addRule} className="bg-gold text-[#1A1206] font-bold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition">Add</button>
        </div>
      </Card>

      {/* Daily Compliance Dashboard */}
      {days.length > 0 && (
        <Card className="p-4">
          <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Daily compliance</div>
          <div className="flex flex-col gap-2">
            {days.map(([dk, data]) => {
              const allPass = data.ruleResults.length === 0 || data.ruleResults.every((r) => r.pass);
              const hasFailures = data.ruleResults.some((r) => !r.pass);
              return (
                <div key={dk} className="bg-surface2 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {new Date(dk).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <span className="text-[11px] text-textFaint">{data.tradeCount} trade{data.tradeCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-semibold text-sm ${data.pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                        {fmt$(data.pnl)}
                      </span>
                      {data.ruleResults.length > 0 && (
                        hasFailures ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-accent-red bg-accent-redDim px-2 py-0.5 rounded-full">
                            <AlertTriangle size={10} /> VIOLATION
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-accent-green bg-accent-greenDim px-2 py-0.5 rounded-full">
                            <CheckCircle size={10} /> PASS
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  {data.ruleResults.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {data.ruleResults.map((rr, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rr.pass ? "bg-accent-green" : "bg-accent-red"}`} />
                          <span className="text-textDim">{rr.rule.name}:</span>
                          <span className={rr.pass ? "text-accent-green" : "text-accent-red"}>{rr.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
