import { useState, Fragment } from "react";
import { Pill } from "@/components/ui/Card";
import { tradePnl, fmt$, fmtDate, evaluateTradeRules } from "@/lib/tradeHelpers";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  trades: any[];
  onEdit: (trade: any) => void;
  onDelete?: (id: string) => void;
  rules?: any[];
  allTrades?: any[];
}

export function TradeTable({ trades, onEdit, onDelete, rules = [], allTrades }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const cols = ["Date", "Symbol", "Dir", "Qty", "Entry", "Exit", "PnL", "Compliance", ""];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="text-left px-2.5 py-1.5 text-textFaint font-semibold text-[11px] uppercase border-b border-border">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const pnl = tradePnl(t);
            const results = evaluateTradeRules(t, rules, allTrades);
            const fails = results.filter((r) => !r.pass);
            const isOpen = !!expanded[t.id];
            return (
              <Fragment key={t.id}>
                <tr key={t.id} className="border-b border-border">
                  <td className="px-2.5 py-2 text-text">{fmtDate(t.entryTime)}</td>
                  <td className="px-2.5 py-2 text-text">{t.symbol}</td>
                  <td className="px-2.5 py-2">
                    <Pill tone={t.direction === "long" ? "green" : "red"}>{t.direction}</Pill>
                  </td>
                  <td className="px-2.5 py-2 font-mono">{t.qty}</td>
                  <td className="px-2.5 py-2 font-mono">{t.entryPrice}</td>
                  <td className="px-2.5 py-2 font-mono">{t.status === "closed" ? t.exitPrice : "—"}</td>
                  <td className={`px-2.5 py-2 font-mono font-semibold ${t.status !== "closed" ? "text-textFaint" : pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                    {t.status === "closed" ? fmt$(pnl) : "OPEN"}
                  </td>
                  <td className="px-2.5 py-2">
                    {results.length === 0 ? (
                      <span className="text-textFaint">—</span>
                    ) : fails.length === 0 ? (
                      <Pill tone="green">Pass</Pill>
                    ) : (
                      <button
                        onClick={() => toggle(t.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-accent-red bg-accent-redDim px-2 py-0.5 rounded-full hover:brightness-125 transition cursor-pointer"
                      >
                        {fails.length} issue{fails.length > 1 ? "s" : ""}
                        {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(t)} className="text-textDim hover:text-text transition"><Pencil size={14} /></button>
                      {onDelete && (
                        <button onClick={() => onDelete(t.id)} className="text-textDim hover:text-accent-red transition"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
                {isOpen && fails.length > 0 && (
                  <tr key={`${t.id}-detail`} className="border-b border-border">
                    <td colSpan={9} className="px-2.5 py-2 bg-surface2">
                      <div className="flex flex-col gap-1">
                        {fails.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-red flex-shrink-0" />
                            <span className="text-textDim">{r.rule.name}:</span>
                            <span className="text-accent-red">{r.detail}</span>
                          </div>
                        ))}
                        {results.filter((r) => r.pass).length > 0 && (
                          <div className="text-[10px] text-textFaint mt-1 border-t border-border pt-1">
                            {results.filter((r) => r.pass).length} rule{results.filter((r) => r.pass).length > 1 ? "s" : ""} passed
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
