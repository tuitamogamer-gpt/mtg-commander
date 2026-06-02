import { create } from "zustand";
import type { Card } from "@mtgc/shared";
import { api } from "@/lib/api";

interface CardStore {
  cards: Record<string, Card>;
  pending: Set<string>;
  /** Ensure card data is loaded for these scryfall ids (batched). */
  ensure: (ids: string[]) => Promise<void>;
}

export const useCards = create<CardStore>((set, get) => ({
  cards: {},
  pending: new Set(),

  ensure: async (ids) => {
    const { cards, pending } = get();
    const missing = [...new Set(ids)].filter((id) => !cards[id] && !pending.has(id));
    if (missing.length === 0) return;

    missing.forEach((id) => pending.add(id));
    try {
      const res = await api.post<{ cards: Card[]; notFound: string[] }>("/api/cards/batch", {
        ids: missing,
      });
      set((s) => {
        const next = { ...s.cards };
        for (const c of res.cards) next[c.scryfallId] = c;
        return { cards: next };
      });
    } finally {
      missing.forEach((id) => pending.delete(id));
    }
  },
}));

/** Best image URL for a card (handles double-faced cards). */
export function cardImage(card: Card | undefined): string | undefined {
  if (!card) return undefined;
  return (
    card.imageUris?.normal ??
    card.imageUris?.large ??
    card.cardFaces?.[0]?.imageUris?.normal ??
    card.cardFaces?.[0]?.imageUris?.large
  );
}
