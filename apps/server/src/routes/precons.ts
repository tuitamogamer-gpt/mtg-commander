import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { parseColors, toPreconModel } from "../services/deck.js";
import type { PreconListItem } from "@mtgc/shared";

export async function preconRoutes(app: FastifyInstance): Promise<void> {
  // Public: list precons with optional filters. No auth needed for browsing.
  app.get<{ Querystring: { setCode?: string; colors?: string; search?: string } }>(
    "/api/precons",
    async (request) => {
      const { setCode, colors, search } = request.query;

      const rows = await prisma.preconDeck.findMany({
        where: {
          ...(setCode ? { setCode } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search } },
                  { commanders: { contains: search } },
                ],
              }
            : {}),
        },
        orderBy: [{ releaseDate: "desc" }, { name: "asc" }],
      });

      // Color-identity filtering in JS: keep decks whose identity is a subset of
      // the requested colors (so "WU" returns mono-W, mono-U, and WU decks).
      const wanted = colors ? new Set(colors.toUpperCase().split("")) : null;

      const items: PreconListItem[] = rows
        .filter((row) => {
          if (!wanted) return true;
          const identity = parseColors(row.colorIdentity);
          return identity.every((c) => wanted.has(c));
        })
        .map((row) => {
          const model = toPreconModel(row);
          return {
            id: model.id,
            name: model.name,
            setCode: model.setCode,
            commanders: model.commanders,
            colorIdentity: model.colorIdentity,
            cardCount: model.cards.reduce((s, c) => s + c.quantity, 0),
            releaseDate: model.releaseDate,
          };
        });

      return items;
    }
  );

  // Distinct set codes, for a filter dropdown.
  app.get("/api/precons/sets", async () => {
    const rows = await prisma.preconDeck.findMany({
      distinct: ["setCode"],
      select: { setCode: true },
      orderBy: { setCode: "asc" },
    });
    return rows.map((r) => r.setCode);
  });

  app.get<{ Params: { id: string } }>("/api/precons/:id", async (request, reply) => {
    const row = await prisma.preconDeck.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.code(404).send({ error: "Precon not found" });
    return toPreconModel(row);
  });
}
