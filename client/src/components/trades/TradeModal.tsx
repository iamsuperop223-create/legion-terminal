import { useState, useMemo, useRef } from "react";
import { useAppStore } from "@/stores/appStore";
import { X, ShieldCheck, Check, AlertTriangle, Upload, Lock } from "lucide-react";
import { SYMBOLS, uid } from "@/types";
import { evaluateTradeRules, tradePnl, fmt$, computeAutoAttributes } from "@/lib/tradeHelpers";
import { api, API_URL } from "@/lib/api";

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

  const normalizeDate = (d: string | null | undefined) => {
    if (!d) return "";
    try {
      const dt = new Date(d);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    } catch { return ""; }
  };

  const [t, setT] = useState(
    trade ? {
      ...trade,
      entryTime: normalizeDate(trade.entryTime),
      exitTime: normalizeDate(trade.exitTime),
    } : {
      id: uid(), symbol: "NQ", direction: "long", qty: 6, entryPrice: "", exitPrice: "",
      entryTime: (() => { const n = new Date(); const p = (x: number) => String(x).padStart(2, "0"); return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}`; })(), exitTime: "", status: "open",
      stopTicks: "", takeProfitTicks: "", fee: 0, notes: "", movedToBreakeven: false,
      customChecks: {}, attributeValues: [], result: "", pnlPoints: "", grade: "",
      analysis: "", exitNotes: "", screenshotUrl: "", exitLegs: null, entryLegs: null,
    }
  );
  const [checked, setChecked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (k: string, v: any) => setT((prev: any) => ({ ...prev, [k]: v }));
  const customRules = rules.filter((r) => r.type === "custom" && r.active);
  const evalResults = useMemo(() => evaluateTradeRules(t, rules), [t, rules]);
  const autoAttrs = useMemo(() => computeAutoAttributes(t, trades), [t, trades]);

  // Auto-calculate R:R
  const rr = useMemo(() => {
    const sl = Number(t.stopTicks);
    const tp = Number(t.takeProfitTicks);
    if (sl > 0 && tp > 0) return (tp / sl).toFixed(1);
    return "—";
  }, [t.stopTicks, t.takeProfitTicks]);

  const calcEntryPrice = useMemo(() => {
    return (t.entryLegs && t.entryLegs.length > 0) ? (() => {
      let totalCost = 0, totalQty = 0;
      for (const leg of t.entryLegs) { totalCost += leg.price * leg.qty; totalQty += leg.qty; }
      return totalQty > 0 ? totalCost / totalQty : t.entryPrice;
    })() : t.entryPrice;
  }, [t.entryLegs, t.entryPrice]);

  // Auto-calculate result when closed
  const autoResult = useMemo(() => {
    if (t.status !== "closed") return null;
    const legs = t.exitLegs;
    if (legs && legs.length > 0 && calcEntryPrice != null) {
      const sym = SYMBOLS[t.symbol] || { multiplier: 1 };
      const dir = t.direction === "long" ? 1 : -1;
      let total = 0;
      for (const leg of legs) {
        total += (leg.price - calcEntryPrice) * dir * leg.qty * sym.multiplier;
      }
      if (total > 0) return "win";
      if (total < 0) return "loss";
      return "breakeven";
    }
    if (t.exitPrice == null || calcEntryPrice == null) return null;
    const pnl = tradePnl(t);
    if (pnl > 0) return "win";
    if (pnl < 0) return "loss";
    return "breakeven";
  }, [t.status, t.exitPrice, calcEntryPrice, t, t.exitLegs]);

  const displayResult = t.result || autoResult || "";

  // Gross PnL from raw prices (no fee) — the "auto-calculated" value
  const grossPnlPoints = useMemo(() => {
    const legs = t.exitLegs;
    if (legs && legs.length > 0 && calcEntryPrice != null) {
      const sym = SYMBOLS[t.symbol] || { multiplier: 1 };
      const dir = t.direction === "long" ? 1 : -1;
      let total = 0;
      for (const leg of legs) {
        total += (leg.price - calcEntryPrice) * dir * leg.qty * sym.multiplier;
      }
      return total;
    }
    if (t.status === "closed" && t.exitPrice != null && calcEntryPrice != null) {
      const sym = SYMBOLS[t.symbol] || { multiplier: 1 };
      const dir = t.direction === "long" ? 1 : -1;
      return (t.exitPrice - calcEntryPrice) * dir * t.qty * sym.multiplier;
    }
    return null;
  }, [t.exitLegs, t.status, t.exitPrice, calcEntryPrice, t.direction, t.qty, t.symbol]);

  // Net PnL shown in the field = user override or gross - fee
  const displayPnlPoints = useMemo(() => {
    if (t.pnlPoints != null) return t.pnlPoints;
    if (grossPnlPoints != null) return (grossPnlPoints - (Number(t.fee) || 0)).toFixed(2);
    return "";
  }, [t.pnlPoints, grossPnlPoints, t.fee]);

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

  const getRawScreenshots = (): string[] => {
    if (!t.screenshotUrl) return [];
    try { const urls = JSON.parse(t.screenshotUrl); return Array.isArray(urls) ? urls : [t.screenshotUrl]; } catch { return [t.screenshotUrl]; }
  };

  const resolveScreenshotUrl = (u: string) => {
    if (u.startsWith("http") || u.startsWith("data:")) return u;
    return `${API_URL}${u}`;
  };

  const getScreenshots = (): string[] => getRawScreenshots().map(resolveScreenshotUrl);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("screenshots", files[i]);
      }
      const token = api.getToken();
      const res = await fetch(`${API_URL}/api/trades/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.urls) {
        const existing = getRawScreenshots();
        update("screenshotUrl", JSON.stringify([...existing, ...data.urls]));
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const removeScreenshot = (idx: number) => {
    const updated = getRawScreenshots().filter((_, i) => i !== idx);
    update("screenshotUrl", updated.length ? JSON.stringify(updated) : null);
  };

  const toISOStringLocal = (v: string | null | undefined): string | null => {
    if (!v) return null;
    const parts = v.split("T");
    if (parts.length !== 2) return null;
    const [y, mo, d] = parts[0].split("-").map(Number);
    const [h, mi] = parts[1].split(":").map(Number);
    const dt = new Date(y, mo - 1, d, h, mi);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const submit = async () => {
    const cleaned: any = {
      accountId: activeAccountId,
      symbol: t.symbol,
      direction: t.direction,
      qty: Number(t.qty) || 0,
      entryPrice: t.entryPrice === "" ? null : Number(t.entryPrice),
      exitPrice: t.exitPrice === "" || t.exitPrice == null ? null : Number(t.exitPrice),
      entryTime: toISOStringLocal(t.entryTime),
      exitTime: toISOStringLocal(t.exitTime),
      status: t.status,
      fee: Number(t.fee) || 0,
      notes: t.notes || "",
      movedToBreakeven: t.movedToBreakeven || false,
      customChecks: t.customChecks || {},
      stopTicks: t.stopTicks === "" || t.stopTicks == null ? null : Number(t.stopTicks),
      takeProfitTicks: t.takeProfitTicks === "" || t.takeProfitTicks == null ? null : Number(t.takeProfitTicks),
      result: t.result || autoResult || null,
      pnlPoints: displayPnlPoints ? Number(displayPnlPoints) : null,
      grade: t.grade || null,
      analysis: t.analysis || null,
      exitNotes: t.exitNotes || null,
      exitLegs: t.exitLegs && t.exitLegs.length > 0 ? JSON.stringify(t.exitLegs) : null,
      entryLegs: t.entryLegs && t.entryLegs.length > 0 ? JSON.stringify(t.entryLegs) : null,
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

          {/* ── Entry Legs (multi-fill entries) ── */}
          <SectionTitle>Entry Legs (optional — for multi-fill entries)</SectionTitle>
          <div className="text-[10px] text-[#5B6478] mb-2">Add multiple fills if you got filled at different prices. Weighted avg is used for PnL.</div>
          {(t.entryLegs || []).map((leg: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-[#8891A3] w-4">#{idx + 1}</span>
              <div className="flex-1 flex gap-2">
                <div className="flex-1">
                  <div className="text-[9px] text-[#5B6478] mb-0.5">Price</div>
                  <input type="number" value={leg.price} onChange={(e) => {
                    const legs = [...(t.entryLegs || [])];
                    legs[idx] = { ...legs[idx], price: Number(e.target.value) };
                    update("entryLegs", legs);
                  }} className={`${inputCls} !w-full`} />
                </div>
                <div className="w-16">
                  <div className="text-[9px] text-[#5B6478] mb-0.5">Qty</div>
                  <input type="number" value={leg.qty} onChange={(e) => {
                    const legs = [...(t.entryLegs || [])];
                    legs[idx] = { ...legs[idx], qty: Number(e.target.value) };
                    update("entryLegs", legs);
                  }} className={`${inputCls} !w-full`} />
                </div>
                <button onClick={() => {
                  const legs = (t.entryLegs || []).filter((_: any, i: number) => i !== idx);
                  update("entryLegs", legs.length > 0 ? legs : null);
                }} className="text-[#F1685E] hover:text-[#ff4444] mt-4 text-xs">✕</button>
              </div>
            </div>
          ))}
          {calcEntryPrice != null && calcEntryPrice !== t.entryPrice && (
            <div className="text-[10px] text-[#D4A24E] mb-2">Weighted avg: {calcEntryPrice.toFixed(2)}</div>
          )}
          <button onClick={() => {
            const legs = [...(t.entryLegs || []), { price: 0, qty: 0 }];
            update("entryLegs", legs);
          }} className={`${pillCls} bg-[#1A2029] text-[#38D9A0] border border-[#1E5844] w-full text-left`}>+ Add Entry Leg</button>

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

          {/* ── Exit Legs (partial fills) ── */}
          {t.status === "closed" && (
            <>
              <SectionTitle>Exit Legs (optional — for partial fills)</SectionTitle>
              <div className="text-[10px] text-[#5B6478] mb-2">Add multiple exits if you scaled out at different prices. Leave empty for single exit.</div>
              {(t.exitLegs || []).map((leg: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-[#8891A3] w-4">#{idx + 1}</span>
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1">
                      <div className="text-[9px] text-[#5B6478] mb-0.5">Price</div>
                      <input type="number" value={leg.price} onChange={(e) => {
                        const legs = [...(t.exitLegs || [])];
                        legs[idx] = { ...legs[idx], price: Number(e.target.value) };
                        update("exitLegs", legs);
                      }} className={`${inputCls} !w-full`} />
                    </div>
                    <div className="w-16">
                      <div className="text-[9px] text-[#5B6478] mb-0.5">Qty</div>
                      <input type="number" value={leg.qty} onChange={(e) => {
                        const legs = [...(t.exitLegs || [])];
                        legs[idx] = { ...legs[idx], qty: Number(e.target.value) };
                        update("exitLegs", legs);
                      }} className={`${inputCls} !w-full`} />
                    </div>
                    <button onClick={() => {
                      const legs = (t.exitLegs || []).filter((_: any, i: number) => i !== idx);
                      update("exitLegs", legs.length > 0 ? legs : null);
                    }} className="text-[#F1685E] hover:text-[#ff4444] mt-4 text-xs">✕</button>
                  </div>
                </div>
              ))}
              <button onClick={() => {
                const legs = [...(t.exitLegs || []), { price: 0, qty: 0 }];
                update("exitLegs", legs);
              }} className={`${pillCls} bg-[#1A2029] text-[#38D9A0] border border-[#1E5844] w-full text-left`}>+ Add Exit Leg</button>
            </>
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
              <Row label="PnL — broker">
                <div className="flex flex-col items-end">
                  {grossPnlPoints != null && (
                    <div className="text-[9px] text-[#5B6478] mb-0.5">
                      auto: {grossPnlPoints >= 0 ? "+" : ""}{grossPnlPoints.toFixed(2)} (gross)
                    </div>
                  )}
                  <input
                    type="number"
                    value={displayPnlPoints}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      if (val != null && grossPnlPoints != null) {
                        const calculatedFee = Math.max(0, grossPnlPoints - val);
                        update("fee", Number(calculatedFee.toFixed(2)));
                        update("pnlPoints", val);
                      } else {
                        update("pnlPoints", val);
                      }
                    }}
                    className={inputCls}
                    placeholder="enter PnL from broker"
                  />
                </div>
              </Row>
              <Row label="Fee (auto)">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#5B6478]">$</span>
                  <input
                    type="number"
                    value={t.fee || ""}
                    onChange={(e) => {
                      const fee = Number(e.target.value) || 0;
                      update("fee", fee);
                      // Recalculate pnlPoints from gross - fee
                      if (grossPnlPoints != null) {
                        update("pnlPoints", Number((grossPnlPoints - fee).toFixed(2)));
                      }
                    }}
                    className={`${inputCls} !w-[120px]`}
                    placeholder="0"
                  />
                </div>
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
          <SectionTitle>Screenshots</SectionTitle>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`${pillCls} bg-[#1A2029] text-[#D4A24E] border border-[#8A6A38] flex items-center gap-2`}
            >
              <Upload size={14} /> {uploading ? "Uploading..." : "Add Screenshot(s)"}
            </button>
          </div>
          {getScreenshots().length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {getScreenshots().map((url, idx) => (
                <div key={idx} className="relative group border border-[#232B38] rounded-lg overflow-hidden cursor-pointer" onClick={() => setLightboxUrl(url)}>
                  <img src={url} alt={`Screenshot ${idx + 1}`} className="w-full h-32 object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeScreenshot(idx); }}
                    className="absolute top-1 right-1 bg-[#5C2A28] text-[#F1685E] text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

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

          {/* ── Auto-Tracked Attributes ── */}
          {autoAttrs.length > 0 && (
            <div>
              <div className="text-[11px] text-[#D4A24E] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lock size={10} /> Auto-Tracked
              </div>
              <div className="grid grid-cols-2 gap-2">
                {autoAttrs.map((a) => (
                  <div key={a.id} className="bg-[#1A2029] border border-[#232B38] rounded-lg px-3 py-2">
                    <div className="text-[10px] text-[#5B6478] uppercase tracking-wider">{a.label}</div>
                    <div className="text-sm font-mono font-semibold text-[#E7EAEF] mt-0.5">{a.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-[#E7EAEF] hover:text-white transition">
            <X size={32} />
          </button>
          <img src={lightboxUrl} alt="Screenshot" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
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
