import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card } from "@/components/ui/Card";
import { TradeTable } from "@/components/trades/TradeTable";

interface Props {
  onEdit: (trade: any) => void;
}

export default function TradeLog({ onEdit }: Props) {
  const { trades, rules, deleteTrade } = useAppStore();
  const [showMissed, setShowMissed] = useState(false);
  const filtered = showMissed ? trades : trades.filter((t) => !t.missed);

  return (
    <div className="p-5">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-textFaint uppercase tracking-wider">All trades ({filtered.length})</div>
          <label className="flex items-center gap-2 text-xs text-textDim cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMissed}
              onChange={(e) => setShowMissed(e.target.checked)}
              className="accent-accent-amber"
            />
            Show missed setups
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-textFaint text-sm">{showMissed ? "No trades at all." : "No trades logged yet. (missed setups hidden)"}</div>
        ) : (
          <TradeTable
            trades={[...filtered].sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())}
            onEdit={onEdit}
            onDelete={deleteTrade}
            rules={rules}
            allTrades={trades}
          />
        )}
      </Card>
    </div>
  );
}
