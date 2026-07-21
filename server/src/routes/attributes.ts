import { Router } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

const attrSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("order-flow"),
  valueType: z.enum(["text", "number", "boolean", "select", "scale"]).default("text"),
  options: z.array(z.string()).optional(),
  active: z.boolean().default(true),
});

function parseJson(str: string | null | undefined, fallback: any = {}) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// List attribute definitions
router.get("/", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const attributes = await prisma.attributeDefinition.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ attributes: attributes.map((a: any) => ({ ...a, options: parseJson(a.options, null) })) });
  } catch {
    res.status(500).json({ error: "Failed to fetch attributes" });
  }
});

// Create attribute definition
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = attrSchema.parse(req.body);
    const prisma = req.prisma;

    const attribute = await prisma.attributeDefinition.create({
      data: {
        name: data.name,
        category: data.category,
        valueType: data.valueType,
        active: data.active,
        userId: req.userId!,
        options: data.options ? JSON.stringify(data.options) : null,
      },
    });

    res.status(201).json({ attribute: { ...attribute, options: parseJson(attribute.options, null) } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to create attribute" });
  }
});

// Update attribute definition
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const data = attrSchema.partial().parse(req.body);
    const prisma = req.prisma;

    const existing = await prisma.attributeDefinition.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Attribute not found" });
      return;
    }

    const updateData: any = { ...data };
    if (data.options) updateData.options = JSON.stringify(data.options);

    const attribute = await prisma.attributeDefinition.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ attribute: { ...attribute, options: parseJson(attribute.options, null) } });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to update attribute" });
  }
});

// Delete attribute definition
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const prisma = req.prisma;
    const existing = await prisma.attributeDefinition.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Attribute not found" });
      return;
    }

    await prisma.attributeDefinition.delete({ where: { id: req.params.id } });
    res.json({ message: "Attribute deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete attribute" });
  }
});

export { router as attributesRouter };
