import express from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
});

export default function userRoutes(prisma: PrismaClient) {
  const r = express.Router();

  r.get("/me", authMiddleware(prisma), async (req: any, res) => {
    res.json({ user: req.user });
  });

  r.put("/me", authMiddleware(prisma), async (req: any, res) => {
    try {
      const parsed = updateSchema.parse(req.body);
      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { name: parsed.name ?? undefined, bio: parsed.bio ?? undefined },
        select: { id: true, name: true, email: true, bio: true },
      });
      res.json({ user: updated });
    } catch (err) {
      if ((err as any)?.issues) return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
      res.status(500).json({ error: "Update failed" });
    }
  });

  return r;
}