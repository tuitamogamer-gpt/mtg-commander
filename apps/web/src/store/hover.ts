import { create } from "zustand";

interface HoverState {
  scryfallId: string | null;
  x: number;
  y: number;
  show: (scryfallId: string, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
}

/** Global card zoom-preview state, driven by the useCardHover hook. */
export const useHover = create<HoverState>((set) => ({
  scryfallId: null,
  x: 0,
  y: 0,
  show: (scryfallId, x, y) => set({ scryfallId, x, y }),
  move: (x, y) => set((s) => (s.scryfallId ? { x, y } : s)),
  hide: () => set({ scryfallId: null }),
}));
