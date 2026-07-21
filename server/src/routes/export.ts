import { Router } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { stringify } from "csv-stringify/sync";

const router = Router();

// Export trades as CSV
router.get("/trades/csv", async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    const prisma = req.prisma;

    const where: any = { account: { userId: req.userId } };
    if (accountId) where.accountId = accountId;

    const trades = await prisma.trade.findMany({
      where,
      include: { attributeValues: { include: { attribute: true } } },
      orderBy: { entryTime: "desc" },
    });

    const records = trades.map((t: any) => {
      const row: Record<string, any> = {
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        qty: t.qty,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        entryTime: t.entryTime.toISOString(),
        exitTime: t.exitTime?.toISOString() || "",
        status: t.status,
        fee: t.fee,
        notes: t.notes || "",
      };
      t.attributeValues.forEach((av: any) => {
        row[av.attribute.name] = typeof av.value === "string" ? av.value : JSON.stringify(av.value);
      });
      return row;
    });

    const csv = stringify(records, { header: true });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=trades.csv");
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Failed to export trades" });
  }
});

// Export trades as JSON
router.get("/trades/json", async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    const prisma = req.prisma;

    const where: any = { account: { userId: req.userId } };
    if (accountId) where.accountId = accountId;

    const trades = await prisma.trade.findMany({
      where,
      include: { attributeValues: { include: { attribute: true } } },
      orderBy: { entryTime: "desc" },
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=trades.json");
    res.json(trades);
  } catch {
    res.status(500).json({ error: "Failed to export trades" });
  }
});

// Export everything as JSON (full backup)
router.get("/backup", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.userId;

    const [trades, accounts, rules, attributes, journals, settings] = await Promise.all([
      prisma.trade.findMany({ where: { account: { userId } }, include: { attributeValues: true } }),
      prisma.tradingAccount.findMany({ where: { userId } }),
      prisma.rule.findMany({ where: { account: { userId } } }),
      prisma.attributeDefinition.findMany({ where: { userId } }),
      prisma.journalEntry.findMany({ where: { userId } }),
      prisma.userSetting.findUnique({ where: { userId } }),
    ]);

    const backup = { version: 1, exportedAt: new Date().toISOString(), trades, accounts, rules, attributes, journals, settings };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=legion-terminal-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.json(backup);
  } catch {
    res.status(500).json({ error: "Failed to create backup" });
  }
});

// Import from JSON backup
router.post("/import", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.userId!;
    const { trades, accounts, rules, attributes, journals } = req.body;

    // Import accounts first
    let accountMap: Record<string, string> = {};
    if (accounts?.length) {
      for (const acc of accounts) {
        const created = await prisma.tradingAccount.create({
          data: { userId, name: acc.name, type: acc.type, balance: acc.balance },
        });
        accountMap[acc.id] = created.id;
      }
    }

    // Import trades
    if (trades?.length) {
      for (const t of trades) {
        const newAccountId = accountMap[t.accountId];
        if (!newAccountId) continue;
        await prisma.trade.create({
          data: {
            accountId: newAccountId,
            symbol: t.symbol,
            direction: t.direction,
            qty: t.qty,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            entryTime: new Date(t.entryTime),
            exitTime: t.exitTime ? new Date(t.exitTime) : null,
            status: t.status,
            fee: t.fee || 0,
            notes: t.notes,
            movedToBreakeven: t.movedToBreakeven || false,
            customChecks: t.customChecks || {},
          },
        });
      }
    }

    res.json({ message: "Import completed", imported: { trades: trades?.length || 0, accounts: accounts?.length || 0 } });
  } catch (err: any) {
    console.error("Import error:", err);
    res.status(500).json({ error: "Failed to import data" });
  }
});

export { router as exportRouter };
