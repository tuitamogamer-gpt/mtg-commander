import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Server as SocketServer } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { buildApp } from "../src/app.js";
import { registerSockets } from "../src/sockets/index.js";
import { registerUser } from "./helpers.js";

describe("game sockets", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let io: SocketServer;
  let url: string;
  const clients: Socket[] = [];

  beforeAll(async () => {
    app = await buildApp();
    io = new SocketServer(app.server);
    registerSockets(io);
    await app.listen({ port: 0, host: "127.0.0.1" });
    url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
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

  async function startGame() {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const dA = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: a.cookie }, payload: { name: "A", cards: [] } })).json();
    const dB = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: b.cookie }, payload: { name: "B", cards: [] } })).json();
    const la = await connect("/lobby", a.cookie);
    const lb = await connect("/lobby", b.cookie);
    const room = (await ack<{ data: { id: string } }>(la, "lobby:create_room", { name: "G", maxPlayers: 2 })).data;
    await ack(lb, "lobby:join_room", { roomId: room.id });
    await ack(la, "lobby:set_deck", { roomId: room.id, deckId: dA.id });
    await ack(lb, "lobby:set_deck", { roomId: room.id, deckId: dB.id });
    await ack(la, "lobby:ready", { roomId: room.id, ready: true });
    await ack(lb, "lobby:ready", { roomId: room.id, ready: true });
    const start = await ack<{ data: { gameId: string } }>(la, "lobby:start_game", { roomId: room.id });
    return { gameId: start.data.gameId, a, b };
  }

  it("lets a seated player join and receives a redacted view", async () => {
    const { gameId, a } = await startGame();
    const ga = await connect("/game", a.cookie);
    const res = await ack<{ ok: boolean; data: { viewerId: string; players: unknown[] } }>(ga, "game:join", { gameId });
    expect(res.ok).toBe(true);
    expect(res.data.players.length).toBe(2);
  });

  it("rejects a non-player, peek, and reflects an action", async () => {
    const { gameId, a } = await startGame();
    const ga = await connect("/game", a.cookie);
    await ack(ga, "game:join", { gameId });

    const peek = await ack<{ ok: boolean; data: unknown[] }>(ga, "game:peek", { gameId, count: 3 });
    expect(peek.ok).toBe(true);

    // A non-seated user may spectate (default allowSpectators) but cannot act.
    const outsider = await registerUser(app);
    const gx = await connect("/game", outsider.cookie);
    const spec = await ack<{ ok: boolean }>(gx, "game:join", { gameId });
    expect(spec.ok).toBe(true);
    const blocked = await ack<{ ok: boolean }>(gx, "game:action", { gameId, action: { type: "draw", count: 1 } });
    expect(blocked.ok).toBe(false);

    const before = await ack<{ ok: boolean; data: { players: { id: string; zones: { library: { count: number } } }[]; viewerId: string } }>(
      ga,
      "game:request_state",
      { gameId }
    );
    const libBefore = before.data.players.find((p) => p.id === before.data.viewerId)!.zones.library.count;

    const ok = await ack<{ ok: boolean }>(ga, "game:action", { gameId, action: { type: "draw", count: 1 } });
    expect(ok.ok).toBe(true);

    // Undo restores the pre-draw library count.
    const undone = await ack<{ ok: boolean }>(ga, "game:undo", { gameId });
    expect(undone.ok).toBe(true);
    const after = await ack<{ ok: boolean; data: { players: { id: string; zones: { library: { count: number } } }[]; viewerId: string } }>(
      ga,
      "game:request_state",
      { gameId }
    );
    const libAfter = after.data.players.find((p) => p.id === after.data.viewerId)!.zones.library.count;
    expect(libAfter).toBe(libBefore);
  });
});
