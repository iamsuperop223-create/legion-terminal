import { Pill } from "@/components/ui/Card";
import { tradePnl, fmt$, fmtDate, evaluateTradeRules } from "@/lib/tradeHelpers";
import { Pencil, Trash2 } from "lucide-react";

interface Props {
  trades: any[];
  onEdit: (trade: any) => void;
  onDelete?: (id: string) => void;
  rules?: any[];
}

export function TradeTable({ trades, onEdit, onDelete, rules = [] }: Props) {
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
            const results = evaluateTradeRules(t, rules);
            const fails = results.filter((r) => !r.pass).length;
            return (
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
                  ) : fails === 0 ? (
                    <Pill tone="green">Pass</Pill>
                  ) : (
                    <Pill tone="red">{fails} issue{fails > 1 ? "s" : ""}</Pill>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
