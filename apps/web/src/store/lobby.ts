import { create } from "zustand";
import type { ChatMessage, Room, RoomSummary, RoomSettings } from "@mtgc/shared";
import { api } from "@/lib/api";
import { pollEvery, registerRealtimeStopper } from "@/lib/realtime";

const ROOMS_POLL_MS = 2500;
const ROOM_POLL_MS = 1800;

interface LobbyState {
  connected: boolean;
  rooms: RoomSummary[];
  room: Room | null;
  chat: ChatMessage[];
  /** Set when the polled room reports the game started, so the page can navigate. */
  startedGameId: string | null;

  /** Start polling the open-rooms list (idempotent). */
  init: () => void;
  /** Stop the open-rooms list poll (page unmount). */
  stopRooms: () => void;
  refreshRooms: () => void;
  createRoom: (name: string, maxPlayers: number, settings?: Partial<RoomSettings>) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<Room>;
  leaveRoom: (roomId: string) => void;
  setDeck: (roomId: string, deckId: string) => Promise<void>;
  setReady: (roomId: string, ready: boolean) => Promise<void>;
  startGame: (roomId: string) => Promise<string>;
  sendChat: (roomId: string, text: string) => void;
  clearStarted: () => void;
}

let stopRoomsPoll: (() => void) | null = null;
let stopRoomPoll: (() => void) | null = null;
let lastChatTs = 0;

function stopAll() {
  stopRoomsPoll?.();
  stopRoomsPoll = null;
  stopRoomPoll?.();
  stopRoomPoll = null;
  lastChatTs = 0;
}

export const useLobby = create<LobbyState>((set) => {
  registerRealtimeStopper(() => {
    stopAll();
    set({ connected: false, rooms: [], room: null, chat: [], startedGameId: null });
  });

  /** Begin polling one room (state + chat); replaces any previous room poll. */
  function watchRoom(roomId: string) {
    stopRoomPoll?.();
    lastChatTs = 0;
    stopRoomPoll = pollEvery(ROOM_POLL_MS, async () => {
      try {
        const room = await api.get<Room>(`/api/lobby/rooms/${roomId}`);
        set({ room, connected: true });
        if (room.status === "in_game" && room.gameId) set({ startedGameId: room.gameId });
        const msgs = await api.get<ChatMessage[]>(`/api/lobby/rooms/${roomId}/chat?after=${lastChatTs}`);
        if (msgs.length > 0) {
          lastChatTs = msgs[msgs.length - 1].ts;
          set((s) => ({ chat: [...s.chat, ...msgs] }));
        }
      } catch {
        set({ connected: false });
      }
    });
  }

  return {
    connected: false,
    rooms: [],
    room: null,
    chat: [],
    startedGameId: null,

    init: () => {
      if (stopRoomsPoll) return;
      stopRoomsPoll = pollEvery(ROOMS_POLL_MS, async () => {
        try {
          set({ rooms: await api.get<RoomSummary[]>("/api/lobby/rooms"), connected: true });
        } catch {
          set({ connected: false });
        }
      });
    },

    stopRooms: () => {
      stopRoomsPoll?.();
      stopRoomsPoll = null;
    },

    refreshRooms: () => {
      void api
        .get<RoomSummary[]>("/api/lobby/rooms")
        .then((rooms) => set({ rooms, connected: true }))
        .catch(() => set({ connected: false }));
    },

    createRoom: async (name, maxPlayers, settings) => {
      const room = await api.post<Room>("/api/lobby/rooms", { name, maxPlayers, settings });
      set({ room, chat: [], startedGameId: null });
      watchRoom(room.id);
      return room;
    },

    joinRoom: async (roomId) => {
      const room = await api.post<Room>(`/api/lobby/rooms/${roomId}/join`);
      set({ room, chat: [], startedGameId: null });
      watchRoom(roomId);
      return room;
    },

    leaveRoom: (roomId) => {
      stopRoomPoll?.();
      stopRoomPoll = null;
      void api.post(`/api/lobby/rooms/${roomId}/leave`).catch(() => {});
      set({ room: null, chat: [], startedGameId: null });
    },

    setDeck: async (roomId, deckId) => {
      const room = await api.post<Room>(`/api/lobby/rooms/${roomId}/deck`, { deckId });
      set({ room });
    },

    setReady: async (roomId, ready) => {
      const room = await api.post<Room>(`/api/lobby/rooms/${roomId}/ready`, { ready });
      set({ room });
    },

    startGame: async (roomId) => {
      const res = await api.post<{ gameId: string }>(`/api/lobby/rooms/${roomId}/start`);
      return res.gameId;
    },

    sendChat: (roomId, text) => {
      void api
        .post(`/api/lobby/rooms/${roomId}/chat`, { text })
        .then(async () => {
          // Pull immediately so the sender sees their message without a poll wait.
          const msgs = await api.get<ChatMessage[]>(`/api/lobby/rooms/${roomId}/chat?after=${lastChatTs}`);
          if (msgs.length > 0) {
            lastChatTs = msgs[msgs.length - 1].ts;
            set((s) => ({ chat: [...s.chat, ...msgs] }));
          }
        })
        .catch(() => {});
    },

    clearStarted: () => set({ startedGameId: null }),
  };
});
