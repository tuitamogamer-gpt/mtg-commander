import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, registerUser, seedCard } from "./helpers.js";

/**
 * One end-to-end flow over the REST/polling API touching most features:
 * auth → commander decks → lobby (+spectator) → start → mulligan → cast
 * commander (tax) → token → undo → scry → commander-damage elimination →
 * end game → match history → lobby room cleaned up.
 */
describe("consolidated e2e (REST)", () => {
  let app: FastifyInstance;
  const CMD = "e2e-cmd-0000-0000-0000-000000000001";
  const LAND = "e2e-land-0000-0000-0000-000000000002";

  beforeAll(async () => {
    app = await makeApp();
    await seedCard(CMD, { name: "Test Commander", colorIdentity: ["R"], typeLine: "Legendary Creature — Goblin" });
    await seedCard(LAND, { name: "Mountain", colorIdentity: ["R"], typeLine: "Basic Land — Mountain" });
  });
  afterAll(async () => {
    await app.close();
  });

  const commanderDeck = (cookie: string) =>
    app
      .inject({
        method: "POST",
        url: "/api/decks",
        headers: { cookie },
        payload: {
          name: "E2E Deck",
          cards: [
            { scryfallId: CMD, name: "Test Commander", quantity: 1, isCommander: true },
            { scryfallId: LAND, name: "Mountain", quantity: 40, isCommander: false },
          ],
        },
      })
      .then((r) => r.json() as { id: string });

  it("runs the full game lifecycle", async () => {
    const host = await registerUser(app);
    const guest = await registerUser(app);
    const spectator = await registerUser(app);
    const hostDeck = await commanderDeck(host.cookie);
    const guestDeck = await commanderDeck(guest.cookie);

    // Lobby: create (spectators on), join, decks, ready, start.
    const room = (await app.inject({
      method: "POST",
      url: "/api/lobby/rooms",
      headers: { cookie: host.cookie },
      payload: { name: "E2E", maxPlayers: 2, settings: { allowSpectators: true } },
    })).json();
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/join`, headers: { cookie: guest.cookie } });
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/deck`, headers: { cookie: host.cookie }, payload: { deckId: hostDeck.id } });
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/deck`, headers: { cookie: guest.cookie }, payload: { deckId: guestDeck.id } });
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/ready`, headers: { cookie: host.cookie }, payload: { ready: true } });
    await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/ready`, headers: { cookie: guest.cookie }, payload: { ready: true } });
    const gameId = (await app.inject({ method: "POST", url: `/api/lobby/rooms/${room.id}/start`, headers: { cookie: host.cookie } })).json().gameId as string;
    expect(gameId).toBeTruthy();

    const state = async (cookie: string) =>
      (await app.inject({ method: "GET", url: `/api/games/${gameId}/state`, headers: { cookie } })).json().state;
    const act = (cookie: string, action: Record<string, unknown>) =>
      app.inject({ method: "POST", url: `/api/games/${gameId}/action`, headers: { cookie }, payload: action });

    let vH = await state(host.cookie);
    const vG = await state(guest.cookie);
    const meH = () => vH.players.find((p: { id: string }) => p.id === vH.viewerId);

    // Commander starts in the command zone.
    expect(meH().zones.command).toHaveLength(1);
    expect(meH().zones.command[0].isCommander).toBe(true);

    // Spectator sees hidden hands.
    const vS = await state(spectator.cookie);
    expect(vS.players.every((p: { zones: { hand: unknown } }) => !Array.isArray(p.zones.hand))).toBe(true);

    // Mulligan then keep.
    await act(host.cookie, { type: "mulligan" });
    vH = await state(host.cookie);
    expect(meH().mulligans).toBe(1);
    await act(host.cookie, { type: "keep_hand", bottom: [] });
    vH = await state(host.cookie);
    expect(meH().keptHand).toBe(true);

    // Cast the commander from the command zone (tax counter increments).
    const cmd = meH().zones.command[0];
    await act(host.cookie, { type: "add_to_stack", instanceId: cmd.instanceId });
    vH = await state(host.cookie);
    expect(vH.stack).toHaveLength(1);
    expect(vH.stack[0].timesCast).toBe(1);

    // Token create, then undo removes it.
    await act(host.cookie, { type: "create_token", scryfallId: "tok:soldier", name: "Soldier 1/1 W", row: "creatures" });
    vH = await state(host.cookie);
    expect(meH().zones.battlefield.some((c: { isToken?: boolean }) => c.isToken)).toBe(true);
    await app.inject({ method: "POST", url: `/api/games/${gameId}/undo`, headers: { cookie: host.cookie } });
    vH = await state(host.cookie);
    expect(meH().zones.battlefield.some((c: { isToken?: boolean }) => c.isToken)).toBe(false);

    // Scry/peek top 3.
    const peek = (await app.inject({ method: "GET", url: `/api/games/${gameId}/peek?count=3`, headers: { cookie: host.cookie } })).json();
    expect(peek.cards).toHaveLength(3);

    // 21 commander damage → elimination flag, then end game with host winning.
    await act(host.cookie, { type: "set_commander_damage", playerId: vG.viewerId, fromPlayerId: vH.viewerId, amount: 21 });
    vH = await state(host.cookie);
    const guestSeat = vH.players.find((p: { id: string }) => p.id === vG.viewerId);
    expect(guestSeat.commanderDamage[vH.viewerId]).toBe(21);

    const ended = await app.inject({
      method: "POST",
      url: `/api/games/${gameId}/end`,
      headers: { cookie: host.cookie },
      payload: { winnerId: vH.viewerId },
    });
    expect(ended.statusCode).toBe(200);

    // Match recorded for the host.
    const matches = (await app.inject({ method: "GET", url: "/api/matches", headers: { cookie: host.cookie } })).json();
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].winnerId).toBe(vH.viewerId);

    // The lobby room is cleaned up — no dead "In progress" table left behind.
    const rooms = (await app.inject({ method: "GET", url: "/api/lobby/rooms", headers: { cookie: host.cookie } })).json();
    expect(rooms.some((r: { id: string }) => r.id === room.id)).toBe(false);
  });
});
