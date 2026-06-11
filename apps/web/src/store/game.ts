import { create } from "zustand";
import type { ChatMessage, GameAction, GameCard, GameStateView } from "@mtgc/shared";
import { api, ApiError } from "@/lib/api";
import { pollEvery, registerRealtimeStopper } from "@/lib/realtime";

const STATE_POLL_MS = 1500;

interface GameStore {
  state: GameStateView | null;
  chat: ChatMessage[];
  error: string | null;
  connected: boolean;
  joinedId: string | null;

  join: (gameId: string) => Promise<void>;
  act: (action: GameAction) => void;
  undo: () => void;
  endGame: (winnerId: string | null) => void;
  peek: (count: number) => Promise<GameCard[]>;
  sendChat: (text: string) => void;
  leave: () => void;
}

let stopPoll: (() => void) | null = null;
let lastChatTs = 0;

export const useGame = create<GameStore>((set, get) => {
  registerRealtimeStopper(() => {
    stopPoll?.();
    stopPoll = null;
    lastChatTs = 0;
    set({ state: null, chat: [], error: null, connected: false, joinedId: null });
  });

  async function pullChat(gameId: string) {
    const msgs = await api.get<ChatMessage[]>(`/api/games/${gameId}/chat?after=${lastChatTs}`);
    if (msgs.length > 0) {
      lastChatTs = msgs[msgs.length - 1].ts;
      set((s) => ({ chat: [...s.chat, ...msgs] }));
    }
  }

  return {
    state: null,
    chat: [],
    error: null,
    connected: false,
    joinedId: null,

    join: async (gameId) => {
      stopPoll?.();
      lastChatTs = 0;
      set({ state: null, chat: [], error: null, joinedId: gameId });

      stopPoll = pollEvery(STATE_POLL_MS, async () => {
        try {
          const since = get().state?.version;
          const qs = since !== undefined ? `?since=${since}` : "";
          const res = await api.get<{ version: number; state?: GameStateView }>(
            `/api/games/${gameId}/state${qs}`
          );
          if (res.state) set({ state: res.state, connected: true, error: null });
          else set({ connected: true });
          await pullChat(gameId);
        } catch (err) {
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
            set({ error: err.message, connected: true });
            stopPoll?.();
            stopPoll = null;
          } else {
            set({ connected: false });
          }
        }
      });
    },

    act: (action) => {
      const { joinedId } = get();
      if (!joinedId) return;
      void api
        .post<{ state: GameStateView | null }>(`/api/games/${joinedId}/action`, action)
        .then((res) => {
          // Apply the fresh view immediately — no waiting for the next poll.
          if (res.state) set({ state: res.state });
        })
        .catch(() => {});
    },

    undo: () => {
      const { joinedId } = get();
      if (!joinedId) return;
      void api
        .post<{ state: GameStateView | null }>(`/api/games/${joinedId}/undo`)
        .then((res) => {
          if (res.state) set({ state: res.state });
        })
        .catch(() => {});
    },

    endGame: (winnerId) => {
      const { joinedId } = get();
      if (!joinedId) return;
      void api.post(`/api/games/${joinedId}/end`, { winnerId }).catch(() => {});
    },

    peek: async (count) => {
      const { joinedId } = get();
      if (!joinedId) return [];
      try {
        const res = await api.get<{ cards: GameCard[] }>(`/api/games/${joinedId}/peek?count=${count}`);
        return res.cards;
      } catch {
        return [];
      }
    },

    sendChat: (text) => {
      const { joinedId } = get();
      if (!joinedId || !text.trim()) return;
      void api
        .post(`/api/games/${joinedId}/chat`, { text })
        .then(() => pullChat(joinedId))
        .catch(() => {});
    },

    leave: () => {
      stopPoll?.();
      stopPoll = null;
      lastChatTs = 0;
      set({ state: null, chat: [], joinedId: null });
    },
  };
});
