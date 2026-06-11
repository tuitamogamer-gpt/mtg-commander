import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/hooks.js";
import { gameService } from "../game/manager.js";
import { roomService } from "../services/rooms.js";
import type { ChatMessage, GameAction } from "@mtgc/shared";

/** Minimal shape check — the action union is honor-system, the engine ignores
 * anything it doesn't understand for the actor's own cards. */
const actionSchema = z.object({ type: z.string().min(1) }).passthrough();

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  /**
   * State poll. `?since=<version>` lets clients poll cheaply: when nothing
   * changed the response is just { version } with no state payload.
   */
  app.get<{ Params: { id: string }; Querystring: { since?: string } }>(
    "/api/games/:id/state",
    async (request, reply) => {
      const since = request.query.since !== undefined ? Number(request.query.since) : undefined;
      if (since !== undefined && Number.isFinite(since)) {
        const version = await gameService.version(request.params.id);
        if (version === null) return reply.code(404).send({ error: "Game not found" });
        if (version === since) return { version };
      }
      const view = await gameService.view(request.params.id, request.user!.id);
      if (view === null) return reply.code(404).send({ error: "Game not found" });
      if (view === "forbidden") {
        return reply.code(403).send({ error: "This table does not allow spectators" });
      }
      return { version: view.version, state: view };
    }
  );

  app.post<{ Params: { id: string } }>("/api/games/:id/action", async (request, reply) => {
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid action" });
    let logs: string[] | null;
    try {
      logs = await gameService.apply(request.params.id, request.user!.id, parsed.data as unknown as GameAction);
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Conflict" });
    }
    if (logs === null) return reply.code(403).send({ error: "You are not a player in this game" });
    // Return the actor's fresh view so their UI updates without waiting a poll.
    const view = await gameService.view(request.params.id, request.user!.id);
    return { logs, state: view === "forbidden" ? null : view };
  });

  app.post<{ Params: { id: string } }>("/api/games/:id/undo", async (request, reply) => {
    const ok = await gameService.undo(request.params.id);
    if (!ok) return reply.code(409).send({ error: "Nothing to undo" });
    const view = await gameService.view(request.params.id, request.user!.id);
    return { state: view === "forbidden" ? null : view };
  });

  app.post<{ Params: { id: string } }>("/api/games/:id/end", async (request, reply) => {
    const body = z.object({ winnerId: z.string().nullable() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Expected { winnerId }" });
    const state = await gameService.endGame(request.params.id, request.user!.id, body.data.winnerId);
    if (!state) return reply.code(403).send({ error: "You are not a player in this game" });
    // The lobby room has served its purpose — drop it so the lobby list stays clean.
    await roomService.remove(state.roomId);
    return { ok: true };
  });

  app.get<{ Params: { id: string }; Querystring: { count?: string } }>(
    "/api/games/:id/peek",
    async (request, reply) => {
      const count = Math.max(0, Number(request.query.count ?? 0) || 0);
      const cards = await gameService.peekLibrary(request.params.id, request.user!.id, count);
      if (cards === null) return reply.code(403).send({ error: "No seat in this game" });
      return { cards };
    }
  );

  // --- game chat (polled with ?after=<epoch ms>) -----------------------------

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>(
    "/api/games/:id/chat",
    async (request) => {
      const after = Number(request.query.after ?? 0) || 0;
      const rows = await prisma.gameChat.findMany({
        where: { gameId: request.params.id, ts: { gt: new Date(after) } },
        orderBy: { ts: "asc" },
        take: 100,
      });
      return rows.map(
        (r): ChatMessage => ({
          id: r.id,
          scope: "game",
          roomId: request.params.id,
          userId: r.userId,
          username: r.username,
          text: r.text,
          ts: r.ts.getTime(),
          isSpectator: r.isSpectator,
        })
      );
    }
  );

  app.post<{ Params: { id: string } }>("/api/games/:id/chat", async (request, reply) => {
    const body = z.object({ text: z.string().trim().min(1).max(500) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Empty message" });
    const view = await gameService.view(request.params.id, request.user!.id);
    if (view === null) return reply.code(404).send({ error: "Game not found" });
    if (view === "forbidden") return reply.code(403).send({ error: "Spectating not allowed" });
    const isSpectator = !view.players.some((p) => p.id === request.user!.id);
    await prisma.gameChat.create({
      data: {
        gameId: request.params.id,
        userId: request.user!.id,
        username: request.user!.username,
        text: body.data.text,
        isSpectator,
      },
    });
    return { ok: true };
  });
}
