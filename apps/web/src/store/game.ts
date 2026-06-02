import { create } from "zustand";
import type { ChatMessage, GameAction, GameCard, GameStateView } from "@mtgc/shared";
import { getGameSocket, emitAck } from "@/lib/socket";

interface GameStore {
  state: GameStateView | null;
  chat: ChatMessage[];
  error: string | null;
  connected: boolean;
  joinedId: string | null;

  join: (gameId: string) => Promise<void>;
  act: (action: GameAction) => void;
  undo: () => void;
  peek: (count: number) => Promise<GameCard[]>;
  sendChat: (text: string) => void;
  leave: () => void;
}

let wired = false;

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  chat: [],
  error: null,
  connected: false,
  joinedId: null,

  join: async (gameId) => {
    const socket = getGameSocket();
    if (!wired) {
      wired = true;
      socket.on("connect", () => {
        set({ connected: true });
        // On a reconnect, silently re-join to restore the live state.
        const { joinedId } = get();
        if (joinedId) {
          emitAck<GameStateView>(socket, "game:join", { gameId: joinedId }).then((res) => {
            if (res.ok) set({ state: res.data, error: null });
          });
        }
      });
      socket.on("disconnect", () => set({ connected: false }));
      socket.on("game:state", (state) => set({ state }));
      socket.on("game:chat", (msg) => set((s) => ({ chat: [...s.chat, msg] })));
      socket.on("game:error", (error) => set({ error }));
    }

    const doJoin = async () => {
      const res = await emitAck<GameStateView>(socket, "game:join", { gameId });
      if (res.ok) set({ state: res.data, joinedId: gameId, error: null, connected: true });
      else set({ error: res.error });
    };

    if (socket.connected) await doJoin();
    else socket.once("connect", () => void doJoin());
  },

  act: (action) => {
    const { joinedId } = get();
    if (!joinedId) return;
    getGameSocket().emit("game:action", { gameId: joinedId, action });
  },

  undo: () => {
    const { joinedId } = get();
    if (joinedId) getGameSocket().emit("game:undo", { gameId: joinedId });
  },

  peek: async (count) => {
    const { joinedId } = get();
    if (!joinedId) return [];
    const res = await emitAck<GameCard[]>(getGameSocket(), "game:peek", {
      gameId: joinedId,
      count,
    });
    return res.ok ? res.data : [];
  },

  sendChat: (text) => {
    const { joinedId } = get();
    if (!joinedId || !text.trim()) return;
    getGameSocket().emit("game:chat", { gameId: joinedId, text });
  },

  leave: () => {
    set({ state: null, chat: [], joinedId: null });
  },
}));
