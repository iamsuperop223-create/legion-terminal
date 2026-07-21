import { useAppStore } from "@/stores/appStore";
import { Card } from "@/components/ui/Card";
import { TradeTable } from "@/components/trades/TradeTable";

interface Props {
  onEdit: (trade: any) => void;
}

export default function TradeLog({ onEdit }: Props) {
  const { trades, rules, deleteTrade } = useAppStore();

  return (
    <div className="p-5">
      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">All trades ({trades.length})</div>
        {trades.length === 0 ? (
          <div className="text-center py-10 text-textFaint text-sm">No trades logged yet.</div>
        ) : (
          <TradeTable
            trades={[...trades].sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())}
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
