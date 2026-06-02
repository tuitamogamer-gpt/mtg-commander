import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/hooks.js";
import type { MatchSummary } from "@mtgc/shared";

export async function matchRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  // The current user's finished games, most recent first.
  app.get("/api/matches", async (request) => {
    const userId = request.user!.id;
    // playerIds is a JSON array string; filter in JS after a bounded fetch.
    const rows = await prisma.match.findMany({ orderBy: { finishedAt: "desc" }, take: 200 });
    const mine = rows.filter((r) => {
      try {
        return (JSON.parse(r.playerIds) as string[]).includes(userId);
      } catch {
        return false;
      }
    });
    return mine.slice(0, 50).map(
      (r): MatchSummary => ({
        id: r.id,
        gameId: r.gameId,
        finishedAt: r.finishedAt.toISOString(),
        participants: safeParse(r.participants),
        winnerId: r.winnerId,
        winnerName: r.winnerName,
        turns: r.turns,
      })
    );
  });
}

function safeParse(json: string): MatchSummary["participants"] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}
