import { z } from "zod";

export const createBookingSchema = z.object({
  skillId: z.string().cuid(),
  startAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid date" }),
  durationMin: z.number().int().positive().optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]),
});