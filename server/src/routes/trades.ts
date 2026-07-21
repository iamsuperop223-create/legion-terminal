import { Router } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

const router = Router();

const toNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().nullable());
const toInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().nullable());
const toDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.string().nullable().optional());

const tradeSchema = z.object({
  accountId: z.string(),
  symbol: z.string().default("NQ"),
  direction: z.enum(["long", "short"]).default("long"),
  qty: z.preprocess((v) => Number(v) || 1, z.number().int().positive()),
  entryPrice: toNum,
  exitPrice: toNum,
  entryTime: z.string(),
  exitTime: toDate,
  status: z.enum(["open", "closed"]).default("open"),
  fee: z.preprocess((v) => Number(v) || 0, z.number().default(0)),
  notes: z.string().default(""),
  movedToBreakeven: z.boolean().default(false),
  customChecks: z.preprocess((v) => (typeof v === "string" ? JSON.parse(v || "{}") : v || {}), z.record(z.boolean()).default({})),
  attributeValues: z.array(z.any()).optional(),
  stopTicks: toInt,
  takeProfitTicks: toInt,
  result: z.string().nullable().optional(),
  pnlPoints: toNum,
  grade: z.string().nullable().optional(),
  analysis: z.string().nullable().optional(),
  exitNotes: z.string().nullable().optional(),
  screenshotUrl: z.string().nullable().optional(),
});

function parseJson(str: string | null | undefined, fallback: any = {}) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function serializeTrade(t: any) {
  return { ...t, customChecks: parseJson(t.customChecks, {}), attributeValues: t.attributeValues || [] };
}

// List trades for an account
router.get("/", async (req: AuthRequest, res) => {
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

    res.json({ trades: trades.map(serializeTrade) });
  } catch {
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

// Upload screenshot (MUST be before /:id routes)
router.post("/upload", upload.single("screenshot"), (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// Get single trade
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, account: { userId: req.userId } },
      include: { attributeValues: { include: { attribute: true } } },
    });
    if (!trade) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }
    res.json({ trade: serializeTrade(trade) });
  } catch {
    res.status(500).json({ error: "Failed to fetch trade" });
  }
});

// Create trade
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = tradeSchema.parse(req.body);
    const prisma = req.prisma;

    const account = await prisma.tradingAccount.findFirst({
      where: { id: data.accountId, userId: req.userId },
    });
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const trade = await prisma.trade.create({
      data: {
        accountId: data.accountId,
        symbol: data.symbol,
        direction: data.direction,
        qty: data.qty,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice,
        entryTime: new Date(data.entryTime),
        exitTime: data.exitTime ? new Date(data.exitTime) : null,
        status: data.status,
        fee: data.fee,
        notes: data.notes,
        movedToBreakeven: data.movedToBreakeven,
        customChecks: JSON.stringify(data.customChecks || {}),
        stopTicks: data.stopTicks,
        takeProfitTicks: data.takeProfitTicks,
        result: data.result,
        pnlPoints: data.pnlPoints,
        grade: data.grade,
        analysis: data.analysis,
        exitNotes: data.exitNotes,
        screenshotUrl: data.screenshotUrl,
      },
      include: { attributeValues: true },
    });

    (req as any).io?.to(`user:${req.userId}`).emit("trade:created", serializeTrade(trade));

    res.status(201).json({ trade: serializeTrade(trade) });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to create trade" });
  }
});

// Update trade
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const data = tradeSchema.partial().parse(req.body);
    const prisma = req.prisma;

    const existing = await prisma.trade.findFirst({
      where: { id: req.params.id, account: { userId: req.userId } },
    });
    if (!existing) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }

    const updateData: any = { ...data };
    if (data.entryTime) updateData.entryTime = new Date(data.entryTime);
    if (data.exitTime) updateData.exitTime = new Date(data.exitTime);
    if (data.customChecks) updateData.customChecks = JSON.stringify(data.customChecks);
    delete updateData.attributeValues;

    const trade = await prisma.trade.update({
      where: { id: req.params.id },
      data: updateData,
      include: { attributeValues: { include: { attribute: true } } },
    });

    (req as any).io?.to(`user:${req.userId}`).emit("trade:updated", serializeTrade(trade));

    res.json({ trade: serializeTrade(trade) });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to update trade" });
  }
});

// Delete trade
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;

    const existing = await prisma.trade.findFirst({
      where: { id: req.params.id, account: { userId: req.userId } },
    });
    if (!existing) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }

    await prisma.trade.delete({ where: { id: req.params.id } });

    (req as any).io?.to(`user:${req.userId}`).emit("trade:deleted", { id: req.params.id });

    res.json({ message: "Trade deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete trade" });
  }
});

// Set attribute value on trade
router.post("/:id/attributes", async (req: AuthRequest, res) => {
  try {
    const { attributeDefinitionId, value } = z.object({
      attributeDefinitionId: z.string(),
      value: z.any(),
    }).parse(req.body);

    const prisma = req.prisma;

    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, account: { userId: req.userId } },
    });
    if (!trade) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }

    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    const attrValue = await prisma.attributeValue.upsert({
      where: {
        tradeId_attributeDefinitionId: {
          tradeId: req.params.id,
          attributeDefinitionId,
        },
      },
      update: { value: valueStr },
      create: { tradeId: req.params.id, attributeDefinitionId, value: valueStr },
    });

    res.json({ attributeValue: { ...attrValue, value: parseJson(attrValue.value) } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to set attribute value" });
  }
});

export { router as tradesRouter };
