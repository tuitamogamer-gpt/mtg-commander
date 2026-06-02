import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";

/** Register all HTTP route groups. Each phase adds its routes here. */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  // Faza 5: await app.register(cardRoutes)
  // Faza 6/7: await app.register(deckRoutes)
}
