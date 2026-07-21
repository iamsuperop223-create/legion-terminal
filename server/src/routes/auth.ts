import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { AuthRequest, generateToken } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
router.post("/register", async (req: AuthRequest, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const prisma = req.prisma;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, provider: "local" },
    });

    // Create default trading account
    await prisma.tradingAccount.create({
      data: { userId: user.id, name: "Main Account", type: "sim", balance: 10000 },
    });

    // Create default settings
    await prisma.userSetting.create({
      data: { userId: user.id },
    });

    const token = generateToken(user.id);
    res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
router.post("/login", async (req: AuthRequest, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const prisma = req.prisma;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken(user.id);
    res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Login failed" });
  }
});

// Forgot password
router.post("/forgot-password", async (req: AuthRequest, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const prisma = req.prisma;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      res.json({ message: "If an account exists, a reset link has been sent" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    // In production, send email with reset link
    // For now, log it
    console.log(`Password reset token for ${email}: ${token}`);

    res.json({ message: "If an account exists, a reset link has been sent" });
  } catch {
    res.status(500).json({ error: "Failed to process request" });
  }
});

// Reset password
router.post("/reset-password", async (req: AuthRequest, res) => {
  try {
    const { token, password } = z.object({ token: z.string(), password: z.string().min(8) }).parse(req.body);
    const prisma = req.prisma;

    const reset = await prisma.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.used || reset.expiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired token" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } });

    res.json({ message: "Password reset successful" });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// Get current user
router.get("/me", async (req: AuthRequest, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const jwt = await import("jsonwebtoken");
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const prisma = req.prisma;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Logout
router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

export { router as authRouter };
