import { LayoutDashboard, ListOrdered, CalendarDays, BarChart3, ShieldCheck, Settings, BookOpen } from "lucide-react";

const items = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dash" },
  { id: "log", icon: ListOrdered, label: "Log" },
  { id: "calendar", icon: CalendarDays, label: "Cal" },
  { id: "stats", icon: BarChart3, label: "Stats" },
  { id: "rules", icon: ShieldCheck, label: "Rules" },
  { id: "attributes", icon: Settings, label: "Attrs" },
  { id: "journals", icon: BookOpen, label: "Journal" },
];

interface Props {
  view: string;
  setView: (v: string) => void;
}

export default function MobileNav({ view, setView }: Props) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around py-2 z-30">
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setView(it.id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 ${active ? "text-gold" : "text-textDim"}`}
          >
            <it.icon size={16} />
            <span className="text-[9px] font-semibold">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
