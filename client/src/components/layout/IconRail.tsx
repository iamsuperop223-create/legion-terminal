import { LayoutDashboard, ListOrdered, CalendarDays, BarChart3, ShieldCheck, Settings, BookOpen, FileText, Globe } from "lucide-react";

const items = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "log", icon: ListOrdered, label: "Trade Log" },
  { id: "calendar", icon: CalendarDays, label: "Calendar" },
  { id: "stats", icon: BarChart3, label: "Statistics" },
  { id: "rollups", icon: FileText, label: "Rollup Reports" },
  { id: "econ", icon: Globe, label: "Economic Calendar" },
  { id: "rules", icon: ShieldCheck, label: "Rules" },
  { id: "attributes", icon: Settings, label: "Attributes" },
  { id: "journals", icon: BookOpen, label: "Journal" },
];

interface Props {
  view: string;
  setView: (v: string) => void;
}

export default function IconRail({ view, setView }: Props) {
  return (
    <div className="w-[60px] bg-bg border-r border-border flex flex-col items-center pt-4 gap-1 max-md:hidden">
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setView(it.id)}
            title={it.label}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition ${
              active
                ? "bg-surface2 border border-borderLight text-gold"
                : "text-textDim hover:text-text hover:bg-surface2"
            }`}
          >
            <it.icon size={18} />
          </button>
        );
      })}
    </div>
  );
}
