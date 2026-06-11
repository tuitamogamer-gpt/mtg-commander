import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { initObservability } from "./observability.js";

// Standalone HTTP server for local dev / Docker. On Vercel the same Fastify app
// is served by the api/ function instead — no realtime process is needed since
// the client uses HTTP polling.
async function main() {
  const app = await buildApp();
  initObservability(app);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`MTG Commander server listening on :${config.port}`);

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down`);
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
