import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { AUTH_COOKIE } from "./auth/jwt.js";
import { prisma } from "./db.js";
import { recordRequest, snapshot } from "./metrics.js";
import { gameManager } from "./game/manager.js";
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

  // Rate limit per session (auth cookie) or IP. Generous global cap to protect
  // the upstream proxies (Scryfall/Moxfield/MTGJSON) without hindering play.
  await app.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.cookies?.[AUTH_COOKIE] ?? req.ip,
    allowList: (req) => req.url === "/api/health",
  });

  // Log method/url/status/duration and record metrics for every response.
  app.addHook("onResponse", (req, reply, done) => {
    const ms = Math.round(reply.elapsedTime);
    recordRequest(reply.statusCode, ms);
    if (config.nodeEnv !== "test") {
      req.log.info({ method: req.method, url: req.url, status: reply.statusCode, ms }, "request");
    }
    done();
  });

  // Liveness + dependency check (DB ping). Used by uptime monitors / containers.
  app.get("/api/health", async (_req, reply) => {
    let db: "ok" | "down" = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    const body = { status: db === "ok" ? "ok" : "degraded", time: new Date().toISOString(), env: config.nodeEnv, db };
    return reply.code(db === "ok" ? 200 : 503).send(body);
  });

  // Basic operational metrics.
  app.get("/api/metrics", async () => ({
    ...snapshot(),
    activeGames: gameManager.activeCount(),
    activeSockets: app.io?.engine?.clientsCount ?? 0,
  }));

  await registerRoutes(app);

  return app;
}
