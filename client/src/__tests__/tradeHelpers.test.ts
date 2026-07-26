import { describe, it, expect } from "vitest";
import { tradePnl } from "@/lib/tradeHelpers";
import { evaluateTradeRules } from "@/lib/tradeHelpers";
import { computeDailyCompliance } from "@/lib/tradeHelpers";

function makeTrade(overrides: Record<string, any> = {}) {
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
    stopTicks: null,
    takeProfitTicks: null,
    result: "win",
    pnlPoints: null,
    exitLegs: null,
    entryLegs: null,
    grade: null,
    attributeValues: [],
    ...overrides,
  };
}

function makeRule(overrides: Record<string, any> = {}) {
  return {
    id: "rule-1",
    accountId: "acc-1",
    name: "Test Rule",
    type: "custom",
    params: {},
    active: true,
    ...overrides,
  };
}

describe("tradePnl (tradeHelpers.ts) — mirror tests", () => {
  it("basic long NQ winner", () => {
    const t = makeTrade({ direction: "long", entryPrice: 20000, exitPrice: 20050 });
    expect(tradePnl(t)).toBe(1000);
  });

  it("short MNQ winner", () => {
    const t = makeTrade({ symbol: "MNQ", direction: "short", entryPrice: 20000, exitPrice: 19950 });
    expect(tradePnl(t)).toBe(100);
  });

  it("pnlPoints override", () => {
    const t = makeTrade({ entryPrice: 20000, exitPrice: 20100, pnlPoints: 42.5 });
    expect(tradePnl(t)).toBe(42.5);
  });

  it("exitLegs with fee", () => {
    const t = makeTrade({
      entryPrice: 20000,
      exitPrice: null,
      exitLegs: [{ price: 20050, qty: 2 }],
      qty: 2,
      fee: 50,
    });
    // (20050-20000)*2*20 - 50 = 1950
    expect(tradePnl(t)).toBe(1950);
  });

  it("weighted entry from entryLegs", () => {
    const t = makeTrade({
      entryPrice: 20000,
      exitPrice: 20060,
      entryLegs: [
        { price: 20000, qty: 1 },
        { price: 20040, qty: 1 },
      ],
      qty: 2,
    });
    // weighted entry = 20020, (20060-20020)*1*2*20 = 1600
    expect(tradePnl(t)).toBe(1600);
  });

  it("open trade returns 0", () => {
    const t = makeTrade({ status: "open", exitPrice: null });
    expect(tradePnl(t)).toBe(0);
  });

  it("unknown symbol defaults multiplier=1", () => {
    const t = makeTrade({ symbol: "TSLA", entryPrice: 100, exitPrice: 110 });
    expect(tradePnl(t)).toBe(10);
  });
});

describe("evaluateTradeRules", () => {
  it("maxContracts: passes within limit", () => {
    const trade = makeTrade({ qty: 2 });
    const rules = [makeRule({ type: "maxContracts", params: { maxQty: 4 } })];
    const results = evaluateTradeRules(trade, rules);
    expect(results.length).toBe(1);
    expect(results[0].pass).toBe(true);
  });

  it("maxContracts: fails over limit", () => {
    const trade = makeTrade({ qty: 5 });
    const rules = [makeRule({ type: "maxContracts", params: { maxQty: 3 } })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(false);
  });

  it("stopRange: within range", () => {
    const trade = makeTrade({ stopTicks: 48 });
    const rules = [makeRule({ type: "stopRange", params: { minTicks: 45, maxTicks: 50 } })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(true);
  });

  it("stopRange: outside range", () => {
    const trade = makeTrade({ stopTicks: 30 });
    const rules = [makeRule({ type: "stopRange", params: { minTicks: 45, maxTicks: 50 } })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(false);
  });

  it("breakeven: passed", () => {
    const trade = makeTrade({ movedToBreakeven: true });
    const rules = [makeRule({ type: "breakeven" })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(true);
  });

  it("breakeven: failed", () => {
    const trade = makeTrade({ movedToBreakeven: false });
    const rules = [makeRule({ type: "breakeven" })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(false);
  });

  it("custom rule: marked", () => {
    const trade = makeTrade({ customChecks: { "rule-1": true } });
    const rules = [makeRule({ id: "rule-1", type: "custom" })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(true);
  });

  it("custom rule: not marked", () => {
    const trade = makeTrade({ customChecks: {} });
    const rules = [makeRule({ id: "rule-1", type: "custom" })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(false);
  });

  it("skips inactive rules", () => {
    const trade = makeTrade();
    const rules = [makeRule({ active: false })];
    const results = evaluateTradeRules(trade, rules);
    expect(results.length).toBe(0);
  });

  it("breakevenAtR: passes at sufficient R", () => {
    const trade = makeTrade({
      movedToBreakeven: true,
      stopTicks: 10,
      entryPrice: 20000,
      exitPrice: 20050,
    });
    // riskDollars = 10 * 20 * 0.25 = 50
    // pnl = (20050-20000)*1*20 = 1000
    // R = 1000/50 = 20R > 1.5R
    const rules = [makeRule({ type: "breakevenAtR", params: { minR: 1.5 } })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(true);
  });

  it("scaleOut: validates first leg percentage", () => {
    const trade = makeTrade({
      qty: 4,
      exitLegs: [
        { price: 20050, qty: 2 },
        { price: 20100, qty: 2 },
      ],
    });
    const rules = [makeRule({ type: "scaleOut", params: { minPercent: 30, maxPercent: 50 } })];
    const results = evaluateTradeRules(trade, rules);
    // 2/4 = 50% → within 30-50%
    expect(results[0].pass).toBe(true);
  });

  it("scaleOut: fails if no multi-leg exit", () => {
    const trade = makeTrade({ exitLegs: [{ price: 20050, qty: 1 }] });
    const rules = [makeRule({ type: "scaleOut", params: { minPercent: 30, maxPercent: 50 } })];
    const results = evaluateTradeRules(trade, rules);
    expect(results[0].pass).toBe(false);
  });

  it("lossStreakThrottle: passes when streak below threshold", () => {
    const allTrades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T09:30", pnlPoints: -100 }),
      makeTrade({ id: "t2", exitTime: "2026-07-24T10:00", pnlPoints: 50 }),
      makeTrade({ id: "t3", exitTime: "2026-07-24T10:30", pnlPoints: -100 }),
      makeTrade({ id: "t4", exitTime: "2026-07-24T11:00", pnlPoints: -100 }),
    ];
    const trade = allTrades[3]; // current trade, 2 consecutive losses before it
    const rules = [makeRule({ type: "lossStreakThrottle", params: { threshold: 3 } })];
    const results = evaluateTradeRules(trade, rules, allTrades);
    // streak at t4: t3 loss, t2 win → streak=1 < 3 → pass
    expect(results[0].pass).toBe(true);
  });

  it("lossStreakThrottle: fails when streak hits threshold", () => {
    const allTrades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T09:00", pnlPoints: 100 }),
      makeTrade({ id: "t2", exitTime: "2026-07-24T09:30", pnlPoints: -100 }),
      makeTrade({ id: "t3", exitTime: "2026-07-24T10:00", pnlPoints: -100 }),
      makeTrade({ id: "t4", exitTime: "2026-07-24T10:30", pnlPoints: -100 }),
    ];
    const trade = allTrades[3]; // 3rd consecutive loss
    const rules = [makeRule({ type: "lossStreakThrottle", params: { threshold: 3 } })];
    const results = evaluateTradeRules(trade, rules, allTrades);
    expect(results[0].pass).toBe(false);
    expect(results[0].detail).toContain("3 consecutive losses");
  });
});

describe("computeDailyCompliance", () => {
  it("passes when within daily loss limit", () => {
    const trades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T10:00", pnlPoints: -100 }),
      makeTrade({ id: "t2", exitTime: "2026-07-24T10:30", pnlPoints: 50 }),
    ];
    const rules = [makeRule({ type: "dailyLossLimit", params: { amount: 300 } })];
    const result = computeDailyCompliance(trades, rules);
    const day = result["2026-07-24"];
    expect(day).toBeDefined();
    expect(day.pnl).toBe(-50);
    expect(day.ruleResults[0].pass).toBe(true);
  });

  it("fails when daily loss limit breached", () => {
    const trades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T10:00", pnlPoints: -200 }),
      makeTrade({ id: "t2", exitTime: "2026-07-24T10:30", pnlPoints: -150 }),
    ];
    const rules = [makeRule({ type: "dailyLossLimit", params: { amount: 300 } })];
    const result = computeDailyCompliance(trades, rules);
    const day = result["2026-07-24"];
    expect(day.pnl).toBe(-350);
    expect(day.ruleResults[0].pass).toBe(false);
  });

  it("maxTradesPerDay: passes within limit", () => {
    const trades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T10:00" }),
      makeTrade({ id: "t2", exitTime: "2026-07-24T10:30" }),
    ];
    const rules = [makeRule({ type: "maxTradesPerDay", params: { maxTrades: 3 } })];
    const result = computeDailyCompliance(trades, rules);
    expect(result["2026-07-24"].ruleResults[0].pass).toBe(true);
  });

  it("maxTradesPerDay: fails over limit", () => {
    const trades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T10:00" }),
      makeTrade({ id: "t2", exitTime: "2026-07-24T10:30" }),
      makeTrade({ id: "t3", exitTime: "2026-07-24T11:00" }),
      makeTrade({ id: "t4", exitTime: "2026-07-24T11:30" }),
    ];
    const rules = [makeRule({ type: "maxTradesPerDay", params: { maxTrades: 3 } })];
    const result = computeDailyCompliance(trades, rules);
    expect(result["2026-07-24"].ruleResults[0].pass).toBe(false);
  });

  it("groups trades by day correctly", () => {
    const trades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T10:00", pnlPoints: 100 }),
      makeTrade({ id: "t2", exitTime: "2026-07-25T10:00", pnlPoints: 200 }),
    ];
    const result = computeDailyCompliance(trades, []);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["2026-07-24"].pnl).toBe(100);
    expect(result["2026-07-25"].pnl).toBe(200);
  });

  it("ignores open trades", () => {
    const trades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T10:00", status: "closed", pnlPoints: 100 }),
      makeTrade({ id: "t2", exitTime: null, status: "open", entryTime: "2026-07-24T10:00" }),
    ];
    const result = computeDailyCompliance(trades, []);
    expect(result["2026-07-24"].tradeCount).toBe(1);
  });

  it("maxDailyProfit: flags trades after hitting target", () => {
    const trades = [
      makeTrade({ id: "t1", exitTime: "2026-07-24T10:00", pnlPoints: 300 }),
      makeTrade({ id: "t2", exitTime: "2026-07-24T10:30", pnlPoints: 300 }),
      makeTrade({ id: "t3", exitTime: "2026-07-24T11:00", pnlPoints: 50 }),
    ];
    const rules = [makeRule({ type: "maxDailyProfit", params: { amount: 500 } })];
    const result = computeDailyCompliance(trades, rules);
    const day = result["2026-07-24"];
    // After t1: cum=300, t2: cum=600 >= 500 → hit at idx 1, t3 is past target
    expect(day.ruleResults[0].pass).toBe(false);
  });
});
