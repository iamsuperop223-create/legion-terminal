import { Router } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

const ruleSchema = z.object({
  accountId: z.string(),
  name: z.string().min(1),
  type: z.enum(["maxContracts", "stopRange", "dailyLossLimit", "breakeven", "custom"]),
  params: z.record(z.any()).default({}),
  active: z.boolean().default(true),
});

function parseJson(str: string | null | undefined, fallback: any = {}) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// List rules for an account
router.get("/", async (req: AuthRequest, res) => {
  try {
    const { accountId } = req.query;
    const prisma = req.prisma;

    const where: any = { account: { userId: req.userId } };
    if (accountId) where.accountId = accountId;

    const rules = await prisma.rule.findMany({ where, orderBy: { id: "asc" } });
    res.json({ rules: rules.map((r: any) => ({ ...r, params: parseJson(r.params, {}) })) });
  } catch {
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

// Create rule
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = ruleSchema.parse(req.body);
    const prisma = req.prisma;

    const rule = await prisma.rule.create({
      data: { ...data, params: JSON.stringify(data.params) },
    });
    res.status(201).json({ rule: { ...rule, params: parseJson(rule.params, {}) } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to create rule" });
  }
});

// Update rule
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const data = ruleSchema.partial().parse(req.body);
    const prisma = req.prisma;

    const existing = await prisma.rule.findFirst({
      where: { id: req.params.id, account: { userId: req.userId } },
    });
    if (!existing) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    const updateData: any = { ...data };
    if (data.params) updateData.params = JSON.stringify(data.params);

    const rule = await prisma.rule.update({ where: { id: req.params.id }, data: updateData });
    res.json({ rule: { ...rule, params: parseJson(rule.params, {}) } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to update rule" });
  }
});

// Delete rule
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const existing = await prisma.rule.findFirst({
      where: { id: req.params.id, account: { userId: req.userId } },
    });
    if (!existing) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    await prisma.rule.delete({ where: { id: req.params.id } });
    res.json({ message: "Rule deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

export { router as rulesRouter };
