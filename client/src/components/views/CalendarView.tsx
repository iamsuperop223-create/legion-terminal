import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card } from "@/components/ui/Card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { tradePnl, fmt$, dayKey } from "@/types";

export default function CalendarView() {
  const { trades } = useAppStore();
  const [cursor, setCursor] = useState(new Date());
  const closed = trades.filter((t) => t.status === "closed");

  const byDay = useMemo(() => {
    const m: Record<string, number> = {};
    closed.forEach((t) => {
      const k = dayKey(t.exitTime || t.entryTime);
      m[k] = (m[k] || 0) + tradePnl(t);
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

  const monthPnl = Object.entries(byDay)
    .filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .reduce((a, [, v]) => a + v, 0);

  return (
    <div className="p-5">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="text-textDim hover:text-text transition">
              <ChevronLeft size={18} />
            </button>
            <div className="font-bold text-base">{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="text-textDim hover:text-text transition">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className={`font-mono font-bold ${monthPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
            {fmt$(monthPnl)}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-[11px] text-textFaint">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const pnl = byDay[k];
            const has = pnl !== undefined;
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg border border-border flex flex-col items-center justify-center p-1 ${
                  has ? (pnl >= 0 ? "bg-accent-greenDim" : "bg-accent-redDim") : "bg-surface2"
                }`}
              >
                <div className="text-[11px] text-textFaint">{d}</div>
                {has && (
                  <div className={`font-mono text-[11px] font-bold ${pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                    {fmt$(pnl)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
