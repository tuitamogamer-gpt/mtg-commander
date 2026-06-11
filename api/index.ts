import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../apps/server/src/app.js";

// One Fastify instance per (warm) serverless invocation context. All /api/*
// requests are rewritten to this function (see vercel.json); req.url keeps the
// original path, so Fastify routes exactly as it does in the standalone server.
let appPromise: ReturnType<typeof buildApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= buildApp();
  const app = await appPromise;
  await app.ready();
  app.server.emit("request", req, res);
}
