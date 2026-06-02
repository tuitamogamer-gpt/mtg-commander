import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { cardRoutes } from "./cards.js";
import { deckRoutes } from "./decks.js";
import { preconRoutes } from "./precons.js";
import { matchRoutes } from "./matches.js";

/** Register all HTTP route groups. Each phase adds its routes here. */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(cardRoutes);
  await app.register(deckRoutes);
  await app.register(preconRoutes);
  await app.register(matchRoutes);
}
