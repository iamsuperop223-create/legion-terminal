import { useAppStore } from "@/stores/appStore";
import { Card, StatBox, Pill } from "@/components/ui/Card";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { TradeTable } from "@/components/trades/TradeTable";
import { tradePnl, fmt$, dayKey } from "@/types";

interface Props {
  onEdit: (trade: any) => void;
}

export default function Dashboard({ onEdit }: Props) {
  const { trades, rules, accounts, activeAccountId } = useAppStore();
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");
  const wins = closed.filter((t) => tradePnl(t) > 0);
  const losses = closed.filter((t) => tradePnl(t) < 0);
  const totalPnl = closed.reduce((a, t) => a + tradePnl(t), 0);
  const currentBalance = (activeAccount?.balance || 0) + totalPnl;
  const today = dayKey(new Date().toISOString());
  const pnlToday = closed
    .filter((t) => dayKey(t.exitTime || t.entryTime) === today)
    .reduce((a, t) => a + tradePnl(t), 0);
  const mllRule = rules.find((r) => r.type === "dailyLossLimit" && r.active);
  const mll = mllRule?.params?.amount || 300;

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex gap-4 flex-wrap">
        <Card className="p-5 flex justify-center">
          <RiskGauge pnlToday={pnlToday} mll={mll} target={mll * 1.5} />
        </Card>
        <div className="flex-1 min-w-[280px] flex flex-wrap gap-3 content-start">
          <StatBox label="Wins" value={wins.length} tone="green" />
          <StatBox label="Losses" value={losses.length} tone="red" />
          <StatBox label="Open" value={open.length} />
          <StatBox label="Total PnL" value={fmt$(totalPnl)} tone={totalPnl >= 0 ? "green" : "red"} />
          <StatBox label="Balance" value={fmt$(currentBalance)} />
          <StatBox label="Win rate" value={closed.length ? `${Math.round((wins.length / closed.length) * 100)}%` : "0%"} />
          <StatBox
            label="Avg win"
            value={wins.length ? fmt$(wins.reduce((a, t) => a + tradePnl(t), 0) / wins.length) : "$0.00"}
            tone="green"
          />
        </div>
      </div>

      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Recent trades</div>
        {trades.length === 0 ? (
          <div className="text-center py-10 text-textFaint text-sm">No trades yet. Log your first trade to populate the dashboard.</div>
        ) : (
          <TradeTable
            trades={[...trades].sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()).slice(0, 8)}
            onEdit={onEdit}
          />
        )}
      </Card>
    </div>
  );
}
