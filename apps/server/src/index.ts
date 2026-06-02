import { Server as SocketServer } from "socket.io";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

async function main() {
  const app = await buildApp();

  // Attach Socket.IO to the same HTTP server Fastify uses. Namespaces (/lobby,
  // /game) are registered in later phases.
  const io = new SocketServer(app.server, {
    cors: { origin: config.clientOrigins, credentials: true },
    // Heartbeat tuning: detect dropped clients within ~45s while keeping idle
    // chatter low. maxHttpBufferSize bounds a single payload (game states).
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 2_000_000,
  });
  app.decorate("io", io);

  // Registered here so namespaces can read auth from the same cookie.
  const { registerSockets } = await import("./sockets/index.js");
  registerSockets(io);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`MTG Commander server listening on :${config.port}`);

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down`);
    await io.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
