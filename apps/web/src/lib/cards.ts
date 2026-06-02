import type { Card } from "@mtgc/shared";
import { api } from "./api";

export const cardsApi = {
  search: (q: string) => api.get<Card[]>(`/api/cards/search?q=${encodeURIComponent(q)}`),
  banlist: () => api.get<{ names: string[] }>("/api/cards/banlist"),
  byNames: (names: string[]) =>
    api.post<{ cards: Card[]; notFound: string[] }>("/api/cards/by-names", { names }),
};

export interface SearchFilters {
  text: string;
  type: string;
  colors: string[];
  cmcOp: "" | "=" | "<=" | ">=";
  cmc: string;
  oracle: string;
}

/** Build a Scryfall query string from the editor's filter form. */
export function buildScryfallQuery(f: SearchFilters): string {
  const parts: string[] = [];
  if (f.text.trim()) parts.push(f.text.trim());
  if (f.type.trim()) parts.push(`t:${f.type.trim()}`);
  if (f.colors.length > 0) parts.push(`id<=${f.colors.join("").toLowerCase()}`);
  if (f.cmcOp && f.cmc.trim()) parts.push(`cmc${f.cmcOp}${f.cmc.trim()}`);
  if (f.oracle.trim()) parts.push(`o:"${f.oracle.trim()}"`);
  return parts.join(" ");
}
