import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/hooks.js";
import {
  computeColorIdentity,
  toDeckModel,
  validateCommanderDeck,
} from "../services/deck.js";
import { importMoxfieldDeck } from "../services/moxfield.js";
import type { Deck, DeckCardEntry } from "@mtgc/shared";

const cardEntrySchema = z.object({
  scryfallId: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  isCommander: z.boolean(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  cards: z.array(cardEntrySchema).max(500),
  source: z.enum(["moxfield", "precon", "manual"]).optional(),
  sourceId: z.string().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  cards: z.array(cardEntrySchema).max(500).optional(),
});

const moxfieldSchema = z.object({ deckId: z.string().min(1) });

function commanderNames(cards: DeckCardEntry[]): string | null {
  const names = cards.filter((c) => c.isCommander).map((c) => c.name);
  return names.length > 0 ? names.join(", ") : null;
}

export async function deckRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  // List the current user's decks.
  app.get("/api/decks", async (request) => {
    const decks = await prisma.deck.findMany({
      where: { userId: request.user!.id },
      orderBy: { updatedAt: "desc" },
    });
    return decks.map(toDeckModel) satisfies Deck[];
  });

  app.get<{ Params: { id: string } }>("/api/decks/:id", async (request, reply) => {
    const deck = await prisma.deck.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });
    if (!deck) return reply.code(404).send({ error: "Deck not found" });
    return toDeckModel(deck);
  });

  // Advisory Commander legality check for a deck's cards.
  app.get<{ Params: { id: string } }>("/api/decks/:id/validate", async (request, reply) => {
    const deck = await prisma.deck.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });
    if (!deck) return reply.code(404).send({ error: "Deck not found" });
    return validateCommanderDeck(toDeckModel(deck).cards);
  });

  app.post("/api/decks", async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid deck" });
    }
    const { name, cards, source = "manual", sourceId = null } = parsed.data;
    const colorIdentity = await computeColorIdentity(cards);
    const deck = await prisma.deck.create({
      data: {
        userId: request.user!.id,
        name,
        commander: commanderNames(cards),
        cards: JSON.stringify(cards),
        source,
        sourceId,
        colorIdentity: JSON.stringify(colorIdentity),
      },
    });
    return reply.code(201).send(toDeckModel(deck));
  });

  app.put<{ Params: { id: string } }>("/api/decks/:id", async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid deck" });
    }
    const existing = await prisma.deck.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });
    if (!existing) return reply.code(404).send({ error: "Deck not found" });

    const cards = parsed.data.cards;
    const deck = await prisma.deck.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name ?? undefined,
        ...(cards
          ? {
              cards: JSON.stringify(cards),
              commander: commanderNames(cards),
              colorIdentity: JSON.stringify(await computeColorIdentity(cards)),
            }
          : {}),
      },
    });
    return toDeckModel(deck);
  });

  app.delete<{ Params: { id: string } }>("/api/decks/:id", async (request, reply) => {
    const existing = await prisma.deck.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });
    if (!existing) return reply.code(404).send({ error: "Deck not found" });
    await prisma.deck.delete({ where: { id: existing.id } });
    return { ok: true };
  });

  // Import a public Moxfield deck into the user's collection.
  app.post("/api/decks/import/moxfield", async (request, reply) => {
    const parsed = moxfieldSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Expected { deckId }" });
    }
    let result;
    try {
      result = await importMoxfieldDeck(parsed.data.deckId);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : "Import failed" });
    }
    const colorIdentity = await computeColorIdentity(result.cards);
    const deck = await prisma.deck.create({
      data: {
        userId: request.user!.id,
        name: result.name,
        commander: commanderNames(result.cards),
        cards: JSON.stringify(result.cards),
        source: "moxfield",
        sourceId: result.publicId,
        colorIdentity: JSON.stringify(colorIdentity),
      },
    });
    return reply.code(201).send(toDeckModel(deck));
  });
}
