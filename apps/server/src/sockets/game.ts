import type { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import type {
  ChatMessage,
  GameActionMessage,
  GameClientToServer,
  GameServerToClient,
} from "@mtgc/shared";
import { socketAuth } from "./auth.js";
import { gameManager } from "../game/manager.js";

type GameNsSocket = Socket<GameClientToServer, GameServerToClient>;

const gameChannel = (gameId: string) => `game:${gameId}`;

export function registerGameNamespace(io: Server): void {
  const ns = io.of("/game");
  ns.use(socketAuth);

  /** Push each player their own redacted view of the game. */
  const broadcastState = async (gameId: string) => {
    const sockets = await ns.in(gameChannel(gameId)).fetchSockets();
    for (const s of sockets) {
      const view = gameManager.view(gameId, s.data.user.id);
      if (view) s.emit("game:state", view);
    }
  };

  ns.on("connection", (socket: GameNsSocket) => {
    const user = socket.data.user;
    let joinedGameId: string | null = null;

    socket.on("game:join", async ({ gameId }, ack) => {
      const state = await gameManager.load(gameId);
      if (!state) {
        ack?.({ ok: false, error: "Game not found" });
        return;
      }
      const seat = state.players.find((p) => p.id === user.id);
      if (!seat) {
        ack?.({ ok: false, error: "You are not a player in this game" });
        return;
      }
      joinedGameId = gameId;
      void socket.join(gameChannel(gameId));
      gameManager.setConnected(gameId, user.id, true);

      const view = gameManager.view(gameId, user.id)!;
      ack?.({ ok: true, data: view });
      socket.to(gameChannel(gameId)).emit("game:player_connection", {
        playerId: user.id,
        connected: true,
      });
      // Let everyone refresh connection flags.
      void broadcastState(gameId);
    });

    socket.on("game:request_state", (_payload, ack) => {
      if (!joinedGameId) {
        ack?.({ ok: false, error: "Not in a game" });
        return;
      }
      const view = gameManager.view(joinedGameId, user.id);
      if (view) ack?.({ ok: true, data: view });
      else ack?.({ ok: false, error: "Game not found" });
    });

    socket.on("game:action", async (payload: GameActionMessage, ack) => {
      const logs = gameManager.apply(payload.gameId, user.id, payload.action);
      if (logs === null) {
        ack?.({ ok: false, error: "Game not found" });
        return;
      }
      await broadcastState(payload.gameId);
      for (const message of logs) {
        ns.to(gameChannel(payload.gameId)).emit("game:log", {
          ts: Date.now(),
          playerId: user.id,
          message,
        });
      }
      ack?.({ ok: true, data: null });
    });

    socket.on("game:chat", ({ gameId, text }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const msg: ChatMessage = {
        id: nanoid(8),
        scope: "game",
        roomId: gameId,
        userId: user.id,
        username: user.username,
        text: trimmed.slice(0, 500),
        ts: Date.now(),
      };
      ns.to(gameChannel(gameId)).emit("game:chat", msg);
    });

    socket.on("disconnect", () => {
      if (!joinedGameId) return;
      gameManager.setConnected(joinedGameId, user.id, false);
      socket.to(gameChannel(joinedGameId)).emit("game:player_connection", {
        playerId: user.id,
        connected: false,
      });
      void broadcastState(joinedGameId);
    });
  });
}
