import type { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import type {
  ChatMessage,
  LobbyClientToServer,
  LobbyServerToClient,
  Room,
} from "@mtgc/shared";
import { socketAuth } from "./auth.js";
import { roomManager } from "./rooms.js";
import { gameManager } from "../game/manager.js";
import { prisma } from "../db.js";

type LobbySocket = Socket<LobbyClientToServer, LobbyServerToClient>;

const roomChannel = (roomId: string) => `room:${roomId}`;

export function registerLobbyNamespace(io: Server): void {
  const lobby = io.of("/lobby");
  lobby.use(socketAuth);

  lobby.on("connection", (socket: LobbySocket) => {
    const user = socket.data.user;
    // Tracks which room this socket has joined, for cleanup on disconnect.
    let currentRoomId: string | null = null;

    const broadcastRoom = (room: Room) => {
      lobby.to(roomChannel(room.id)).emit("lobby:room_updated", room);
    };
    const broadcastRooms = () => {
      lobby.emit("lobby:rooms", roomManager.list());
    };

    socket.on("lobby:list_rooms", (ack) => {
      ack?.(roomManager.list());
    });

    socket.on("lobby:create_room", ({ name, maxPlayers, settings }, ack) => {
      try {
        const room = roomManager.create(user, name, maxPlayers, settings);
        currentRoomId = room.id;
        void socket.join(roomChannel(room.id));
        broadcastRooms();
        ack?.({ ok: true, data: room });
      } catch (err) {
        ack?.({ ok: false, error: errMsg(err) });
      }
    });

    socket.on("lobby:join_room", ({ roomId }, ack) => {
      try {
        const room = roomManager.join(roomId, user);
        currentRoomId = roomId;
        void socket.join(roomChannel(roomId));
        broadcastRoom(room);
        broadcastRooms();
        ack?.({ ok: true, data: room });
      } catch (err) {
        ack?.({ ok: false, error: errMsg(err) });
      }
    });

    socket.on("lobby:leave_room", ({ roomId }, ack) => {
      const room = roomManager.leave(roomId, user.id);
      void socket.leave(roomChannel(roomId));
      currentRoomId = null;
      if (room) broadcastRoom(room);
      broadcastRooms();
      ack?.({ ok: true, data: null });
    });

    socket.on("lobby:set_deck", async ({ roomId, deckId }, ack) => {
      try {
        // Verify the deck belongs to this user.
        const deck = await prisma.deck.findFirst({ where: { id: deckId, userId: user.id } });
        if (!deck) throw new Error("Deck not found");
        const room = roomManager.setDeck(roomId, user.id, deckId, deck.name);
        broadcastRoom(room);
        ack?.({ ok: true, data: room });
      } catch (err) {
        ack?.({ ok: false, error: errMsg(err) });
      }
    });

    socket.on("lobby:ready", ({ roomId, ready }, ack) => {
      try {
        const room = roomManager.setReady(roomId, user.id, ready);
        broadcastRoom(room);
        ack?.({ ok: true, data: room });
      } catch (err) {
        ack?.({ ok: false, error: errMsg(err) });
      }
    });

    socket.on("lobby:start_game", async ({ roomId }, ack) => {
      try {
        const room = roomManager.get(roomId);
        if (!room) throw new Error("Room not found");
        if (room.hostId !== user.id) throw new Error("Only the host can start the game");
        const blocker = roomManager.canStart(room);
        if (blocker) throw new Error(blocker);

        const state = await gameManager.createGame(room);
        const updated = roomManager.markStarted(roomId, state.id);
        broadcastRoom(updated);
        broadcastRooms();
        lobby.to(roomChannel(roomId)).emit("lobby:game_started", { gameId: state.id });
        ack?.({ ok: true, data: { gameId: state.id } });
      } catch (err) {
        ack?.({ ok: false, error: errMsg(err) });
      }
    });

    socket.on("lobby:chat", ({ roomId, text }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const msg: ChatMessage = {
        id: nanoid(8),
        scope: "lobby",
        roomId,
        userId: user.id,
        username: user.username,
        text: trimmed.slice(0, 500),
        ts: Date.now(),
      };
      lobby.to(roomChannel(roomId)).emit("lobby:chat", msg);
    });

    socket.on("disconnect", () => {
      if (!currentRoomId) return;
      const room = roomManager.get(currentRoomId);
      // Leave the lobby room only if the game hasn't started (mid-game
      // disconnects are handled by the game namespace, which holds the seat).
      if (room && room.status === "waiting") {
        const updated = roomManager.leave(currentRoomId, user.id);
        if (updated) broadcastRoom(updated);
        broadcastRooms();
      }
    });
  });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}
