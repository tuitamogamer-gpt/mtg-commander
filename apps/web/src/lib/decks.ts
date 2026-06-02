import type { Deck } from "@mtgc/shared";
import { api } from "./api";

export const decksApi = {
  list: () => api.get<Deck[]>("/api/decks"),
  get: (id: string) => api.get<Deck>(`/api/decks/${id}`),
  create: (name: string) => api.post<Deck>("/api/decks", { name, cards: [] }),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/decks/${id}`),
  importMoxfield: (deckId: string) =>
    api.post<Deck>("/api/decks/import/moxfield", { deckId }),
  importPrecon: (preconId: string) =>
    api.post<Deck>(`/api/decks/import/precon/${preconId}`),
};

const COLOR_PIPS: Record<string, { label: string; className: string }> = {
  W: { label: "W", className: "bg-amber-100 text-black" },
  U: { label: "U", className: "bg-sky-400 text-black" },
  B: { label: "B", className: "bg-zinc-700 text-white" },
  R: { label: "R", className: "bg-red-500 text-white" },
  G: { label: "G", className: "bg-green-500 text-black" },
};

export function colorPips(identity: string[]): { label: string; className: string }[] {
  if (identity.length === 0) return [{ label: "C", className: "bg-zinc-400 text-black" }];
  return identity.map((c) => COLOR_PIPS[c] ?? { label: c, className: "bg-zinc-500 text-white" });
}

export function deckCardCount(deck: Deck): number {
  return deck.cards.reduce((sum, c) => sum + c.quantity, 0);
}
