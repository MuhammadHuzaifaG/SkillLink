import express from "express";
import type { PrismaClient } from "@prisma/client";
import { createSkillSchema, searchSkillSchema, createReviewSchema } from "../validators/skill";
import { authMiddleware } from "../middleware/auth";

export default function skillRoutes(prisma: PrismaClient) {
  const r = express.Router();

  r.get("/", async (req, res) => {
    const parsed = searchSkillSchema.safeParse(req.query);
    const page = parsed.success ? parsed.data.page ?? 1 : 1;
    const pageSize = parsed.success ? parsed.data.pageSize ?? 20 : 20;
    const q = parsed.success ? parsed.data.q : undefined;
    const tag = parsed.success ? parsed.data.tag : undefined;

    const where: any = {};
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    if (tag) where.tags = { has: tag };

    const [items, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        include: { owner: { select: { id: true, name: true, bio: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.skill.count({ where }),
    ]);

    res.json({ items, page, pageSize, total });
  });

  r.post("/", authMiddleware(prisma), async (req: any, res) => {
    try {
      const parsed = createSkillSchema.parse(req.body);
      const skill = await prisma.skill.create({
        data: {
          title: parsed.title,
          description: parsed.description,
          tags: parsed.tags ?? [],
          priceCents: parsed.priceCents,
          durationMin: parsed.durationMin,
          ownerId: req.user.id,
        },
        include: { owner: { select: { id: true, name: true } } },
      });
      res.status(201).json(skill);
    } catch (err) {
      if ((err as any)?.issues) return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
      res.status(500).json({ error: "Create skill failed" });
    }
  });

  r.get("/:id", async (req, res) => {
    const skill = await prisma.skill.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: { id: true, name: true, bio: true } }, reviews: { include: { reviewer: { select: { id: true, name: true } } } } },
    });
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json(skill);
  });

  r.post("/:id/reviews", authMiddleware(prisma), async (req: any, res) => {
    try {
      const parsed = createReviewSchema.parse(req.body);
      const skill = await prisma.skill.findUnique({ where: { id: req.params.id } });
      if (!skill) return res.status(404).json({ error: "Skill not found" });
      const review = await prisma.review.create({
        data: {
          rating: parsed.rating,
          comment: parsed.comment ?? undefined,
          reviewerId: req.user.id,
          skillId: skill.id,
        },
        include: { reviewer: { select: { id: true, name: true } } },
      });
      res.status(201).json(review);
    } catch (err) {
      if ((err as any)?.issues) return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
      res.status(500).json({ error: "Create review failed" });
    }
  });

  return r;
}