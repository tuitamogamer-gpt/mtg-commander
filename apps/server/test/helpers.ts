import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db.js";

/** Build a fresh app instance for a test file. */
export async function makeApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

let userSeq = 0;

/** Register a unique user and return the app + the auth cookie header. */
export async function registerUser(app: FastifyInstance, username?: string) {
  const name = username ?? `user_${Date.now()}_${userSeq++}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { username: name, email: `${name}@example.com`, password: "secret123" },
  });
  const setCookie = res.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie ?? "";
  const cookie = /mtgc_token=[^;]+/.exec(raw)?.[0] ?? "";
  return { username: name, cookie, body: res.json() as { user: { id: string } } };
}

/** Insert a fresh Card cache row so color-identity/validation works offline. */
export async function seedCard(scryfallId: string, opts: Partial<{ name: string; colorIdentity: string[]; typeLine: string; oracleText: string }> = {}) {
  const data = {
    scryfallId,
    name: opts.name ?? "Test Card",
    typeLine: opts.typeLine ?? "Creature",
    oracleText: opts.oracleText ?? "",
    colorIdentity: JSON.stringify(opts.colorIdentity ?? []),
    fetchedAt: new Date(),
  };
  await prisma.card.upsert({ where: { scryfallId }, create: data, update: data });
}

/** Insert a precon deck row for precon-endpoint tests. */
export async function seedPrecon(setCode: string, name: string, cards: unknown[], colorIdentity: string[] = []) {
  return prisma.preconDeck.create({
    data: {
      setCode,
      name,
      commanders: "Test Commander",
      colorIdentity: JSON.stringify(colorIdentity),
      cards: JSON.stringify(cards),
    },
  });
}
