import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Server as SocketServer } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { buildApp } from "../src/app.js";
import { registerSockets } from "../src/sockets/index.js";
import { registerUser } from "./helpers.js";

describe("lobby sockets", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let io: SocketServer;
  let url: string;
  const clients: Socket[] = [];

  beforeAll(async () => {
    app = await buildApp();
    io = new SocketServer(app.server);
    registerSockets(io);
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address() as AddressInfo;
    url = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    clients.forEach((c) => c.close());
    await io.close();
    await app.close();
  });

  function connect(cookie: string): Promise<Socket> {
    const socket = ioClient(`${url}/lobby`, {
      transports: ["websocket"],
      extraHeaders: { Cookie: cookie },
      forceNew: true,
    });
    clients.push(socket);
    return new Promise((resolve, reject) => {
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", reject);
    });
  }
  const ack = <T>(s: Socket, ev: string, p: unknown): Promise<T> =>
    new Promise((r) => s.emit(ev, p, r));

  it("rejects an unauthenticated socket", async () => {
    const socket = ioClient(`${url}/lobby`, { transports: ["websocket"], forceNew: true });
    clients.push(socket);
    await expect(
      new Promise((_res, rej) => {
        socket.on("connect", () => rej(new Error("should not connect")));
        socket.on("connect_error", (e) => rej(e));
        setTimeout(() => rej(new Error("connect_error")), 2000);
      })
    ).rejects.toBeTruthy();
  });

  it("runs a full create → join → ready → start flow", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const deckA = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: a.cookie }, payload: { name: "A", cards: [] } })).json();
    const deckB = (await app.inject({ method: "POST", url: "/api/decks", headers: { cookie: b.cookie }, payload: { name: "B", cards: [] } })).json();

    const sa = await connect(a.cookie);
    const sb = await connect(b.cookie);

    const created = await ack<{ ok: boolean; data: { id: string } }>(sa, "lobby:create_room", { name: "Test", maxPlayers: 2 });
    expect(created.ok).toBe(true);
    const roomId = created.data.id;

    const joined = await ack<{ ok: boolean; data: { players: unknown[] } }>(sb, "lobby:join_room", { roomId });
    expect(joined.data.players).toHaveLength(2);

    await ack(sa, "lobby:set_deck", { roomId, deckId: deckA.id });
    await ack(sb, "lobby:set_deck", { roomId, deckId: deckB.id });
    await ack(sa, "lobby:ready", { roomId, ready: true });
    await ack(sb, "lobby:ready", { roomId, ready: true });

    // Non-host cannot start.
    const badStart = await ack<{ ok: boolean }>(sb, "lobby:start_game", { roomId });
    expect(badStart.ok).toBe(false);

    const start = await ack<{ ok: boolean; data: { gameId: string } }>(sa, "lobby:start_game", { roomId });
    expect(start.ok).toBe(true);
    expect(start.data.gameId).toBeTruthy();
  });
});
