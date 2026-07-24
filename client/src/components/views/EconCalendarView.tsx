import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card } from "@/components/ui/Card";
import { tradePnl, fmt$ } from "@/lib/tradeHelpers";
import { AlertTriangle, Clock, ChevronDown, ChevronUp } from "lucide-react";

function dayKey(d: string): string {
  return new Date(d).toISOString().slice(0, 10);
}

interface EconEvent {
  date: string;
  time: string;
  event: string;
  impact: "high" | "medium" | "low";
  forecast?: string;
  previous?: string;
  actual?: string;
}

const Q3_2026_EVENTS: EconEvent[] = [
  // JULY 2026
  { date: "2026-07-01", time: "08:30", event: "ISM Manufacturing PMI", impact: "high", forecast: "50.2", previous: "49.8" },
  { date: "2026-07-02", time: "10:00", event: "JOLTS Job Openings", impact: "medium", forecast: "7.4M", previous: "7.6M" },
  { date: "2026-07-03", time: "08:30", event: "Non-Farm Payrolls", impact: "high", forecast: "180K", previous: "175K" },
  { date: "2026-07-03", time: "08:30", event: "Unemployment Rate", impact: "high", forecast: "4.1%", previous: "4.1%" },
  { date: "2026-07-03", time: "08:30", event: "Average Hourly Earnings MoM", impact: "high", forecast: "0.3%", previous: "0.4%" },
  { date: "2026-07-10", time: "08:30", event: "CPI MoM", impact: "high", forecast: "0.2%", previous: "0.1%" },
  { date: "2026-07-10", time: "08:30", event: "CPI YoY", impact: "high", forecast: "2.6%", previous: "2.4%" },
  { date: "2026-07-10", time: "08:30", event: "Core CPI MoM", impact: "high", forecast: "0.3%", previous: "0.2%" },
  { date: "2026-07-11", time: "08:30", event: "PPI MoM", impact: "medium", forecast: "0.2%", previous: "0.1%" },
  { date: "2026-07-15", time: "08:30", event: "Retail Sales MoM", impact: "high", forecast: "0.3%", previous: "0.1%" },
  { date: "2026-07-16", time: "08:30", event: "Building Permits", impact: "medium", forecast: "1.45M", previous: "1.42M" },
  { date: "2026-07-17", time: "08:30", event: "Initial Jobless Claims", impact: "medium", forecast: "225K", previous: "228K" },
  { date: "2026-07-22", time: "10:00", event: "Existing Home Sales", impact: "medium", forecast: "4.10M", previous: "4.05M" },
  { date: "2026-07-24", time: "08:30", event: "GDP QoQ (Advance)", impact: "high", forecast: "2.0%", previous: "1.6%" },
  { date: "2026-07-25", time: "08:30", event: "Core PCE Price Index MoM", impact: "high", forecast: "0.2%", previous: "0.1%" },
  { date: "2026-07-29", time: "10:00", event: "Consumer Confidence", impact: "medium", forecast: "100", previous: "98.0" },
  { date: "2026-07-30", time: "08:30", event: "Advance GDP QoQ (2nd est.)", impact: "high" },
  { date: "2026-07-31", time: "08:30", event: "PCE Price Index YoY", impact: "high" },
  { date: "2026-07-31", time: "10:00", event: "Chicago PMI", impact: "medium" },

  // AUGUST 2026
  { date: "2026-08-03", time: "10:00", event: "ISM Manufacturing PMI", impact: "high" },
  { date: "2026-08-05", time: "08:30", event: "Trade Balance", impact: "low" },
  { date: "2026-08-07", time: "08:30", event: "Non-Farm Payrolls", impact: "high" },
  { date: "2026-08-07", time: "08:30", event: "Unemployment Rate", impact: "high" },
  { date: "2026-08-07", time: "08:30", event: "Average Hourly Earnings MoM", impact: "high" },
  { date: "2026-08-12", time: "08:30", event: "CPI MoM", impact: "high" },
  { date: "2026-08-12", time: "08:30", event: "CPI YoY", impact: "high" },
  { date: "2026-08-13", time: "08:30", event: "PPI MoM", impact: "medium" },
  { date: "2026-08-14", time: "08:30", event: "Initial Jobless Claims", impact: "medium" },
  { date: "2026-08-14", time: "08:30", event: "Retail Sales MoM", impact: "high" },
  { date: "2026-08-18", time: "10:00", event: "Building Permits", impact: "medium" },
  { date: "2026-08-19", time: "08:30", event: "Housing Starts", impact: "medium" },
  { date: "2026-08-20", time: "10:00", event: "Existing Home Sales", impact: "medium" },
  { date: "2026-08-21", time: "10:00", event: "Leading Economic Index", impact: "low" },
  { date: "2026-08-26", time: "10:00", event: "Consumer Confidence", impact: "medium" },
  { date: "2026-08-28", time: "08:30", event: "GDP QoQ (2nd est.)", impact: "high" },
  { date: "2026-08-28", time: "08:30", event: "Core PCE Price Index MoM", impact: "high" },
  { date: "2026-08-31", time: "10:00", event: "ISM Manufacturing PMI", impact: "high" },

  // SEPTEMBER 2026
  { date: "2026-09-01", time: "08:30", event: "Construction Spending MoM", impact: "low" },
  { date: "2026-09-04", time: "08:30", event: "Non-Farm Payrolls", impact: "high" },
  { date: "2026-09-04", time: "08:30", event: "Unemployment Rate", impact: "high" },
  { date: "2026-09-04", time: "08:30", event: "Average Hourly Earnings MoM", impact: "high" },
  { date: "2026-09-09", time: "08:30", event: "CPI MoM", impact: "high" },
  { date: "2026-09-09", time: "08:30", event: "CPI YoY", impact: "high" },
  { date: "2026-09-10", time: "08:30", event: "PPI MoM", impact: "medium" },
  { date: "2026-09-11", time: "08:30", event: "Initial Jobless Claims", impact: "medium" },
  { date: "2026-09-11", time: "08:30", event: "Retail Sales MoM", impact: "high" },
  { date: "2026-09-16", time: "08:30", event: "Building Permits", impact: "medium" },
  { date: "2026-09-16", time: "08:30", event: "Housing Starts", impact: "medium" },
  { date: "2026-09-17", time: "10:00", event: "Existing Home Sales", impact: "medium" },
  { date: "2026-09-17", time: "14:00", event: "FOMC Rate Decision", impact: "high" },
  { date: "2026-09-17", time: "14:30", event: "FOMC Press Conference", impact: "high" },
  { date: "2026-09-18", time: "08:30", event: "Initial Jobless Claims", impact: "medium" },
  { date: "2026-09-22", time: "10:00", event: "Consumer Confidence", impact: "medium" },
  { date: "2026-09-24", time: "08:30", event: "GDP QoQ (Final)", impact: "high" },
  { date: "2026-09-25", time: "08:30", event: "Core PCE Price Index MoM", impact: "high" },
  { date: "2026-09-25", time: "10:00", event: "New Home Sales", impact: "medium" },
  { date: "2026-09-30", time: "08:30", event: "Advance GDP QoQ (3rd est.)", impact: "high" },
  { date: "2026-09-30", time: "10:00", event: "CB Consumer Confidence", impact: "medium" },
];

const IMPACT_COLORS = {
  high: { bg: "bg-[#5C2A28]", text: "text-[#F1685E]", dot: "bg-[#F1685E]" },
  medium: { bg: "bg-[#3A2E18]", text: "text-[#D4A24E]", dot: "bg-[#D4A24E]" },
  low: { bg: "bg-[#1E3A2E]", text: "text-[#38D9A0]", dot: "bg-[#38D9A0]" },
};

export default function CalendarView() {
  const { trades, rules } = useAppStore();
  const [filter, setFilter] = useState<"all" | "high">("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const closed = trades.filter((t) => t.status === "closed");

  const events = useMemo(() => {
    if (filter === "high") return Q3_2026_EVENTS.filter((e) => e.impact === "high");
    return Q3_2026_EVENTS;
  }, [filter]);

  const tradesByDate: Record<string, any[]> = useMemo(() => {
    const map: Record<string, any[]> = {};
    closed.forEach((t) => {
      const dk = dayKey(t.entryTime);
      if (!map[dk]) map[dk] = [];
      map[dk].push(t);
    });
    return map;
  }, [closed]);

  const grouped = useMemo(() => {
    const map: Record<string, EconEvent[]> = {};
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-textFaint uppercase tracking-wider">Economic Calendar — Q3 2026</div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold transition ${
              filter === "all" ? "bg-gold text-[#1A1206]" : "bg-surface2 text-textDim hover:text-text"
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter("high")}
            className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold transition ${
              filter === "high" ? "bg-[#F1685E] text-white" : "bg-surface2 text-textDim hover:text-text"
            }`}
          >
            High Impact Only
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {grouped.map(([date, dayEvents]) => {
          const dayTrades = tradesByDate[date] || [];
          const dayPnl = dayTrades.reduce((a: number, t: any) => a + tradePnl(t), 0);
          const isExpanded = expanded[date];
          const hasHighImpact = dayEvents.some((e) => e.impact === "high");

          return (
            <Card key={date} className="p-3">
              <button
                onClick={() => setExpanded((p) => ({ ...p, [date]: !p[date] }))}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {hasHighImpact && <div className="w-1.5 h-1.5 rounded-full bg-[#F1685E] flex-shrink-0" />}
                    <div>
                      <div className="text-sm font-semibold">
                        {new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div className="text-[10px] text-textFaint">
                        {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                        {dayTrades.length > 0 && ` · ${dayTrades.length} trade${dayTrades.length !== 1 ? "s" : ""}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {dayTrades.length > 0 && (
                      <span className={`font-mono text-[11px] font-bold ${dayPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                        {fmt$(dayPnl)}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={14} className="text-textDim" /> : <ChevronDown size={14} className="text-textDim" />}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-2.5 border-t border-border pt-2.5 flex flex-col gap-1.5">
                  {dayEvents.map((e, i) => {
                    const ic = IMPACT_COLORS[e.impact];
                    return (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <Clock size={10} className="text-textFaint flex-shrink-0" />
                        <span className="font-mono text-textDim w-12">{e.time}</span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ic.dot}`} />
                        <span className="text-text flex-1">{e.event}</span>
                        <span className={`${ic.bg} ${ic.text} text-[9px] font-bold uppercase px-1.5 py-0.5 rounded`}>
                          {e.impact}
                        </span>
                        {e.forecast && <span className="text-textDim font-mono">F: {e.forecast}</span>}
                        {e.previous && <span className="text-textDim font-mono">P: {e.previous}</span>}
                      </div>
                    );
                  })}
                  {dayTrades.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-border">
                      <div className="text-[10px] text-textFaint uppercase tracking-wider mb-1">Trades on this day</div>
                      {dayTrades.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-2 text-[11px]">
                          <span className={`font-mono font-bold ${tradePnl(t) >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                            {fmt$(tradePnl(t))}
                          </span>
                          <span className="text-textDim">{t.symbol} {t.direction} x{t.qty}</span>
                          <span className="text-textFaint">{t.entryPrice} → {t.exitPrice}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
