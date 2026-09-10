import express from "express";
import type { PrismaClient } from "@prisma/client";

export default function adminRoutes(prisma: PrismaClient) {
  const r = express.Router();

  r.get("/stats", async (_req, res) => {
    const users = await prisma.user.count();
    const skills = await prisma.skill.count();
    const bookings = await prisma.booking.count();
    const recentBookings = await prisma.booking.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { skill: true } });
    const topSkills = await prisma.skill.findMany({
      orderBy: { bookings: { _count: "desc" } as any },
      take: 5,
      include: { owner: { select: { id: true, name: true } }, bookings: true },
    });
    res.json({ users, skills, bookings, recentBookings, topSkills });
  });

  return r;
}