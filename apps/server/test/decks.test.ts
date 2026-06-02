import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, registerUser, seedCard } from "./helpers.js";

const RED_ID = "11111111-1111-1111-1111-111111111111";
const COMMANDER_ID = "22222222-2222-2222-2222-222222222222";

describe("decks", () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    app = await makeApp();
    ({ cookie } = await registerUser(app));
    // Pre-cache cards so color-identity computation never hits the network.
    await seedCard(RED_ID, { name: "Lightning Bolt", colorIdentity: ["R"], typeLine: "Instant" });
    await seedCard(COMMANDER_ID, {
      name: "Test Commander",
      colorIdentity: ["R"],
      typeLine: "Legendary Creature — Goblin",
    });
  });
  afterAll(async () => {
    await app.close();
  });

  const make = (payload: unknown) =>
    app.inject({ method: "POST", url: "/api/decks", headers: { cookie }, payload });

  it("requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/decks" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a deck and computes color identity from cards", async () => {
    const res = await make({
      name: "Test Deck",
      cards: [{ scryfallId: RED_ID, name: "Lightning Bolt", quantity: 1, isCommander: false }],
    });
    expect(res.statusCode).toBe(201);
    const deck = res.json();
    expect(deck.name).toBe("Test Deck");
    expect(deck.colorIdentity).toEqual(["R"]);
  });

  it("rejects an invalid deck (empty name) with 400", async () => {
    const res = await make({ name: "", cards: [] });
    expect(res.statusCode).toBe(400);
  });

  it("lists, fetches, updates, and deletes a deck", async () => {
    const created = (await make({ name: "CRUD", cards: [] })).json();

    const list = await app.inject({ method: "GET", url: "/api/decks", headers: { cookie } });
    expect(list.json().some((d: { id: string }) => d.id === created.id)).toBe(true);

    const got = await app.inject({ method: "GET", url: `/api/decks/${created.id}`, headers: { cookie } });
    expect(got.statusCode).toBe(200);

    const upd = await app.inject({
      method: "PUT",
      url: `/api/decks/${created.id}`,
      headers: { cookie },
      payload: { name: "Renamed" },
    });
    expect(upd.json().name).toBe("Renamed");

    const del = await app.inject({ method: "DELETE", url: `/api/decks/${created.id}`, headers: { cookie } });
    expect(del.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: `/api/decks/${created.id}`, headers: { cookie } });
    expect(after.statusCode).toBe(404);
  });

  it("does not expose another user's deck", async () => {
    const created = (await make({ name: "Private", cards: [] })).json();
    const other = await registerUser(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/decks/${created.id}`,
      headers: { cookie: other.cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("validates a deck (advisory) — flags wrong card count and missing commander", async () => {
    const created = (await make({
      name: "Invalid",
      cards: [{ scryfallId: RED_ID, name: "Lightning Bolt", quantity: 1, isCommander: false }],
    })).json();
    const res = await app.inject({ method: "GET", url: `/api/decks/${created.id}/validate`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const v = res.json();
    expect(v.valid).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });
});
