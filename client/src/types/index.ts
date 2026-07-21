// ─── Core Types ──────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface TradingAccount {
  id: string;
  userId: string;
  name: string;
  type: "eval" | "funded" | "sim";
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  _count?: { trades: number };
}

export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  direction: "long" | "short";
  qty: number;
  entryPrice: number | null;
  exitPrice: number | null;
  entryTime: string;
  exitTime: string | null;
  status: "open" | "closed";
  fee: number;
  notes?: string;
  movedToBreakeven: boolean;
  customChecks: Record<string, boolean>;
  stopTicks?: number | null;
  takeProfitTicks?: number | null;
  result?: "win" | "loss" | "breakeven" | null;
  pnlPoints?: number | null;
  exitLegs?: { price: number; qty: number; time?: string }[] | null;
  grade?: "A+" | "A" | "B" | "C" | null;
  analysis?: string | null;
  exitNotes?: string | null;
  screenshotUrl?: string | null;
  attributeValues: AttributeValue[];
  createdAt: string;
  updatedAt: string;
}

export interface AttributeDefinition {
  id: string;
  userId: string;
  name: string;
  category: string;
  valueType: "text" | "number" | "boolean" | "select" | "scale";
  options?: string[];
  active: boolean;
  createdAt: string;
}

export interface AttributeValue {
  id: string;
  tradeId: string;
  attributeDefinitionId: string;
  value: any;
  attribute?: AttributeDefinition;
}

export interface Rule {
  id: string;
  accountId: string;
  name: string;
  type: "maxContracts" | "stopRange" | "dailyLossLimit" | "breakeven" | "custom";
  params: Record<string, any>;
  active: boolean;
}

export interface JournalEntry {
  id: string;
  userId: string;
  tradeId?: string;
  date: string;
  title: string;
  content?: string;
  mood?: string;
  tags: string[];
  trade?: Trade;
  createdAt: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  theme: string;
  layout: Record<string, any>;
  timezone: string;
}

// ─── Symbol Definitions ──────────────────────────────────────────────

export const SYMBOLS: Record<string, { label: string; multiplier: number; tick: number; tickValue: number }> = {
  NQ: { label: "NQ", multiplier: 20, tick: 0.25, tickValue: 5 },
  MNQ: { label: "MNQ", multiplier: 2, tick: 0.25, tickValue: 0.5 },
  ES: { label: "ES", multiplier: 50, tick: 0.25, tickValue: 12.5 },
  MES: { label: "MES", multiplier: 5, tick: 0.25, tickValue: 1.25 },
};

// ─── Helpers ─────────────────────────────────────────────────────────

export function tradePnl(t: Trade): number {
  if (t.status !== "closed") return 0;
  const sym = SYMBOLS[t.symbol] || { multiplier: 1 };
  const legs = t.exitLegs;
  if (legs && legs.length > 0 && t.entryPrice != null) {
    const dir = t.direction === "long" ? 1 : -1;
    let total = 0;
    for (const leg of legs) {
      total += (leg.price - t.entryPrice) * dir * leg.qty * sym.multiplier;
    }
    return total - (t.fee || 0);
  }
  if (t.pnlPoints != null) return t.pnlPoints - (t.fee || 0);
  if (t.exitPrice == null) return 0;
  const dir = t.direction === "long" ? 1 : -1;
  return (t.exitPrice - (t.entryPrice || 0)) * dir * t.qty * sym.multiplier - (t.fee || 0);
}

export function fmt$(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function dayKey(d: string): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
