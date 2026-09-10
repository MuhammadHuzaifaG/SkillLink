import express from "express";
import type { PrismaClient } from "@prisma/client";
import { createBookingSchema, updateBookingStatusSchema } from "../validators/booking";
import { authMiddleware } from "../middleware/auth";

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

export default function bookingRoutes(prisma: PrismaClient) {
  const r = express.Router();

  // create booking (student)
  r.post("/", authMiddleware(prisma), async (req: any, res) => {
    try {
      const parsed = createBookingSchema.parse(req.body);
      const skill = await prisma.skill.findUnique({ where: { id: parsed.skillId } });
      if (!skill) return res.status(404).json({ error: "Skill not found" });

      const start = new Date(parsed.startAt);
      const durationMin = parsed.durationMin ?? skill.durationMin;
      const end = new Date(start.getTime() + durationMin * 60000);
      if (end <= start) return res.status(400).json({ error: "Invalid time range" });

      // check conflicts for this skill (excluding cancelled)
      const conflict = await prisma.booking.findFirst({
        where: {
          skillId: skill.id,
          NOT: [{ status: "CANCELLED" }],
          AND: [
            { startAt: { lt: end } }, // start < end
            { endAt: { gt: start } }, // end > start
          ],
        },
      });
      if (conflict) return res.status(409).json({ error: "Time slot unavailable" });

      const booking = await prisma.booking.create({
        data: {
          skillId: skill.id,
          studentId: req.user.id,
          ownerId: skill.ownerId,
          startAt: start,
          endAt: end,
          status: "PENDING",
        },
        include: { skill: true },
      });

      // emit event if socket exists
      try {
        const io = (req.app.get("io") as any) as import("socket.io").Server | undefined;
        if (io) io.to(skill.ownerId).emit("booking:new", { bookingId: booking.id, skillId: skill.id });
      } catch (_e) {}

      res.status(201).json(booking);
    } catch (err) {
      if ((err as any)?.issues) return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
      res.status(500).json({ error: "Create booking failed" });
    }
  });

  // list bookings for current user (as student OR owner)
  r.get("/", authMiddleware(prisma), async (req: any, res) => {
    const as = req.query.as === "owner" ? "owner" : "student";
    const where = as === "owner" ? { ownerId: req.user.id } : { studentId: req.user.id };
    const bookings = await prisma.booking.findMany({
      where,
      include: { skill: { include: { owner: { select: { id: true, name: true } } } } },
      orderBy: { startAt: "desc" },
    });
    res.json({ bookings });
  });

  r.get("/:id", authMiddleware(prisma), async (req: any, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { skill: true, review: true, messages: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    // ensure user is participant
    if (booking.studentId !== req.user.id && booking.ownerId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    res.json(booking);
  });

  // update booking status (owner confirms/cancels; student can cancel)
  r.put("/:id/status", authMiddleware(prisma), async (req: any, res) => {
    try {
      const parsed = updateBookingStatusSchema.parse(req.body);
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const actorId = req.user.id;
      // owner can CONFIRM/CANCEL/COMPLETE; student can CANCEL
      if (parsed.status === "CONFIRMED" || parsed.status === "COMPLETED") {
        if (booking.ownerId !== actorId) return res.status(403).json({ error: "Only owner can confirm or complete" });
      } else if (parsed.status === "CANCELLED") {
        if (booking.studentId !== actorId && booking.ownerId !== actorId) return res.status(403).json({ error: "Only participants can cancel" });
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: parsed.status },
      });

      // notify participants via socket
      try {
        const io = (req.app.get("io") as any) as import("socket.io").Server | undefined;
        if (io) {
          io.to(booking.studentId).emit("booking:update", updated);
          io.to(booking.ownerId).emit("booking:update", updated);
          io.to(`booking:${booking.id}`).emit("booking:update", updated);
        }
      } catch (_e) {}

      res.json(updated);
    } catch (err) {
      if ((err as any)?.issues) return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
      res.status(500).json({ error: "Update failed" });
    }
  });

  return r;
}