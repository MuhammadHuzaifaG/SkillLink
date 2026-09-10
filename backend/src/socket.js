import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import Redis from "ioredis";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export default async function initSocket(server: HttpServer, prisma: PrismaClient) {
  const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*" } });

  // try to enable Redis adapter when REDIS_URL and @socket.io/redis-adapter are available
  if (process.env.REDIS_URL) {
    try {
      const pubClient = new Redis(process.env.REDIS_URL);
      const subClient = pubClient.duplicate();
      // dynamic import of adapter
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createAdapter } = await import("@socket.io/redis-adapter");
      io.adapter(createAdapter(pubClient, subClient));
      console.log("Socket.IO Redis adapter enabled");
    } catch (err) {
      console.warn("Redis adapter not initialized:", err?.message ?? err);
    }
  }

  // expose io on express app for route handlers to use
  // server.listener is http.Server — express app attached as server['app'] is not standard; apps should set in createApp
  // We'll set io later in routes by attaching to app via server
  // But we can set a global symbol on server to retrieve io in request handlers as req.app.get("io")
  // To support that, ensure server instanceof http.Server with an 'app' set earlier (we set in index.ts via createApp)
  // We'll set io in process once server has 'app'
  try {
    // @ts-ignore
    if ((server as any).app) (server as any).app.set("io", io);
  } catch {}

  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("auth error"));
    try {
      const payload: any = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (!user) return next(new Error("auth error"));
      (socket as any).user = user;
      next();
    } catch (e) {
      next(new Error("auth error"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket as any).user;
    socket.join(user.id);

    socket.on("joinBooking", async (bookingId: string) => {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) return socket.emit("error", "Booking not found");
      // allow only participants
      if (booking.studentId !== user.id && booking.ownerId !== user.id) return socket.emit("error", "Not participant");
      socket.join(`booking:${bookingId}`);
      // optionally send recent messages
      const messages = await prisma.message.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" }, take: 200 });
      socket.emit("messages:history", messages);
    });

    socket.on("message", async (data: { bookingId: string; content: string }) => {
      try {
        const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
        if (!booking) return socket.emit("error", "Booking not found");
        if (booking.studentId !== user.id && booking.ownerId !== user.id) return socket.emit("error", "Not participant");
        const msg = await prisma.message.create({
          data: { bookingId: data.bookingId, senderId: user.id, content: data.content },
        });
        io.to(`booking:${data.bookingId}`).emit("message", msg);
      } catch (err) {
        socket.emit("error", "Message send failed");
      }
    });

    socket.on("disconnect", () => {});
  });

  console.log("Socket.IO ready");
}