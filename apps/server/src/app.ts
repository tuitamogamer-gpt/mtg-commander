import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";

/**
 * Build the Fastify app with shared plugins and routes registered.
 * Kept separate from the HTTP listener so Socket.IO can attach to the same
 * underlying server in index.ts, and so tests can build an app without listening.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.nodeEnv === "test"
        ? false
        : {
            level: config.isProd ? "info" : "debug",
            transport: config.isProd
              ? undefined
              : {
                  target: "pino-pretty",
                  options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
                },
          },
  });

  await app.register(cors, {
    origin: config.clientOrigins,
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.jwtSecret,
  });

  app.get("/api/health", async () => ({
    status: "ok",
    time: new Date().toISOString(),
    env: config.nodeEnv,
  }));

  await registerRoutes(app);

  return app;
}
