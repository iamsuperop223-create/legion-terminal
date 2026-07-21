import { useState, useMemo, useRef } from "react";
import { useAppStore } from "@/stores/appStore";
import { X, ShieldCheck, Check, AlertTriangle, Upload, Image } from "lucide-react";
import { SYMBOLS, uid } from "@/types";
import { evaluateTradeRules, tradePnl, fmt$ } from "@/lib/tradeHelpers";
import { api } from "@/lib/api";

interface Props {
  trade: any;
  onSave: () => void;
  onClose: () => void;
}

const GRADES = ["A+", "A", "B", "C"];
const RESULTS = ["win", "loss", "breakeven"];

export default function TradeModal({ trade, onSave, onClose }: Props) {
  const { rules, attributes, activeAccountId, trades, createTrade, updateTrade } = useAppStore();

  const closedTrades = useMemo(() => trades.filter((t: any) => t.status === "closed"), [trades]);

  const avgWin = useMemo(() => {
    const wins = closedTrades.filter((t: any) => tradePnl(t) > 0);
    return wins.length ? wins.reduce((a: number, t: any) => a + tradePnl(t), 0) / wins.length : 0;
  }, [closedTrades]);

  const avgLoss = useMemo(() => {
    const losses = closedTrades.filter((t: any) => tradePnl(t) < 0);
    return losses.length ? losses.reduce((a: number, t: any) => a + tradePnl(t), 0) / losses.length : 0;
  }, [closedTrades]);

  const winRate = useMemo(() => {
    const wins = closedTrades.filter((t: any) => tradePnl(t) > 0);
    return closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0;
  }, [closedTrades]);

  const profitFactor = useMemo(() => {
    const grossWin = closedTrades.filter((t: any) => tradePnl(t) > 0).reduce((a: number, t: any) => a + tradePnl(t), 0);
    const grossLoss = Math.abs(closedTrades.filter((t: any) => tradePnl(t) < 0).reduce((a: number, t: any) => a + tradePnl(t), 0));
    return grossLoss ? grossWin / grossLoss : 0;
  }, [closedTrades]);

  const expectancy = useMemo(() => {
    if (!closedTrades.length) return 0;
    const wr = winRate / 100;
    const avgW = Math.abs(avgWin);
    const avgL = Math.abs(avgLoss);
    return wr * avgW - (1 - wr) * avgL;
  }, [winRate, avgWin, avgLoss, closedTrades]);

  const [t, setT] = useState(
    trade || {
      id: uid(), symbol: "NQ", direction: "long", qty: 6, entryPrice: "", exitPrice: "",
      entryTime: new Date().toISOString().slice(0, 16), exitTime: "", status: "open",
      stopTicks: "", takeProfitTicks: "", fee: 0, notes: "", movedToBreakeven: false,
      customChecks: {}, attributeValues: [], result: "", pnlPoints: "", grade: "",
      analysis: "", exitNotes: "", screenshotUrl: "",
    }
  );
  const [checked, setChecked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (k: string, v: any) => setT((prev: any) => ({ ...prev, [k]: v }));
  const customRules = rules.filter((r) => r.type === "custom" && r.active);
  const evalResults = useMemo(() => evaluateTradeRules(t, rules), [t, rules]);

  // Auto-calculate R:R
  const rr = useMemo(() => {
    const sl = Number(t.stopTicks);
    const tp = Number(t.takeProfitTicks);
    if (sl > 0 && tp > 0) return (tp / sl).toFixed(1);
    return "—";
  }, [t.stopTicks, t.takeProfitTicks]);

  // Auto-calculate result when closed
  const autoResult = useMemo(() => {
    if (t.status !== "closed" || t.exitPrice == null || t.entryPrice == null) return null;
    const pnl = tradePnl(t);
    if (pnl > 0) return "win";
    if (pnl < 0) return "loss";
    return "breakeven";
  }, [t.status, t.exitPrice, t.entryPrice, t]);

  const displayResult = autoResult || t.result || "";
  const displayPnlPoints = useMemo(() => {
    if (t.pnlPoints) return t.pnlPoints;
    if (t.status === "closed" && t.exitPrice != null && t.entryPrice != null) {
      const dir = t.direction === "long" ? 1 : -1;
      return ((t.exitPrice - t.entryPrice) * dir).toFixed(1);
    }
    return "";
  }, [t.pnlPoints, t.status, t.exitPrice, t.entryPrice, t.direction]);

  const setAttrValue = (attributeDefinitionId: string, value: any) => {
    setT((prev: any) => {
      const existing = (prev.attributeValues || []).filter((v: any) => v.attributeDefinitionId !== attributeDefinitionId);
      return { ...prev, attributeValues: [...existing, { attributeDefinitionId, value }] };
    });
  };

  const getAttrValue = (attributeDefinitionId: string) => {
    const found = (t.attributeValues || []).find((v: any) => v.attributeDefinitionId === attributeDefinitionId);
    return found ? found.value : "";
  };

  const activeAttributes = attributes.filter((a) => a.active);
  const attrsByCategory = activeAttributes.reduce((acc: Record<string, any[]>, a) => {
    (acc[a.category] = acc[a.category] || []).push(a);
    return acc;
  }, {});

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("screenshot", file);
      const token = api.getToken();
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiUrl}/api/trades/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.url) update("screenshotUrl", data.url);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const cleaned: any = {
      accountId: activeAccountId,
      symbol: t.symbol,
      direction: t.direction,
      qty: Number(t.qty) || 0,
      entryPrice: t.entryPrice === "" ? null : Number(t.entryPrice),
      exitPrice: t.exitPrice === "" || t.exitPrice == null ? null : Number(t.exitPrice),
      entryTime: t.entryTime,
      exitTime: t.exitTime || null,
      status: t.status,
      fee: Number(t.fee) || 0,
      notes: t.notes || "",
      movedToBreakeven: t.movedToBreakeven || false,
      customChecks: t.customChecks || {},
      stopTicks: t.stopTicks === "" || t.stopTicks == null ? null : Number(t.stopTicks),
      takeProfitTicks: t.takeProfitTicks === "" || t.takeProfitTicks == null ? null : Number(t.takeProfitTicks),
      result: autoResult || t.result || null,
      pnlPoints: displayPnlPoints ? Number(displayPnlPoints) : null,
      grade: t.grade || null,
      analysis: t.analysis || null,
      exitNotes: t.exitNotes || null,
      screenshotUrl: t.screenshotUrl || null,
    };
    if (trade?.id) {
      await updateTrade(trade.id, cleaned);
    } else {
      await createTrade(cleaned);
    }
    onSave();
  };

  const inputCls = "bg-[#1A2029] border border-[#232B38] rounded-lg text-[#E7EAEF] px-3 py-2 text-sm font-mono w-[200px] focus:outline-none focus:border-[#D4A24E]";
  const pillCls = "border-none rounded-lg px-3.5 py-2 text-xs cursor-pointer font-sans transition";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex justify-end">
      <div className="w-[560px] max-w-full h-full bg-[#11161F] border-l border-[#232B38] flex flex-col">
        <div className="flex justify-between items-center px-5 py-4 border-b border-[#232B38]">
          <div className="font-bold text-base">{trade?.id ? "Edit Trade" : "New Trade"}</div>
          <button onClick={onClose} className="text-[#8891A3] hover:text-[#E7EAEF] transition"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* ── Core Fields ── */}
          <SectionTitle>Trade Details</SectionTitle>
          <Row label="Symbol">
            <select value={t.symbol} onChange={(e) => update("symbol", e.target.value)} className={inputCls}>
              {Object.keys(SYMBOLS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Row>
          <Row label="Direction">
            <div className="flex gap-2">
              {(["long", "short"] as const).map((d) => (
                <button key={d} onClick={() => update("direction", d)} className={`${pillCls} ${
                  t.direction === d ? (d === "long" ? "bg-[#1E5844] text-[#38D9A0]" : "bg-[#5C2A28] text-[#F1685E]") : "bg-[#1A2029] text-[#8891A3]"
                }`}>{d.toUpperCase()}</button>
              ))}
            </div>
          </Row>
          <Row label="Status">
            <div className="flex gap-2">
              {(["open", "closed"] as const).map((s) => (
                <button key={s} onClick={() => update("status", s)} className={`${pillCls} ${
                  t.status === s ? "bg-[#1A2029] text-[#E7EAEF] border border-[#2E3745]" : "bg-transparent text-[#8891A3] border border-[#232B38]"
                }`}>{s}</button>
              ))}
            </div>
          </Row>
          <Row label="Contracts (qty)">
            <input type="number" value={t.qty} onChange={(e) => update("qty", e.target.value)} className={inputCls} />
          </Row>
          <Row label="Entry price">
            <input type="number" value={t.entryPrice} onChange={(e) => update("entryPrice", e.target.value)} className={inputCls} />
          </Row>
          {t.status === "closed" && (
            <Row label="Exit price">
              <input type="number" value={t.exitPrice} onChange={(e) => update("exitPrice", e.target.value)} className={inputCls} />
            </Row>
          )}
          <Row label="Entry time">
            <input type="datetime-local" value={t.entryTime} onChange={(e) => update("entryTime", e.target.value)} className={inputCls} />
          </Row>
          {t.status === "closed" && (
            <Row label="Exit time">
              <input type="datetime-local" value={t.exitTime} onChange={(e) => update("exitTime", e.target.value)} className={inputCls} />
            </Row>
          )}

          {/* ── Risk Management ── */}
          <SectionTitle>Risk Management</SectionTitle>
          <Row label="Stop Loss (ticks)">
            <input type="number" value={t.stopTicks || ""} onChange={(e) => update("stopTicks", e.target.value)} className={inputCls} placeholder="e.g. 48" />
          </Row>
          <Row label="Take Profit (ticks)">
            <input type="number" value={t.takeProfitTicks || ""} onChange={(e) => update("takeProfitTicks", e.target.value)} className={inputCls} placeholder="e.g. 96" />
          </Row>
          <Row label="R:R">
            <div className="font-mono text-sm text-[#D4A24E] font-bold px-3 py-2">{rr}</div>
          </Row>
          {t.status === "closed" && (
            <Row label="Moved to Breakeven">
              <input type="checkbox" checked={!!t.movedToBreakeven} onChange={(e) => update("movedToBreakeven", e.target.checked)} className="accent-[#D4A24E]" />
            </Row>
          )}

          {/* ── Trade Result ── */}
          <SectionTitle>Trade Result</SectionTitle>
          {t.status === "closed" && (
            <>
              <Row label="Result">
                <div className="flex gap-2">
                  {RESULTS.map((r) => (
                    <button key={r} onClick={() => update("result", r)} className={`${pillCls} capitalize ${
                      displayResult === r
                        ? r === "win" ? "bg-[#1E5844] text-[#38D9A0]"
                          : r === "loss" ? "bg-[#5C2A28] text-[#F1685E]"
                          : "bg-[#2E3745] text-[#8891A3]"
                        : "bg-[#1A2029] text-[#5B6478] border border-[#232B38]"
                    }`}>{r}</button>
                  ))}
                </div>
              </Row>
              <Row label="PnL (points)">
                <input type="number" value={displayPnlPoints} onChange={(e) => update("pnlPoints", e.target.value)} className={inputCls} readOnly={!!autoResult} placeholder="auto-calculated" />
              </Row>
            </>
          )}
          <Row label="Grade">
            <div className="flex gap-2">
              {GRADES.map((g) => (
                <button key={g} onClick={() => update("grade", g)} className={`${pillCls} ${
                  t.grade === g ? "bg-[#D4A24E] text-[#1A1206] font-bold" : "bg-[#1A2029] text-[#8891A3] border border-[#232B38]"
                }`}>{g}</button>
              ))}
            </div>
          </Row>

          {/* ── Screenshot ── */}
          <SectionTitle>Screenshot</SectionTitle>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`${pillCls} bg-[#1A2029] text-[#D4A24E] border border-[#8A6A38] flex items-center gap-2`}
            >
              <Upload size={14} /> {uploading ? "Uploading..." : "Upload Screenshot"}
            </button>
            {t.screenshotUrl && (
              <div className="flex items-center gap-2">
                <Image size={14} className="text-[#38D9A0]" />
                <a href={t.screenshotUrl} target="_blank" className="text-xs text-[#38D9A0] underline">View</a>
                <button onClick={() => update("screenshotUrl", null)} className="text-xs text-[#F1685E]">Remove</button>
              </div>
            )}
          </div>

          {/* ── Notes & Analysis ── */}
          <SectionTitle>Notes & Analysis</SectionTitle>
          <div>
            <div className="text-[11px] text-[#5B6478] mb-1.5 uppercase tracking-wider">Trade Analysis</div>
            <textarea
              value={t.analysis || ""}
              onChange={(e) => update("analysis", e.target.value)}
              rows={4}
              className={`${inputCls} !w-full resize-y`}
              placeholder="What was the setup? Why did you take this trade? What was the context?"
            />
          </div>
          <div>
            <div className="text-[11px] text-[#5B6478] mb-1.5 uppercase tracking-wider">Exit Notes</div>
            <textarea
              value={t.exitNotes || ""}
              onChange={(e) => update("exitNotes", e.target.value)}
              rows={3}
              className={`${inputCls} !w-full resize-y`}
              placeholder="Why did you exit? Was the exit planned or reactive?"
            />
          </div>
          <div>
            <div className="text-[11px] text-[#5B6478] mb-1.5 uppercase tracking-wider">General Notes</div>
            <textarea
              value={t.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              className={`${inputCls} !w-full resize-y`}
              placeholder="Trade rationale, footprint read, absorption context..."
            />
          </div>

          {/* ── Custom Rules & Attributes ── */}
          {customRules.map((r) => (
            <Row key={r.id} label={r.name}>
              <input
                type="checkbox"
                checked={!!t.customChecks?.[r.id]}
                onChange={(e) => update("customChecks", { ...t.customChecks, [r.id]: e.target.checked })}
                className="accent-[#D4A24E]"
              />
            </Row>
          ))}
          {Object.entries(attrsByCategory).map(([cat, attrs]) => (
            <div key={cat}>
              <div className="text-[11px] text-[#D4A24E] uppercase tracking-wider mb-2">{cat}</div>
              <div className="flex flex-col gap-2.5">
                {attrs.map((a) => (
                  <Row key={a.id} label={a.name}>
                    {a.valueType === "text" && <input value={getAttrValue(a.id)} onChange={(e) => setAttrValue(a.id, e.target.value)} className={inputCls} />}
                    {a.valueType === "number" && <input type="number" value={getAttrValue(a.id)} onChange={(e) => setAttrValue(a.id, e.target.value)} className={inputCls} />}
                    {a.valueType === "boolean" && <input type="checkbox" checked={!!getAttrValue(a.id)} onChange={(e) => setAttrValue(a.id, e.target.checked)} className="accent-[#D4A24E]" />}
                    {a.valueType === "scale" && <input type="number" min={0} max={10} value={getAttrValue(a.id)} onChange={(e) => setAttrValue(a.id, e.target.value)} className={`${inputCls} !w-20`} />}
                    {a.valueType === "select" && (
                      <select value={getAttrValue(a.id)} onChange={(e) => setAttrValue(a.id, e.target.value)} className={inputCls}>
                        <option value="">Select...</option>
                        {(a.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                  </Row>
                ))}
              </div>
            </div>
          ))}

          {/* ── Compliance ── */}
          <div>
            <button onClick={() => setChecked(true)} className={`${pillCls} bg-[#1A2029] text-[#D4A24E] border border-[#8A6A38] w-full`}>
              <ShieldCheck size={14} className="inline mr-1.5 relative -top-px" /> Check compliance
            </button>
            {checked && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {evalResults.length === 0 && <div className="text-xs text-[#5B6478]">No applicable rules yet.</div>}
                {evalResults.map((r, i) => (
                  <div key={i} className="flex justify-between items-center text-xs px-2.5 py-1.5 bg-[#1A2029] rounded-lg">
                    <span className="text-[#8891A3]">{r.rule.name}</span>
                    <span className={`font-bold flex items-center gap-1 ${r.pass ? "text-[#38D9A0]" : "text-[#F1685E]"}`}>
                      {r.pass ? <Check size={13} /> : <AlertTriangle size={13} />} {r.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Lifetime Stats ── */}
          <SectionTitle>Account Stats (all trades)</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Win Rate" value={`${winRate.toFixed(0)}%`} />
            <StatCard label="Profit Factor" value={profitFactor.toFixed(2)} />
            <StatCard label="Avg Win" value={fmt$(avgWin)} tone="green" />
            <StatCard label="Avg Loss" value={fmt$(avgLoss)} tone="red" />
            <StatCard label="Expectancy" value={fmt$(expectancy)} tone={expectancy >= 0 ? "green" : "red"} />
            <StatCard label="Total Closed" value={closedTrades.length.toString()} />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#232B38] flex gap-2.5">
          <button onClick={submit} className={`${pillCls} bg-[#D4A24E] text-[#1A1206] flex-1 font-bold`}>Save</button>
          <button onClick={onClose} className={`${pillCls} bg-transparent border border-[#232B38] text-[#8891A3]`}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-[#8891A3]">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-[#5B6478] uppercase tracking-widest font-bold border-b border-[#232B38] pb-1 mt-2">
      {children}
    </div>
  );
}

function StatCard({ label, value, tone = "text" }: { label: string; value: string; tone?: "text" | "green" | "red" }) {
  const color = tone === "green" ? "text-[#38D9A0]" : tone === "red" ? "text-[#F1685E]" : "text-[#E7EAEF]";
  return (
    <div className="bg-[#1A2029] border border-[#232B38] rounded-lg px-3 py-2">
      <div className="text-[10px] text-[#5B6478] uppercase">{label}</div>
      <div className={`font-mono text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}
