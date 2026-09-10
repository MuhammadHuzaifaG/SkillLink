import { Request, Response, NextFunction } from "express";

export default function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled error:", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
}