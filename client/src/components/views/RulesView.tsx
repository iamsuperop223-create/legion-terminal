import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card } from "@/components/ui/Card";
import { Trash2 } from "lucide-react";
import type { Rule } from "@/types";

const RULE_TYPES = [
  { value: "maxContracts", label: "Max Contracts" },
  { value: "stopRange", label: "Stop Distance Range" },
  { value: "dailyLossLimit", label: "Daily Loss Limit" },
  { value: "breakeven", label: "Move to Breakeven" },
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

  // Daily loss compliance
  const mllRule = rules.find((r) => r.type === "dailyLossLimit" && r.active);
  const dailyCompliance: Record<string, { pnl: number; pass: boolean; limit: number }> = {};
  if (mllRule) {
    const byDay: Record<string, number> = {};
    trades.filter((t) => t.status === "closed").forEach((t) => {
      const d = new Date(t.exitTime || t.entryTime).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + tradePnl(t);
    });
    Object.entries(byDay).forEach(([k, pnl]) => {
      dailyCompliance[k] = { pnl, pass: pnl >= -mllRule.params.amount, limit: mllRule.params.amount };
    });
  }
  const days = Object.entries(dailyCompliance)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 10);

  return (
    <div className="p-5 flex flex-col gap-4">
      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Trading rules</div>
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
                  <div className="text-[11px] text-textFaint">
                    {r.type === "maxContracts" && (
                      <>max <input type="number" value={r.params.maxQty || 6} onChange={(e) => updateField(r.id, "params.maxQty", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-14" /> contracts</>
                    )}
                    {r.type === "stopRange" && (
                      <>between <input type="number" value={r.params.minTicks || 45} onChange={(e) => updateField(r.id, "params.minTicks", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-12" /> and <input type="number" value={r.params.maxTicks || 50} onChange={(e) => updateField(r.id, "params.maxTicks", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-12" /> ticks</>
                    )}
                    {r.type === "dailyLossLimit" && (
                      <>limit $<input type="number" value={r.params.amount || 300} onChange={(e) => updateField(r.id, "params.amount", Number(e.target.value))} className="bg-surface border border-border rounded px-1.5 py-0.5 text-text text-[11px] font-mono w-16" /> per day</>
                    )}
                    {r.type === "breakeven" && "checked per trade"}
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

      {days.length > 0 && (
        <Card className="p-4">
          <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Daily loss limit compliance</div>
          <div className="flex flex-col gap-1.5">
            {days.map(([k, v]) => (
              <div key={k} className="flex justify-between items-center px-3 py-2 bg-surface2 rounded-lg text-sm">
                <span>{new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="font-mono">{fmt$(v.pnl)}</span>
                {v.pass ? (
                  <span className="text-accent-green text-[11px] font-bold bg-accent-greenDim px-2 py-0.5 rounded-full">Within limit</span>
                ) : (
                  <span className="text-accent-red text-[11px] font-bold bg-accent-redDim px-2 py-0.5 rounded-full">Breached ${v.limit}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function tradePnl(t: any): number {
  if (t.status !== "closed" || t.exitPrice == null) return 0;
  const SYMBOLS: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5 };
  const mult = SYMBOLS[t.symbol] || 1;
  const dir = t.direction === "long" ? 1 : -1;
  return (t.exitPrice - (t.entryPrice || 0)) * dir * t.qty * mult - (t.fee || 0);
}

function fmt$(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
