interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, className = "", style }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-[10px] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

type PillTone = "neutral" | "green" | "red" | "gold";

const PILL_STYLES: Record<PillTone, { bg: string; fg: string }> = {
  neutral: { bg: "bg-surface2", fg: "text-textDim" },
  green: { bg: "bg-accent-greenDim", fg: "text-accent-green" },
  red: { bg: "bg-accent-redDim", fg: "text-accent-red" },
  gold: { bg: "bg-[#3A2E18]", fg: "text-gold" },
};

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: PillTone }) {
  const s = PILL_STYLES[tone];
  return (
    <span className={`${s.bg} ${s.fg} text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-full uppercase`}>
      {children}
    </span>
  );
}

export function StatBox({ label, value, tone = "text" }: { label: string; value: React.ReactNode; tone?: "text" | "green" | "red" }) {
  const color = tone === "green" ? "text-accent-green" : tone === "red" ? "text-accent-red" : "text-text";
  return (
    <Card className="p-4 flex-1 min-w-[130px]">
      <div className="text-[11px] text-textFaint uppercase tracking-wider mb-2">{label}</div>
      <div className={`font-mono text-xl font-semibold ${color}`}>{value}</div>
    </Card>
  );
}
