import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { PrismaClient } from "@prisma/client";
import createApp from "./app";

const prisma = new PrismaClient();

async function bootstrap() {
  const app = createApp(prisma);
  const server = http.createServer(app);

  // Try to initialize socket (optional). If ./socket is not present yet, we continue.
  try {
    // dynamic import so the file can be added later without breaking startup
    // when compiled to JS this will resolve to ./socket.js as needed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const socketModule = await import("./socket");
    if (socketModule && typeof socketModule.default === "function") {
      socketModule.default(server, prisma);
      console.log("Socket module initialized");
    }
  } catch (err) {
    // noop — socket implementation will be added in a later step
  }

  const PORT = Number(process.env.PORT) || 4000;
  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  const graceful = async () => {
    console.log("Graceful shutdown started");
    server.close(async (err) => {
      try {
        await prisma.$disconnect();
      } catch (e) {
        console.error("Prisma disconnect error:", e);
      }
      if (err) {
        console.error("Server close error:", err);
        process.exit(1);
      }
      process.exit(0);
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
      console.warn("Forcing shutdown");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", graceful);
  process.on("SIGTERM", graceful);
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    graceful();
  });
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap app:", err);
  process.exit(1);
});