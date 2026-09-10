import { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory rate limiter for demo/hackathon.
 * Not suitable for multi-instance production — replace with Redis-backed limiter there.
 */
type Options = {
  windowMs?: number;
  maxRequests?: number;
};

export default function rateLimiter(options: Options = {}) {
  const windowMs = options.windowMs ?? 60_000; // 1 minute
  const maxRequests = options.maxRequests ?? 100;

  // Map<key, { count, windowStart }>
  const store = new Map<string, { count: number; windowStart: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = (req.ip || req.ip || "anon").toString();
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now - entry.windowStart >= windowMs) {
        store.set(key, { count: 1, windowStart: now });
        res.setHeader("X-RateLimit-Limit", String(maxRequests));
        res.setHeader("X-RateLimit-Remaining", String(maxRequests - 1));
        return next();
      }

      entry.count += 1;
      store.set(key, entry);

      const remaining = Math.max(0, maxRequests - entry.count);
      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((entry.windowStart + windowMs - now) / 1000)));

      if (entry.count > maxRequests) {
        res.status(429).json({ error: "Too many requests" });
      } else {
        next();
      }
    } catch (err) {
      next();
    }
  };
}