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

  it("flags cards outside the commander's color identity", async () => {
    const CMDR = "aaaaaaaa-0000-0000-0000-000000000001";
    const BLUE = "aaaaaaaa-0000-0000-0000-000000000002";
    await seedCard(CMDR, { name: "Mono Red Cmdr", colorIdentity: ["R"], typeLine: "Legendary Creature — Goblin" });
    await seedCard(BLUE, { name: "Counterspell", colorIdentity: ["U"], typeLine: "Instant" });
    const deck = (await make({
      name: "Off-color",
      cards: [
        { scryfallId: CMDR, name: "Mono Red Cmdr", quantity: 1, isCommander: true },
        { scryfallId: BLUE, name: "Counterspell", quantity: 1, isCommander: false },
      ],
    })).json();
    const v = (await app.inject({ method: "GET", url: `/api/decks/${deck.id}/validate`, headers: { cookie } })).json();
    expect(v.errors.some((e: string) => /color identity/i.test(e))).toBe(true);
  });

  it("exempts basic lands and 'any number' cards from the singleton rule", async () => {
    const CMDR = "bbbbbbbb-0000-0000-0000-000000000001";
    const RATS = "bbbbbbbb-0000-0000-0000-000000000002";
    await seedCard(CMDR, { name: "Mono Black Cmdr", colorIdentity: ["B"], typeLine: "Legendary Creature — Rat" });
    await seedCard(RATS, {
      name: "Rat Colony",
      colorIdentity: ["B"],
      typeLine: "Creature — Rat",
      oracleText: "A deck can have any number of cards named Rat Colony.",
    });
    await seedCard("plains-x", { name: "Swamp", colorIdentity: ["B"], typeLine: "Basic Land — Swamp" });
    const deck = (await make({
      name: "Rats",
      cards: [
        { scryfallId: CMDR, name: "Mono Black Cmdr", quantity: 1, isCommander: true },
        { scryfallId: RATS, name: "Rat Colony", quantity: 30, isCommander: false },
        { scryfallId: "plains-x", name: "Swamp", quantity: 20, isCommander: false },
      ],
    })).json();
    const v = (await app.inject({ method: "GET", url: `/api/decks/${deck.id}/validate`, headers: { cookie } })).json();
    // Neither Rat Colony (×30) nor Swamp (×20) should trigger a singleton warning.
    expect(v.warnings.some((w: string) => /singleton/i.test(w))).toBe(false);
  });
});
