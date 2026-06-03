import { create } from "zustand";
import type { ChatMessage, Room, RoomSummary, RoomSettings } from "@mtgc/shared";
import { getLobbySocket, emitAck, type LobbySocket } from "@/lib/socket";

interface LobbyState {
  connected: boolean;
  rooms: RoomSummary[];
  room: Room | null;
  chat: ChatMessage[];
  /** Set when start_game fires so the room page can navigate. */
  startedGameId: string | null;

  init: () => void;
  refreshRooms: () => void;
  createRoom: (
    name: string,
    maxPlayers: number,
    settings?: Partial<RoomSettings>
  ) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<Room>;
  leaveRoom: (roomId: string) => void;
  setDeck: (roomId: string, deckId: string) => Promise<void>;
  setReady: (roomId: string, ready: boolean) => Promise<void>;
  startGame: (roomId: string) => Promise<string>;
  sendChat: (roomId: string, text: string) => void;
  clearStarted: () => void;
}

// Tracks which socket instance we've wired listeners to; re-wires after a
// resetSockets() (login/logout) creates a fresh socket.
let wiredSocket: LobbySocket | null = null;

export const useLobby = create<LobbyState>((set, get) => ({
  connected: false,
  rooms: [],
  room: null,
  chat: [],
  startedGameId: null,

  init: () => {
    const socket = getLobbySocket();
    if (wiredSocket === socket) {
      if (socket.connected) {
        set({ connected: true });
        get().refreshRooms();
      }
      return;
    }
    wiredSocket = socket;
    // Fresh socket (new user) → clear any stale lobby state.
    set({ rooms: [], room: null, chat: [], startedGameId: null });

    socket.on("connect", () => {
      set({ connected: true });
      get().refreshRooms();
    });
    socket.on("disconnect", () => set({ connected: false }));
    socket.on("lobby:rooms", (rooms) => set({ rooms }));
    socket.on("lobby:room_updated", (room) => {
      // Only track the room we're currently viewing.
      const current = get().room;
      if (!current || current.id === room.id) set({ room });
    });
    socket.on("lobby:chat", (msg) => set((s) => ({ chat: [...s.chat, msg] })));
    socket.on("lobby:game_started", ({ gameId }) => set({ startedGameId: gameId }));

    if (socket.connected) {
      set({ connected: true });
      get().refreshRooms();
    }
  },

  refreshRooms: () => {
    getLobbySocket().emit("lobby:list_rooms", (rooms: RoomSummary[]) => set({ rooms }));
  },

  createRoom: async (name, maxPlayers, settings) => {
    const res = await emitAck<Room>(getLobbySocket(), "lobby:create_room", {
      name,
      maxPlayers,
      settings,
    });
    if (!res.ok) throw new Error(res.error);
    set({ room: res.data, chat: [] });
    return res.data;
  },

  joinRoom: async (roomId) => {
    const res = await emitAck<Room>(getLobbySocket(), "lobby:join_room", { roomId });
    if (!res.ok) throw new Error(res.error);
    set({ room: res.data, chat: [] });
    return res.data;
  },

  leaveRoom: (roomId) => {
    getLobbySocket().emit("lobby:leave_room", { roomId }, () => {});
    set({ room: null, chat: [] });
  },

  setDeck: async (roomId, deckId) => {
    const res = await emitAck<Room>(getLobbySocket(), "lobby:set_deck", { roomId, deckId });
    if (!res.ok) throw new Error(res.error);
    set({ room: res.data });
  },

  setReady: async (roomId, ready) => {
    const res = await emitAck<Room>(getLobbySocket(), "lobby:ready", { roomId, ready });
    if (!res.ok) throw new Error(res.error);
    set({ room: res.data });
  },

  startGame: async (roomId) => {
    const res = await emitAck<{ gameId: string }>(getLobbySocket(), "lobby:start_game", {
      roomId,
    });
    if (!res.ok) throw new Error(res.error);
    return res.data.gameId;
  },

  sendChat: (roomId, text) => {
    getLobbySocket().emit("lobby:chat", { roomId, text });
  },

  clearStarted: () => set({ startedGameId: null }),
}));
