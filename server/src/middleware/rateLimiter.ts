import { Request, Response, NextFunction } from "express";
import { RateLimiterMemory } from "rate-limiter-flexible";

const limiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    await limiter.consume(key);
    next();
  } catch {
    res.status(429).json({ error: "Too many requests" });
  }
}
