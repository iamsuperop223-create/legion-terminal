import { describe, it, expect } from "vitest";
import { tradePnl, Trade } from "@/types";

function makeTrade(overrides: Partial<Trade>): Trade {
  return {
    id: "test-1",
    accountId: "acc-1",
    symbol: "NQ",
    direction: "long",
    qty: 1,
    entryPrice: 20000,
    exitPrice: 20050,
    entryTime: "2026-07-24T10:00",
    exitTime: "2026-07-24T10:30",
    status: "closed",
    fee: 0,
    movedToBreakeven: false,
    customChecks: {},
    attributeValues: [],
    createdAt: "2026-07-24T10:00",
    updatedAt: "2026-07-24T10:30",
    ...overrides,
  } as Trade;
}

describe("tradePnl (types/index.ts)", () => {
  describe("basic long trade", () => {
    it("computes profit for a winning long NQ trade", () => {
      const t = makeTrade({ direction: "long", entryPrice: 20000, exitPrice: 20050, symbol: "NQ" });
      // (20050 - 20000) * 1 * 20 * 1 = 1000
      expect(tradePnl(t)).toBe(1000);
    });

    it("computes loss for a losing long NQ trade", () => {
      const t = makeTrade({ direction: "long", entryPrice: 20000, exitPrice: 19950, symbol: "NQ" });
      // (19950 - 20000) * 1 * 20 * 1 = -1000
      expect(tradePnl(t)).toBe(-1000);
    });
  });

  describe("basic short trade", () => {
    it("computes profit for a winning short NQ trade", () => {
      const t = makeTrade({ direction: "short", entryPrice: 20000, exitPrice: 19950, symbol: "NQ" });
      // (19950 - 20000) * (-1) * 1 * 20 = 1000
      expect(tradePnl(t)).toBe(1000);
    });

    it("computes loss for a losing short NQ trade", () => {
      const t = makeTrade({ direction: "short", entryPrice: 20000, exitPrice: 20050, symbol: "NQ" });
      expect(tradePnl(t)).toBe(-1000);
    });
  });

  describe("different symbols", () => {
    it("MNQ (multiplier=2)", () => {
      const t = makeTrade({ symbol: "MNQ", direction: "long", entryPrice: 20000, exitPrice: 20050 });
      // (20050 - 20000) * 1 * 2 = 100
      expect(tradePnl(t)).toBe(100);
    });

    it("ES (multiplier=50)", () => {
      const t = makeTrade({ symbol: "ES", direction: "long", entryPrice: 5500, exitPrice: 5510 });
      // (5510 - 5500) * 1 * 50 = 500
      expect(tradePnl(t)).toBe(500);
    });

    it("MES (multiplier=5)", () => {
      const t = makeTrade({ symbol: "MES", direction: "long", entryPrice: 5500, exitPrice: 5510 });
      // (5510 - 5500) * 1 * 5 = 50
      expect(tradePnl(t)).toBe(50);
    });
  });

  describe("fee deduction", () => {
    it("subtracts fee from computed PnL", () => {
      const t = makeTrade({ direction: "long", entryPrice: 20000, exitPrice: 20050, fee: 50 });
      expect(tradePnl(t)).toBe(950);
    });

    it("handles zero fee", () => {
      const t = makeTrade({ direction: "long", entryPrice: 20000, exitPrice: 20050, fee: 0 });
      expect(tradePnl(t)).toBe(1000);
    });
  });

  describe("pnlPoints override (manual broker PnL)", () => {
    it("returns pnlPoints directly when set (ignores raw prices)", () => {
      const t = makeTrade({
        direction: "long",
        entryPrice: 20000,
        exitPrice: 20050,
        pnlPoints: 750,
        fee: 50,
      });
      // pnlPoints = 750 → returned directly, NOT recalculated
      expect(tradePnl(t)).toBe(750);
    });

    it("pnlPoints = 0 is returned as 0", () => {
      const t = makeTrade({ pnlPoints: 0, entryPrice: 20000, exitPrice: 20050 });
      expect(tradePnl(t)).toBe(0);
    });

    it("pnlPoints = -300 returns -300 even when raw would be positive", () => {
      const t = makeTrade({
        direction: "long",
        entryPrice: 20000,
        exitPrice: 20100,
        pnlPoints: -300,
      });
      expect(tradePnl(t)).toBe(-300);
    });
  });

  describe("exitLegs (partial fills)", () => {
    it("computes PnL from multiple exit legs", () => {
      const t = makeTrade({
        direction: "long",
        entryPrice: 20000,
        exitPrice: null,
        exitLegs: [
          { price: 20050, qty: 1 },
          { price: 20100, qty: 1 },
        ],
        qty: 2,
      });
      // leg1: (20050-20000)*1*20 = 1000
      // leg2: (20100-20000)*1*20 = 2000
      // total = 3000
      expect(tradePnl(t)).toBe(3000);
    });

    it("exitLegs with fee", () => {
      const t = makeTrade({
        direction: "long",
        entryPrice: 20000,
        exitPrice: null,
        exitLegs: [{ price: 20050, qty: 1 }],
        qty: 1,
        fee: 25,
      });
      // (20050-20000)*1*20 - 25 = 975
      expect(tradePnl(t)).toBe(975);
    });

    it("exitLegs on short trade", () => {
      const t = makeTrade({
        direction: "short",
        entryPrice: 20000,
        exitPrice: null,
        exitLegs: [{ price: 19950, qty: 1 }],
        qty: 1,
      });
      // (19950-20000) * (-1) * 1 * 20 = 1000
      expect(tradePnl(t)).toBe(1000);
    });

    it("pnlPoints takes precedence over exitLegs", () => {
      const t = makeTrade({
        entryPrice: 20000,
        exitPrice: null,
        exitLegs: [{ price: 20050, qty: 1 }],
        pnlPoints: 500,
      });
      // pnlPoints set → returned directly
      expect(tradePnl(t)).toBe(500);
    });
  });

  describe("entryLegs (multi-fill entries)", () => {
    it("uses weighted average entry price from entryLegs", () => {
      const t = makeTrade({
        direction: "long",
        entryPrice: 20000,
        exitPrice: 20050,
        entryLegs: [
          { price: 20000, qty: 1 },
          { price: 20020, qty: 1 },
        ],
        qty: 2,
      });
      // weighted entry = (20000*1 + 20020*1) / 2 = 20010
      // (20050 - 20010) * 1 * 2 * 20 = 1600
      expect(tradePnl(t)).toBe(1600);
    });

    it("entryLegs with single leg", () => {
      const t = makeTrade({
        direction: "long",
        entryPrice: 20000,
        exitPrice: 20050,
        entryLegs: [{ price: 20000, qty: 2 }],
      });
      expect(tradePnl(t)).toBe(1000);
    });
  });

  describe("edge cases", () => {
    it("returns 0 for open trades", () => {
      const t = makeTrade({ status: "open", exitPrice: null, exitTime: null });
      expect(tradePnl(t)).toBe(0);
    });

    it("returns 0 when exitPrice is null and no exitLegs", () => {
      const t = makeTrade({ exitPrice: null, exitLegs: null, status: "closed" });
      expect(tradePnl(t)).toBe(0);
    });

    it("returns 0 when entryPrice is null and no entryLegs", () => {
      const t = makeTrade({ entryPrice: null, exitPrice: 20050, entryLegs: null });
      expect(tradePnl(t)).toBe(0);
    });

    it("handles undefined fee", () => {
      const t = makeTrade({ direction: "long", entryPrice: 20000, exitPrice: 20050, fee: undefined });
      expect(tradePnl(t)).toBe(1000);
    });

    it("breakeven result still computes actual PnL", () => {
      const t = makeTrade({ result: "breakeven", direction: "long", entryPrice: 20000, exitPrice: 20000 });
      // (20000-20000)*1*20 = 0
      expect(tradePnl(t)).toBe(0);
    });

    it("unknown symbol defaults to multiplier=1", () => {
      const t = makeTrade({ symbol: "BTC", direction: "long", entryPrice: 100, exitPrice: 110 });
      expect(tradePnl(t)).toBe(10);
    });
  });
});
