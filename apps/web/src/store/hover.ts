import { create } from "zustand";

interface HoverState {
  scryfallId: string | null;
  x: number;
  y: number;
  show: (scryfallId: string, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
  /** Hide only when the active preview belongs to the given card. */
  hideIf: (scryfallId: string) => void;
}

/** Global card zoom-preview state, driven by the useCardHover hook. */
export const useHover = create<HoverState>((set, get) => ({
  scryfallId: null,
  x: 0,
  y: 0,
  show: (scryfallId, x, y) => set({ scryfallId, x, y }),
  move: (x, y) => set((s) => (s.scryfallId ? { x, y } : s)),
  hide: () => set({ scryfallId: null }),
  // Hide only if the preview still belongs to this card — an unmounting card
  // must not kill the preview of whatever the cursor moved on to.
  hideIf: (scryfallId) => {
    if (get().scryfallId === scryfallId) set({ scryfallId: null });
  },
}));
