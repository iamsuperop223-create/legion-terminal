import { useMemo, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card, StatBox, Pill } from "@/components/ui/Card";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { TradeTable } from "@/components/trades/TradeTable";
import { tradePnl, fmt$, dayKey } from "@/types";
import { Q3_2026_EVENTS, IMPACT_COLORS } from "./EconCalendarView";
import { Clock, ChevronRight, DollarSign } from "lucide-react";

interface Props {
  onEdit: (trade: any) => void;
}

export default function Dashboard({ onEdit }: Props) {
  const { trades, rules, accounts, activeAccountId, bulkSetFee, fixTradeTimes } = useAppStore();
  const [feeModal, setFeeModal] = useState(false);
  const [feeInput, setFeeInput] = useState("");
  const [feeLoading, setFeeLoading] = useState(false);
  const [fixTimesLoading, setFixTimesLoading] = useState(false);
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

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dayKey(d.toISOString());
  }, []);

  const todayEvents = useMemo(() => Q3_2026_EVENTS.filter((e) => e.date === today), [today]);
  const tomorrowEvents = useMemo(() => Q3_2026_EVENTS.filter((e) => e.date === tomorrow), [tomorrow]);
  const hasAnyEvents = todayEvents.length > 0 || tomorrowEvents.length > 0;

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

      {/* Fee Quick-Set */}
      {closed.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-textDim">
              <DollarSign size={13} />
              <span>Fee per trade: {closed.some((t) => t.fee > 0) ? fmt$(closed[0].fee) : "not set"}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFeeModal(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface2 text-textDim hover:text-text transition font-semibold">
                Set Fee
              </button>
              <button
                onClick={async () => {
                  if (!confirm("This shifts ALL trade times by your timezone offset to fix incorrect dates. Only run this ONCE. Continue?")) return;
                  setFixTimesLoading(true);
                  const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
                  const count = await fixTradeTimes(offsetMs);
                  setFixTimesLoading(false);
                  alert(`Fixed ${count} trades.`);
                }}
                disabled={fixTimesLoading}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-[#5C2A28] text-[#F1685E] hover:brightness-125 transition font-semibold disabled:opacity-50"
              >
                {fixTimesLoading ? "Fixing..." : "Fix Trade Times"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Economic Events — Today + Tomorrow */}
      {hasAnyEvents && (
        <Card className="p-4">
          <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Economic Events</div>
          <div className="flex gap-4 flex-wrap">
            {todayEvents.length > 0 && (
              <div className="flex-1 min-w-[240px]">
                <div className="text-[11px] font-semibold text-textDim mb-2">Today</div>
                <div className="flex flex-col gap-1.5">
                  {todayEvents.map((e, i) => {
                    const ic = IMPACT_COLORS[e.impact];
                    return (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-textDim w-12">{e.time}</span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ic.dot}`} />
                        <span className="text-text flex-1 truncate">{e.event}</span>
                        <span className={`${ic.bg} ${ic.text} text-[9px] font-bold uppercase px-1.5 py-0.5 rounded`}>
                          {e.impact}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {tomorrowEvents.length > 0 && (
              <div className="flex-1 min-w-[240px]">
                <div className="text-[11px] font-semibold text-textDim mb-2">Tomorrow</div>
                <div className="flex flex-col gap-1.5">
                  {tomorrowEvents.map((e, i) => {
                    const ic = IMPACT_COLORS[e.impact];
                    return (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-textDim w-12">{e.time}</span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ic.dot}`} />
                        <span className="text-text flex-1 truncate">{e.event}</span>
                        <span className={`${ic.bg} ${ic.text} text-[9px] font-bold uppercase px-1.5 py-0.5 rounded`}>
                          {e.impact}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-3">Recent trades</div>
        {trades.length === 0 ? (
          <div className="text-center py-10 text-textFaint text-sm">No trades yet. Log your first trade to populate the dashboard.</div>
        ) : (
          <TradeTable
            trades={[...trades].sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()).slice(0, 8)}
            onEdit={onEdit}
            rules={rules}
            allTrades={trades}
          />
        )}
      </Card>

      {/* Bulk Fee Modal */}
      {feeModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setFeeModal(false)}>
          <div className="bg-[#11161F] border border-[#232B38] rounded-xl p-5 w-[360px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold mb-3">Set Fee for All Trades</div>
            <div className="text-[11px] text-[#5B6478] mb-3">
              Applies the same fee to every closed trade. This is subtracted from each trade's PnL.
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-[#8891A3]">$</span>
              <input
                type="number"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                placeholder="e.g. 4.50"
                className="bg-[#1A2029] border border-[#232B38] rounded-lg text-[#E7EAEF] px-3 py-2 text-sm font-mono flex-1 focus:outline-none focus:border-[#D4A24E]"
              />
            </div>
            <div className="flex gap-2">
              <button
                disabled={feeLoading || !feeInput}
                onClick={async () => {
                  setFeeLoading(true);
                  const count = await bulkSetFee(Number(feeInput));
                  setFeeLoading(false);
                  setFeeModal(false);
                  setFeeInput("");
                }}
                className="flex-1 bg-[#D4A24E] text-[#1A1206] rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
              >
                {feeLoading ? "Applying..." : `Apply to ${closed.length} trades`}
              </button>
              <button onClick={() => setFeeModal(false)} className="bg-transparent border border-[#232B38] text-[#8891A3] rounded-lg px-3 py-2 text-xs">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
