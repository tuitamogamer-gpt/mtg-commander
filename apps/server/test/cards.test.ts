import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, seedCard } from "./helpers.js";

const CACHED = "33333333-3333-3333-3333-333333333333";
const UNCACHED = "44444444-4444-4444-4444-444444444444";

function scryfallCard(id: string, name: string) {
  return { id, name, mana_cost: "{R}", cmc: 1, type_line: "Instant", color_identity: ["R"] };
}

describe("cards (Scryfall proxy, network mocked)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeApp();
    await seedCard(CACHED, { name: "Cached Bolt", colorIdentity: ["R"] });
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("serves a cached card without hitting the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await app.inject({ method: "GET", url: `/api/cards/${CACHED}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Cached Bolt");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches and caches an uncached card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(scryfallCard(UNCACHED, "Fetched Card")), { status: 200 }))
    );
    const res = await app.inject({ method: "GET", url: `/api/cards/${UNCACHED}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Fetched Card");
  });

  it("404s a card Scryfall does not know", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    const res = await app.inject({ method: "GET", url: "/api/cards/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });

  it("proxies a search query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [scryfallCard("s1", "Search Hit")] }), { status: 200 }))
    );
    const res = await app.inject({ method: "GET", url: "/api/cards/search?q=t:instant" });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0].name).toBe("Search Hit");
  });

  it("returns [] for an empty search query", async () => {
    const res = await app.inject({ method: "GET", url: "/api/cards/search?q=" });
    expect(res.json()).toEqual([]);
  });

  it("validates the batch payload", async () => {
    const res = await app.inject({ method: "POST", url: "/api/cards/batch", payload: { ids: [] } });
    expect(res.statusCode).toBe(400);
  });
});
