import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCard, getCards, searchCards, getCommanderBanlist } from "../services/scryfall.js";
import type { Card, CardBatchResponse } from "@mtgc/shared";

const batchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export async function cardRoutes(app: FastifyInstance): Promise<void> {
  // Scryfall search proxy for the deck editor (e.g. ?q=t:creature id<=wu).
  app.get<{ Querystring: { q?: string } }>("/api/cards/search", async (request, reply) => {
    const q = (request.query.q ?? "").trim();
    if (!q) return [] satisfies Card[];
    try {
      return await searchCards(q);
    } catch {
      return reply.code(502).send({ error: "Card search failed" });
    }
  });

  // Commander banned list (card names).
  app.get("/api/cards/banlist", async () => {
    const names = await getCommanderBanlist();
    return { names };
  });

  app.get<{ Params: { scryfallId: string } }>("/api/cards/:scryfallId", async (request, reply) => {
    const card = await getCard(request.params.scryfallId);
    if (!card) return reply.code(404).send({ error: "Card not found" });
    return card satisfies Card;
  });

  app.post("/api/cards/batch", async (request, reply) => {
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Expected { ids: string[] }" });
    }
    const { cards, notFound } = await getCards(parsed.data.ids);
    return { cards, notFound } satisfies CardBatchResponse;
  });
}
