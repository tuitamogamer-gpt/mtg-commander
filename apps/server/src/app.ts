import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { AUTH_COOKIE } from "./auth/jwt.js";
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

  // Log method/url/status/duration for every response (skipped in tests).
  app.addHook("onResponse", (req, reply, done) => {
    if (config.nodeEnv !== "test") {
      req.log.info(
        { method: req.method, url: req.url, status: reply.statusCode, ms: Math.round(reply.elapsedTime) },
        "request"
      );
    }
    done();
  });

  app.get("/api/health", async () => ({
    status: "ok",
    time: new Date().toISOString(),
    env: config.nodeEnv,
  }));

  await registerRoutes(app);

  return app;
}
