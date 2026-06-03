import { create } from "zustand";
import type { Zone } from "@mtgc/shared";

/** The card currently under the cursor, for keyboard shortcuts that act on
 * "the card I'm pointing at" (cast, tap, move, counters). Set immediately on
 * mouse-enter (no delay), unlike the zoom-preview hover. */
export interface FocusedCard {
  instanceId: string;
  scryfallId: string;
  owned: boolean;
  zone: Zone;
  tapped: boolean;
  faceDown: boolean;
}

interface FocusState {
  card: FocusedCard | null;
  setCard: (c: FocusedCard) => void;
  clearCard: (instanceId: string) => void;
}

export const useFocus = create<FocusState>((set, get) => ({
  card: null,
  setCard: (c) => set({ card: c }),
  // Only clear if we're still pointing at the same card (avoids races between
  // a leave on one card and an enter on the next).
  clearCard: (instanceId) => {
    if (get().card?.instanceId === instanceId) set({ card: null });
  },
}));
