import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Server as SocketServer } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { buildApp } from "../src/app.js";
import { registerSockets } from "../src/sockets/index.js";
import { registerUser, seedCard } from "./helpers.js";

/**
 * One end-to-end flow that touches most phases: auth → deck with a commander →
 * lobby (+spectator) → start → mulligan → cast commander (tax) → token → undo →
 * scry → commander-damage elimination → end game → match history.
 */
describe("consolidated e2e", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let io: SocketServer;
  let url: string;
  const clients: Socket[] = [];

  const CMD = "e2e-cmd-0000-0000-0000-000000000001";
  const LAND = "e2e-land-0000-0000-0000-000000000002";

  beforeAll(async () => {
    app = await buildApp();
    io = new SocketServer(app.server);
    registerSockets(io);
    await app.listen({ port: 0, host: "127.0.0.1" });
    url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    // Cache cards so deck creation computes color identity offline.
    await seedCard(CMD, { name: "Test Commander", colorIdentity: ["R"], typeLine: "Legendary Creature — Goblin" });
    await seedCard(LAND, { name: "Mountain", colorIdentity: ["R"], typeLine: "Basic Land — Mountain" });
  });
  afterAll(async () => {
    clients.forEach((c) => c.close());
    await io.close();
    await app.close();
  });

  const connect = (ns: string, cookie: string): Promise<Socket> => {
    const s = ioClient(`${url}${ns}`, { transports: ["websocket"], extraHeaders: { Cookie: cookie }, forceNew: true });
    clients.push(s);
    return new Promise((res, rej) => {
      s.on("connect", () => res(s));
      s.on("connect_error", rej);
    });
  };
  const ack = <T>(s: Socket, ev: string, p: unknown): Promise<T> => new Promise((r) => s.emit(ev, p, r));
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function commanderDeck(cookie: string) {
    return app.inject({
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
    }).then((r) => r.json() as { id: string });
  }

  it("runs the full game lifecycle", async () => {
    // --- auth + decks (3 deck-ish setups; commander deck for the two players) ---
    const host = await registerUser(app);
    const guest = await registerUser(app);
    const spectator = await registerUser(app);
    const hostDeck = await commanderDeck(host.cookie);
    const guestDeck = await commanderDeck(guest.cookie);
    expect(hostDeck.id).toBeTruthy();

    // --- lobby: create (spectators on), join, decks, ready, start ---
    const lh = await connect("/lobby", host.cookie);
    const lg = await connect("/lobby", guest.cookie);
    const room = (await ack<{ data: { id: string } }>(lh, "lobby:create_room", { name: "E2E", maxPlayers: 2, settings: { allowSpectators: true } })).data;
    await ack(lg, "lobby:join_room", { roomId: room.id });
    await ack(lh, "lobby:set_deck", { roomId: room.id, deckId: hostDeck.id });
    await ack(lg, "lobby:set_deck", { roomId: room.id, deckId: guestDeck.id });
    await ack(lh, "lobby:ready", { roomId: room.id, ready: true });
    await ack(lg, "lobby:ready", { roomId: room.id, ready: true });
    const gameId = (await ack<{ data: { gameId: string } }>(lh, "lobby:start_game", { roomId: room.id })).data.gameId;
    expect(gameId).toBeTruthy();

    // --- game join (host, guest, spectator) ---
    const gh = await connect("/game", host.cookie);
    const gg = await connect("/game", guest.cookie);
    const gs = await connect("/game", spectator.cookie);
    let vH = (await ack<{ ok: boolean; data: any }>(gh, "game:join", { gameId })).data;
    const vG = (await ack<{ ok: boolean; data: any }>(gg, "game:join", { gameId })).data;
    const spec = await ack<{ ok: boolean; data: any }>(gs, "game:join", { gameId });
    gh.on("game:state", (s) => (vH = s));

    const meH = () => vH.players.find((p: any) => p.id === vH.viewerId);

    // Commander starts in the command zone (scenario 1).
    expect(meH().zones.command.length).toBe(1);
    expect(meH().zones.command[0].isCommander).toBe(true);

    // Spectator sees hidden hands (scenario: limited info).
    expect(spec.ok).toBe(true);
    expect(spec.data.players.every((p: any) => !Array.isArray(p.zones.hand))).toBe(true);

    // Mulligan then keep (scenario).
    gh.emit("game:action", { gameId, action: { type: "mulligan" } });
    await wait(120);
    expect(meH().mulligans).toBe(1);
    gh.emit("game:action", { gameId, action: { type: "keep_hand", bottom: [] } });
    await wait(120);
    expect(meH().keptHand).toBe(true);

    // Cast commander from the command zone (tax 0, timesCast → 1).
    const cmd = meH().zones.command[0];
    gh.emit("game:action", { gameId, action: { type: "add_to_stack", instanceId: cmd.instanceId } });
    await wait(150);
    expect(vH.stack.length).toBe(1);
    expect(vH.stack[0].timesCast).toBe(1);

    // Create a token, then undo it (scenarios).
    gh.emit("game:action", { gameId, action: { type: "create_token", scryfallId: "tok:soldier", name: "Soldier 1/1 W", row: "creatures" } });
    await wait(120);
    expect(meH().zones.battlefield.some((c: any) => c.isToken)).toBe(true);
    gh.emit("game:undo", { gameId });
    await wait(150);
    expect(meH().zones.battlefield.some((c: any) => c.isToken)).toBe(false);

    // Scry / peek top 3 (scenario).
    const peek = await ack<{ ok: boolean; data: unknown[] }>(gh, "game:peek", { gameId, count: 3 });
    expect(peek.ok).toBe(true);
    expect(peek.data.length).toBe(3);

    // Commander-damage elimination → end game with host as winner (scenarios).
    gh.emit("game:action", { gameId, action: { type: "set_commander_damage", playerId: vG.viewerId, fromPlayerId: vH.viewerId, amount: 21 } });
    await wait(120);
    const guestSeat = vH.players.find((p: any) => p.id === vG.viewerId);
    expect(guestSeat.commanderDamage[vH.viewerId]).toBe(21);

    const ended = await ack<{ ok: boolean }>(gh, "game:end", { gameId, winnerId: vH.viewerId });
    expect(ended.ok).toBe(true);

    // Match appears in the host's history (scenario).
    await wait(120);
    const matches = (await app.inject({ method: "GET", url: "/api/matches", headers: { cookie: host.cookie } })).json();
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].winnerId).toBe(vH.viewerId);
  });
});
