import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, registerUser, seedCard } from "./helpers.js";

const LAND = "rest-land-0000-0000-0000-000000000001";
const DECK_CARDS = [{ scryfallId: LAND, name: "Mountain", quantity: 20, isCommander: false }];

async function startGame(app: FastifyInstance) {
  const a = await registerUser(app);
  const b = await registerUser(app);
  const dA = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: a.cookie }, payload: { name: "A", cards: DECK_CARDS } })).json();
  const dB = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: b.cookie }, payload: { name: "B", cards: DECK_CARDS } })).json();
  const room = (await app.inject({ method: "POST", url: "/api/lobby/rooms", headers: { cookie: a.cookie }, payload: { maxPlayers: 2 } })).json();
  await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/join`, headers: { cookie: b.cookie } });
  await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/deck`, headers: { cookie: a.cookie }, payload: { deckId: dA.id } });
  await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/deck`, headers: { cookie: b.cookie }, payload: { deckId: dB.id } });
  await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/ready`, headers: { cookie: a.cookie }, payload: { ready: true } });
  await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/ready`, headers: { cookie: b.cookie }, payload: { ready: true } });
  const start = (await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/start`, headers: { cookie: a.cookie } })).json();
  return { gameId: start.gameId as string, a, b, roomId: room.id as string };
}

describe("game (REST polling)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await makeApp();
    await seedCard(LAND, { name: "Mountain", colorIdentity: ["R"], typeLine: "Basic Land — Mountain" });
  });
  afterAll(async () => {
    await app.close();
  });

  it("serves a redacted per-viewer state with version-based change polling", async () => {
    const { gameId, a } = await startGame(app);
    const first = (await app.inject({ method: "GET", url: `/api/games/${gameId}/state`, headers: { cookie: a.cookie } })).json();
    expect(first.state.players).toHaveLength(2);
    const me = first.state.players.find((p: { id: string }) => p.id === first.state.viewerId);
    expect(Array.isArray(me.zones.hand)).toBe(true); // own hand visible

    // since=<current version> → no state payload.
    const unchanged = (await app.inject({
      method: "GET",
      url: `/api/games/${gameId}/state?since=${first.version}`,
      headers: { cookie: a.cookie },
    })).json();
    expect(unchanged.state).toBeUndefined();
  });

  it("applies actions and bumps the version (so peers' polls pick it up)", async () => {
    const { gameId, a, b } = await startGame(app);
    const before = (await app.inject({ method: "GET", url: `/api/games/${gameId}/state`, headers: { cookie: b.cookie } })).json();

    const act = await app.inject({
      method: "POST",
      url: `/api/games/${gameId}/action`,
      headers: { cookie: a.cookie },
      payload: { type: "draw", count: 1 },
    });
    expect(act.statusCode).toBe(200);
    expect(act.json().state).toBeTruthy();

    // B's poll with the old version now returns fresh state.
    const after = (await app.inject({
      method: "GET",
      url: `/api/games/${gameId}/state?since=${before.version}`,
      headers: { cookie: b.cookie },
    })).json();
    expect(after.state).toBeTruthy();
  });

  it("undo restores the pre-action snapshot", async () => {
    const { gameId, a } = await startGame(app);
    const before = (await app.inject({ method: "GET", url: `/api/games/${gameId}/state`, headers: { cookie: a.cookie } })).json();
    const libBefore = before.state.players.find((p: { id: string }) => p.id === before.state.viewerId).zones.library.count;

    await app.inject({ method: "POST", url: `/api/games/${gameId}/action`, headers: { cookie: a.cookie }, payload: { type: "draw", count: 1 } });
    const undone = await app.inject({ method: "POST", url: `/api/games/${gameId}/undo`, headers: { cookie: a.cookie } });
    expect(undone.statusCode).toBe(200);
    const lib = undone.json().state.players.find((p: { id: string }) => p.id === undone.json().state.viewerId).zones.library.count;
    expect(lib).toBe(libBefore);
  });

  it("lets non-seated users spectate (hidden hands) but not act or peek", async () => {
    const { gameId } = await startGame(app);
    const outsider = await registerUser(app);

    const view = (await app.inject({ method: "GET", url: `/api/games/${gameId}/state`, headers: { cookie: outsider.cookie } })).json();
    expect(view.state.players.every((p: { zones: { hand: unknown } }) => !Array.isArray(p.zones.hand))).toBe(true);

    const act = await app.inject({ method: "POST", url: `/api/games/${gameId}/action`, headers: { cookie: outsider.cookie }, payload: { type: "draw", count: 1 } });
    expect(act.statusCode).toBe(403);

    const peek = await app.inject({ method: "GET", url: `/api/games/${gameId}/peek?count=3`, headers: { cookie: outsider.cookie } });
    expect(peek.statusCode).toBe(403);
  });

  it("peek returns the top of your own library privately", async () => {
    const { gameId, a } = await startGame(app);
    const peek = (await app.inject({ method: "GET", url: `/api/games/${gameId}/peek?count=3`, headers: { cookie: a.cookie } })).json();
    expect(peek.cards).toHaveLength(3);
  });

  it("game chat round-trips with the spectator flag", async () => {
    const { gameId, a } = await startGame(app);
    const spec = await registerUser(app);
    await app.inject({ method: "POST", url: `/api/games/${gameId}/chat`, headers: { cookie: a.cookie }, payload: { text: "gl hf" } });
    await app.inject({ method: "POST", url: `/api/games/${gameId}/chat`, headers: { cookie: spec.cookie }, payload: { text: "👀" } });
    const msgs = (await app.inject({ method: "GET", url: `/api/games/${gameId}/chat?after=0`, headers: { cookie: a.cookie } })).json();
    expect(msgs).toHaveLength(2);
    expect(msgs[0].isSpectator).toBe(false);
    expect(msgs[1].isSpectator).toBe(true);
  });
});
