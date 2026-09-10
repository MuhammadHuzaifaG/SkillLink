import { z } from "zod";

export const createSkillSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  tags: z.array(z.string()).max(10).optional(),
  priceCents: z.number().int().nonnegative(),
  durationMin: z.number().int().positive(),
});

export const searchSkillSchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  page: z.preprocess((v) => Number(v), z.number().int().min(1).optional()),
  pageSize: z.preprocess((v) => Number(v), z.number().int().min(1).max(100).optional()),
});

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});