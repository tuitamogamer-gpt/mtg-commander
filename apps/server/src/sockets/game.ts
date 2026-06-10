import type { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import type {
  ChatMessage,
  GameActionMessage,
  GameClientToServer,
  GameServerToClient,
} from "@mtgc/shared";
import { socketAuth } from "./auth.js";
import { roomManager } from "./rooms.js";
import { gameManager } from "../game/manager.js";
import { prisma } from "../db.js";

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

  // When the grace timer fires and a player is auto-skipped, refresh the table.
  gameManager.onAutoSkip = (gameId) => void broadcastState(gameId);

  ns.on("connection", (socket: GameNsSocket) => {
    const user = socket.data.user;
    let joinedGameId: string | null = null;
    let isSpectator = false;

    socket.on("game:join", async ({ gameId }, ack) => {
      const state = await gameManager.load(gameId);
      if (!state) {
        ack?.({ ok: false, error: "Game not found" });
        return;
      }
      const seat = state.players.find((p) => p.id === user.id);
      if (!seat) {
        // Non-seated user: allow read-only spectating if the table permits it.
        if (!state.allowSpectators) {
          ack?.({ ok: false, error: "This table does not allow spectators" });
          return;
        }
        isSpectator = true;
        joinedGameId = gameId;
        void socket.join(gameChannel(gameId));
        const view = gameManager.view(gameId, user.id)!; // viewerId matches no seat → hands hidden
        ack?.({ ok: true, data: view });
        await replayChat(gameId);
        return;
      }

      isSpectator = false;
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
      await replayChat(gameId);
    });

    /** Send the joining socket the recent persisted chat so it survives refresh. */
    async function replayChat(gameId: string) {
      const rows = await prisma.gameChat.findMany({
        where: { gameId },
        orderBy: { ts: "asc" },
        take: 100,
      });
      for (const r of rows) {
        socket.emit("game:chat", {
          id: r.id,
          scope: "game",
          roomId: gameId,
          userId: r.userId,
          username: r.username,
          text: r.text,
          ts: r.ts.getTime(),
          isSpectator: r.isSpectator,
        });
      }
    }

    socket.on("game:request_state", (_payload, ack) => {
      if (!joinedGameId) {
        ack?.({ ok: false, error: "Not in a game" });
        return;
      }
      const view = gameManager.view(joinedGameId, user.id);
      if (view) ack?.({ ok: true, data: view });
      else ack?.({ ok: false, error: "Game not found" });
    });

    socket.on("game:peek", ({ gameId, count }, ack) => {
      if (isSpectator) {
        ack?.({ ok: false, error: "Spectators cannot peek" });
        return;
      }
      const cards = gameManager.peekLibrary(gameId, user.id, count);
      if (cards === null) ack?.({ ok: false, error: "Game not found" });
      else ack?.({ ok: true, data: cards });
    });

    socket.on("game:undo", async ({ gameId }, ack) => {
      if (isSpectator) {
        ack?.({ ok: false, error: "Spectators cannot act" });
        return;
      }
      const restored = gameManager.undo(gameId);
      if (!restored) {
        ack?.({ ok: false, error: "Nothing to undo" });
        return;
      }
      await broadcastState(gameId);
      ns.to(gameChannel(gameId)).emit("game:log", {
        ts: Date.now(),
        playerId: user.id,
        message: `${user.username} undid the last action.`,
      });
      ack?.({ ok: true, data: null });
    });

    socket.on("game:action", async (payload: GameActionMessage, ack) => {
      if (isSpectator) {
        ack?.({ ok: false, error: "Spectators cannot act" });
        return;
      }
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
        isSpectator,
      };
      ns.to(gameChannel(gameId)).emit("game:chat", msg);
      // Persist so the chat survives a refresh / reconnect.
      void prisma.gameChat
        .create({
          data: {
            gameId,
            userId: user.id,
            username: user.username,
            text: msg.text,
            isSpectator,
          },
        })
        .catch(() => {});
    });

    socket.on("game:end", async ({ gameId, winnerId }, ack) => {
      if (isSpectator) {
        ack?.({ ok: false, error: "Spectators cannot end the game" });
        return;
      }
      const state = await gameManager.load(gameId);
      if (!state) {
        ack?.({ ok: false, error: "Game not found" });
        return;
      }
      const winner = state.players.find((p) => p.id === winnerId) ?? null;
      await prisma.match.create({
        data: {
          gameId,
          playerIds: JSON.stringify(state.players.map((p) => p.id)),
          participants: JSON.stringify(state.players.map((p) => ({ id: p.id, username: p.username }))),
          winnerId: winner?.id ?? null,
          winnerName: winner?.username ?? null,
          turns: state.turn,
        },
      });
      state.status = "finished";
      await gameManager.persist(state);
      // The lobby room has served its purpose — drop it so the lobby list
      // doesn't accumulate dead "In progress" tables.
      roomManager.remove(state.roomId);
      io.of("/lobby").emit("lobby:rooms", roomManager.list());
      ns.to(gameChannel(gameId)).emit("game:log", {
        ts: Date.now(),
        playerId: user.id,
        message: winner ? `Game over — ${winner.username} wins!` : "Game ended.",
      });
      await broadcastState(gameId);
      ack?.({ ok: true, data: null });
    });

    socket.on("disconnect", () => {
      if (!joinedGameId || isSpectator) return;
      gameManager.setConnected(joinedGameId, user.id, false);
      socket.to(gameChannel(joinedGameId)).emit("game:player_connection", {
        playerId: user.id,
        connected: false,
      });
      void broadcastState(joinedGameId);
    });
  });
}
