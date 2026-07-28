import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { tradePnl, fmt$, dayKey } from "@/types";

const CELL_H = "h-full min-h-[100px]";

export default function CalendarView() {
  const { trades } = useAppStore();
  const [cursor, setCursor] = useState(new Date());
  const closed = trades.filter((t) => t.status === "closed");

  const byDay = useMemo(() => {
    const m: Record<string, { pnl: number; count: number; missed: number }> = {};
    closed.forEach((t) => {
      const k = dayKey(t.exitTime || t.entryTime);
      if (!m[k]) m[k] = { pnl: 0, count: 0, missed: 0 };
      if (t.missed) {
        m[k].missed += 1;
      } else {
        m[k].pnl += tradePnl(t);
        m[k].count += 1;
      }
    });
    return m;
  }, [closed]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows: ((number | null)[])[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const weekTotals = useMemo(() => {
    return rows.map((row) => {
      let pnl = 0;
      let count = 0;
      let missed = 0;
      row.forEach((d) => {
        if (!d) return;
        const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const day = byDay[k];
        if (day) { pnl += day.pnl; count += day.count; missed += day.missed; }
      });
      return { pnl, count, missed };
    });
  }, [rows, byDay, year, month]);

  const monthPnl = Object.entries(byDay)
    .filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .reduce((a, [, v]) => a + v.pnl, 0);

  let weekNum = 0;

  return (
    <div className="p-4 flex flex-col w-full flex-1 min-h-0">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="text-textDim hover:text-text transition">
            <ChevronLeft size={16} />
          </button>
          <div className="font-bold text-sm">{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="text-textDim hover:text-text transition">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className={`font-mono font-bold text-sm ${monthPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
          {fmt$(monthPnl)}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-px">
        <div className="grid grid-cols-7 gap-px mb-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-[10px] text-textFaint uppercase tracking-wider py-0.5">{d}</div>
          ))}
        </div>

        {rows.map((row, rowIdx) => {
          const isLast = rowIdx === rows.length - 1;
          const hasSat = row[6] !== null;
          const wt = weekTotals[rowIdx];
          if (hasSat) weekNum++;
          const displayWeek = hasSat ? weekNum : weekNum;

          return (
            <div key={rowIdx} className="grid grid-cols-7 gap-px mb-px flex-1 min-h-0">
            {row.map((d, i) => {
              if (!d) return <div key={i} className={`${CELL_H}`} />;
              const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayData = byDay[k];
              const has = dayData !== undefined;
              const isSat = i === 6;

              if (isSat) {
                const wtPnl = wt.pnl;
                const wtCount = wt.count;
                return (
                  <div
                    key={i}
                    className={`${CELL_H} rounded border border-border flex flex-col items-center justify-center overflow-hidden ${
                      wtPnl !== 0 ? (wtPnl > 0 ? "bg-accent-greenDim" : "bg-accent-redDim") : "bg-surface2"
                    }`}
                  >
                    <div className="text-[9px] text-textFaint leading-none font-semibold">Wk {displayWeek}</div>
                    <div className={`font-mono text-[10px] font-bold leading-tight mt-0.5 ${wtPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                      {fmt$(wtPnl)}
                    </div>
                    <div className="text-[8px] text-textFaint leading-none mt-0.5">{wtCount} trades</div>
                    {wt.missed > 0 && <div className="text-[8px] text-accent-amber leading-none mt-0.5">{wt.missed} missed</div>}
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className={`${CELL_H} rounded border border-border flex flex-col items-center justify-center overflow-hidden ${
                    has ? (dayData!.pnl >= 0 ? "bg-accent-greenDim" : "bg-accent-redDim") : "bg-surface2"
                  }`}
                >
                  <div className="text-[11px] text-textFaint leading-none">{d}</div>
                  {has && (
                    <div className={`font-mono text-[10px] font-bold leading-tight mt-0.5 ${dayData!.pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                      {fmt$(dayData!.pnl)}
                    </div>
                  )}
                  {dayData && dayData.missed > 0 && (
                    <div className="text-[8px] text-accent-amber leading-none mt-0.5 font-semibold">M×{dayData.missed}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      </div>
    </div>
  );
}
