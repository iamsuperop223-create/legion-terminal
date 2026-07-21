import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  prisma?: any;
  io?: any;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET!;
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as any;
  return jwt.sign({ userId }, secret, { expiresIn });
}
