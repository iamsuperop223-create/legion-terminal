import { PrismaClient } from "@prisma/client";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";
import { authRouter } from "./routes/auth.js";
import { tradesRouter } from "./routes/trades.js";
import { accountsRouter } from "./routes/accounts.js";
import { rulesRouter } from "./routes/rules.js";
import { attributesRouter } from "./routes/attributes.js";
import { journalsRouter } from "./routes/journals.js";
import { exportRouter } from "./routes/export.js";
import { settingsRouter } from "./routes/settings.js";
import { authMiddleware, AuthRequest } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);

// Socket.IO for real-time sync
export const io = new SocketServer(httpServer, {
  cors: { origin: process.env.APP_URL || "http://localhost:5173", credentials: true },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.APP_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(rateLimiter);

// Make prisma + io available to routes
app.use((req, _res, next) => {
  (req as any).prisma = prisma;
  (req as any).io = io;
  next();
});

// Serve uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// In production, serve client build
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
}

// Public routes
app.use("/api/auth", authRouter);

// Protected routes
app.use("/api/trades", authMiddleware, tradesRouter);
app.use("/api/accounts", authMiddleware, accountsRouter);
app.use("/api/rules", authMiddleware, rulesRouter);
app.use("/api/attributes", authMiddleware, attributesRouter);
app.use("/api/journals", authMiddleware, journalsRouter);
app.use("/api/export", authMiddleware, exportRouter);
app.use("/api/settings", authMiddleware, settingsRouter);

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// SPA fallback in production
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Socket.IO auth + rooms
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    (socket as any).userId = decoded.userId;
    socket.join(`user:${decoded.userId}`);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${(socket as any).userId}`);
  socket.on("disconnect", () => console.log(`Client disconnected: ${(socket as any).userId}`));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Legion Terminal API running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  httpServer.close();
});
