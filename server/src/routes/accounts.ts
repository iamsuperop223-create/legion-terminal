import { Router } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

// List accounts
router.get("/", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const accounts = await prisma.tradingAccount.findMany({
      where: { userId: req.userId },
      include: { _count: { select: { trades: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ accounts });
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// Create account
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      type: z.enum(["eval", "funded", "sim"]).default("sim"),
      balance: z.number().positive().default(10000),
    }).parse(req.body);

    const prisma = req.prisma;
    const account = await prisma.tradingAccount.create({
      data: { ...data, userId: req.userId! },
    });

    res.status(201).json({ account });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Update account
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().optional(),
      type: z.enum(["eval", "funded", "sim"]).optional(),
      balance: z.number().positive().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const prisma = req.prisma;
    const existing = await prisma.tradingAccount.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const account = await prisma.tradingAccount.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ account });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to update account" });
  }
});

// Delete account
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const existing = await prisma.tradingAccount.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    await prisma.tradingAccount.delete({ where: { id: req.params.id } });
    res.json({ message: "Account deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export { router as accountsRouter };
