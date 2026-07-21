import { Router } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

function parseJson(str: string | null | undefined, fallback: any = {}) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// Get settings
router.get("/", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    let settings = await prisma.userSetting.findUnique({ where: { userId: req.userId } });
    if (!settings) {
      settings = await prisma.userSetting.create({ data: { userId: req.userId! } });
    }
    res.json({ settings: { ...settings, layout: parseJson(settings.layout, {}) } });
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Update settings
router.put("/", async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      theme: z.string().optional(),
      layout: z.record(z.any()).optional(),
      timezone: z.string().optional(),
    }).parse(req.body);

    const prisma = req.prisma;
    const updateData: any = { ...data };
    if (data.layout) updateData.layout = JSON.stringify(data.layout);

    const settings = await prisma.userSetting.upsert({
      where: { userId: req.userId! },
      update: updateData,
      create: { userId: req.userId!, ...updateData },
    });

    res.json({ settings: { ...settings, layout: parseJson(settings.layout, {}) } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export { router as settingsRouter };
