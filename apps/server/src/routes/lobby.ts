import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/hooks.js";
import { roomService } from "../services/rooms.js";
import { gameService } from "../game/manager.js";
import type { ChatMessage } from "@mtgc/shared";

const createSchema = z.object({
  name: z.string().max(60).default(""),
  maxPlayers: z.number().int().min(2).max(4).default(4),
  settings: z
    .object({
      startingLife: z.number().int().min(1).max(999).optional(),
      mulligan: z.enum(["free7-then-london", "london", "none"]).optional(),
      allowSpectators: z.boolean().optional(),
    })
    .optional(),
});

/** Lobby chat is stored in GameChat under a `room:`-prefixed channel id. */
const lobbyChannel = (roomId: string) => `room:${roomId}`;

export async function lobbyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.get("/api/lobby/rooms", async () => roomService.list());

  app.post("/api/lobby/rooms", async (request, reply) => {
    const parsed = createSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid room settings" });
    const { name, maxPlayers, settings } = parsed.data;
    return roomService.create(request.user!, name, maxPlayers, settings);
  });

  // Polled by the room page; also records the viewer's presence heartbeat.
  app.get<{ Params: { id: string } }>("/api/lobby/rooms/:id", async (request, reply) => {
    const room = await roomService.getAndTouch(request.params.id, request.user!.id);
    if (!room) return reply.code(404).send({ error: "Room not found" });
    return room;
  });

  app.post<{ Params: { id: string } }>("/api/lobby/rooms/:id/join", async (request, reply) => {
    try {
      return await roomService.join(request.params.id, request.user!);
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Cannot join" });
    }
  });

  app.post<{ Params: { id: string } }>("/api/lobby/rooms/:id/leave", async (request) => {
    await roomService.leave(request.params.id, request.user!.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/lobby/rooms/:id/deck", async (request, reply) => {
    const body = z.object({ deckId: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Expected { deckId }" });
    const deck = await prisma.deck.findFirst({
      where: { id: body.data.deckId, userId: request.user!.id },
    });
    if (!deck) return reply.code(404).send({ error: "Deck not found" });
    try {
      return await roomService.setDeck(request.params.id, request.user!.id, deck.id, deck.name);
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Cannot set deck" });
    }
  });

  app.post<{ Params: { id: string } }>("/api/lobby/rooms/:id/ready", async (request, reply) => {
    const body = z.object({ ready: z.boolean() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Expected { ready }" });
    try {
      return await roomService.setReady(request.params.id, request.user!.id, body.data.ready);
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Cannot ready" });
    }
  });

  app.post<{ Params: { id: string } }>("/api/lobby/rooms/:id/start", async (request, reply) => {
    const room = await roomService.get(request.params.id);
    if (!room) return reply.code(404).send({ error: "Room not found" });
    if (room.hostId !== request.user!.id) {
      return reply.code(403).send({ error: "Only the host can start the game" });
    }
    const blocker = roomService.canStart(room);
    if (blocker) return reply.code(409).send({ error: blocker });

    const state = await gameService.createGame(room);
    await roomService.markStarted(room.id, state.id);
    return { gameId: state.id };
  });

  // --- room chat (polled with ?after=<epoch ms>) ----------------------------

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>(
    "/api/lobby/rooms/:id/chat",
    async (request) => {
      const after = Number(request.query.after ?? 0) || 0;
      const rows = await prisma.gameChat.findMany({
        where: { gameId: lobbyChannel(request.params.id), ts: { gt: new Date(after) } },
        orderBy: { ts: "asc" },
        take: 100,
      });
      return rows.map(
        (r): ChatMessage => ({
          id: r.id,
          scope: "lobby",
          roomId: request.params.id,
          userId: r.userId,
          username: r.username,
          text: r.text,
          ts: r.ts.getTime(),
        })
      );
    }
  );

  app.post<{ Params: { id: string } }>("/api/lobby/rooms/:id/chat", async (request, reply) => {
    const body = z.object({ text: z.string().trim().min(1).max(500) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Empty message" });
    await prisma.gameChat.create({
      data: {
        gameId: lobbyChannel(request.params.id),
        userId: request.user!.id,
        username: request.user!.username,
        text: body.data.text,
      },
    });
    return { ok: true };
  });
}
