import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import morgan from "morgan";
import type { PrismaClient } from "@prisma/client";
import rateLimiter from "./middleware/rateLimiter";
import errorHandler from "./middleware/errorHandler";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import skillRoutes from "./routes/skills";
import bookingRoutes from "./routes/bookings";
import adminRoutes from "./routes/admin";

export default function createApp(prisma: PrismaClient) {
  const app = express();

  app.locals.prisma = prisma;

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
  );
  app.use(express.json({ limit: "50kb" }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(rateLimiter({ windowMs: 60_000, maxRequests: 200 }));

  app.use("/api/auth", authRoutes(prisma));
  app.use("/api/users", userRoutes(prisma));
  app.use("/api/skills", skillRoutes(prisma));
  app.use("/api/bookings", bookingRoutes(prisma));
  app.use("/api/admin", adminRoutes(prisma));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      env: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
    });
  });

  app.use(errorHandler);

  return app;
}