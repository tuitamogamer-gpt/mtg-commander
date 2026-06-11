import type { IncomingMessage, ServerResponse } from "node:http";
// _app.mjs is the whole Fastify server bundled to a single ESM file by the
// `build:fn` step (esbuild), so no workspace/TS resolution happens at runtime.
// Only @prisma/client stays external (generated client + native engine).
// @ts-expect-error — build artifact, no type declarations.
import { buildApp } from "./_app.mjs";

// One Fastify instance per (warm) serverless invocation context. All /api/*
// requests are rewritten to this function (see vercel.json); req.url keeps the
// original path, so Fastify routes exactly as it does in the standalone server.
let appPromise: Promise<{ ready(): Promise<unknown>; server: { emit(ev: string, ...a: unknown[]): void } }> | null =
  null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= buildApp();
  const app = await appPromise;
  await app.ready();
  app.server.emit("request", req, res);
}
