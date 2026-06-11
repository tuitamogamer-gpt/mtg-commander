import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, registerUser } from "./helpers.js";

describe("lobby (REST polling)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await makeApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated access", async () => {
    const res = await app.inject({ method: "GET", url: "/api/lobby/rooms" });
    expect(res.statusCode).toBe(401);
  });

  it("runs a full create → join → deck → ready → start flow", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const deckA = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: a.cookie }, payload: { name: "A", cards: [] } })).json();
    const deckB = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: b.cookie }, payload: { name: "B", cards: [] } })).json();

    const created = await app.inject({
      method: "POST",
      url: "/api/lobby/rooms",
      headers: { cookie: a.cookie },
      payload: { name: "Test", maxPlayers: 2 },
    });
    expect(created.statusCode).toBe(200);
    const roomId = created.json().id as string;

    // Room shows up in the list.
    const list = await app.inject({ method: "GET", url: "/api/lobby/rooms", headers: { cookie: b.cookie } });
    expect(list.json().some((r: { id: string }) => r.id === roomId)).toBe(true);

    const joined = await app.inject({ method: "POST", url: `/api/lobby/rooms/${roomId}/join`, headers: { cookie: b.cookie } });
    expect(joined.json().players).toHaveLength(2);

    await app.inject({ method: "POST", url: `/api/lobby/rooms/${roomId}/deck`, headers: { cookie: a.cookie }, payload: { deckId: deckA.id } });
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${roomId}/deck`, headers: { cookie: b.cookie }, payload: { deckId: deckB.id } });
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${roomId}/ready`, headers: { cookie: a.cookie }, payload: { ready: true } });
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${roomId}/ready`, headers: { cookie: b.cookie }, payload: { ready: true } });

    // Non-host cannot start.
    const badStart = await app.inject({ method: "POST", url: `/api/lobby/rooms/${roomId}/start`, headers: { cookie: b.cookie } });
    expect(badStart.statusCode).toBe(403);

    const start = await app.inject({ method: "POST", url: `/api/lobby/rooms/${roomId}/start`, headers: { cookie: a.cookie } });
    expect(start.statusCode).toBe(200);
    expect(start.json().gameId).toBeTruthy();

    // The polled room now reports in_game + gameId (how clients navigate).
    const polled = await app.inject({ method: "GET", url: `/api/lobby/rooms/${roomId}`, headers: { cookie: b.cookie } });
    expect(polled.json().status).toBe("in_game");
    expect(polled.json().gameId).toBe(start.json().gameId);
  });

  it("rejects setting a deck you don't own", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const deckB = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: b.cookie }, payload: { name: "B", cards: [] } })).json();
    const room = (await app.inject({ method: "POST", url: "/api/lobby/rooms", headers: { cookie: a.cookie }, payload: {} })).json();
    const res = await app.inject({
      method: "POST",
      url: `/api/lobby/rooms/${room.id}/deck`,
      headers: { cookie: a.cookie },
      payload: { deckId: deckB.id },
    });
    expect(res.statusCode).toBe(404);
  });

  it("persists and returns room chat incrementally", async () => {
    const a = await registerUser(app);
    const room = (await app.inject({ method: "POST", url: "/api/lobby/rooms", headers: { cookie: a.cookie }, payload: {} })).json();
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/chat`, headers: { cookie: a.cookie }, payload: { text: "hello pod" } });
    const msgs = (await app.inject({ method: "GET", url: `/api/lobby/rooms/${room.id}/chat?after=0`, headers: { cookie: a.cookie } })).json();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("hello pod");
    // Incremental: nothing newer than the last ts.
    const none = (await app.inject({ method: "GET", url: `/api/lobby/rooms/${room.id}/chat?after=${msgs[0].ts}`, headers: { cookie: a.cookie } })).json();
    expect(none).toHaveLength(0);
  });
});
