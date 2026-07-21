interface Props {
  pnlToday: number;
  mll: number;
  target: number;
}

export function RiskGauge({ pnlToday, mll, target }: Props) {
  const ratio = Math.max(-1, Math.min(1, pnlToday >= 0 ? pnlToday / target : pnlToday / mll));
  const angle = ratio * 90;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const cx = 110, cy = 100, r = 78;
  const needleX = cx + r * 0.86 * Math.sin(rad(angle));
  const needleY = cy - r * 0.86 * Math.cos(rad(angle));

  const arc = (startDeg: number, endDeg: number, color: string, width = 14) => {
    const s = { x: cx + r * Math.sin(rad(startDeg)), y: cy - r * Math.cos(rad(startDeg)) };
    const e = { x: cx + r * Math.sin(rad(endDeg)), y: cy - r * Math.cos(rad(endDeg)) };
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return (
      <path
        d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`}
        stroke={color} strokeWidth={width} fill="none" strokeLinecap="round"
      />
    );
  };

  const fmt = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col items-center">
      <svg width={220} height={130} viewBox="0 0 220 130">
        {arc(-90, -20, "#F1685E", 14)}
        {arc(-20, 20, "#8A6A38", 14)}
        {arc(20, 90, "#38D9A0", 14)}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#E7EAEF" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="#E7EAEF" />
        <text x={cx - r - 6} y={cy + 22} fill="#5B6478" fontSize="10" fontFamily="JetBrains Mono">-{fmt(mll)}</text>
        <text x={cx + r - 24} y={cy + 22} fill="#5B6478" fontSize="10" fontFamily="JetBrains Mono">+{fmt(target)}</text>
      </svg>
      <div className={`font-mono text-2xl font-bold mt-[-6px] ${pnlToday >= 0 ? "text-accent-green" : "text-accent-red"}`}>
        {fmt(pnlToday)}
      </div>
      <div className="text-[11px] text-textFaint uppercase tracking-wider mt-0.5">Today vs. daily loss limit</div>
    </div>
  );
}
