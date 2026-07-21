import { Router } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

const journalSchema = z.object({
  tradeId: z.string().nullable().optional(),
  date: z.string().optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  mood: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

function parseJson(str: string | null | undefined, fallback: any = {}) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// List journal entries
router.get("/", async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    const prisma = req.prisma;

    const where: any = { userId: req.userId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      include: { trade: true },
      orderBy: { date: "desc" },
    });

    res.json({ entries: entries.map((e: any) => ({ ...e, tags: parseJson(e.tags, []) })) });
  } catch {
    res.status(500).json({ error: "Failed to fetch journal entries" });
  }
});

// Create journal entry
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = journalSchema.parse(req.body);
    const prisma = req.prisma;

    const entry = await prisma.journalEntry.create({
      data: {
        userId: req.userId!,
        title: data.title,
        content: data.content,
        mood: data.mood,
        tradeId: data.tradeId || null,
        date: data.date ? new Date(data.date) : new Date(),
        tags: JSON.stringify(data.tags),
      },
    });

    res.status(201).json({ entry: { ...entry, tags: parseJson(entry.tags, []) } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to create journal entry" });
  }
});

// Update journal entry
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const data = journalSchema.partial().parse(req.body);
    const prisma = req.prisma;

    const existing = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }

    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    if (data.tags) updateData.tags = JSON.stringify(data.tags);

    const entry = await prisma.journalEntry.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ entry: { ...entry, tags: parseJson(entry.tags, []) } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to update journal entry" });
  }
});

// Delete journal entry
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const existing = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }

    await prisma.journalEntry.delete({ where: { id: req.params.id } });
    res.json({ message: "Journal entry deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete journal entry" });
  }
});

export { router as journalsRouter };
