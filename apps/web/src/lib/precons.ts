import type { PreconDeck, PreconListItem, PreconListQuery } from "@mtgc/shared";
import { api } from "./api";

export const preconsApi = {
  list: (query: PreconListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.setCode) params.set("setCode", query.setCode);
    if (query.colors) params.set("colors", query.colors);
    if (query.search) params.set("search", query.search);
    const qs = params.toString();
    return api.get<PreconListItem[]>(`/api/precons${qs ? `?${qs}` : ""}`);
  },
  sets: () => api.get<string[]>("/api/precons/sets"),
  get: (id: string) => api.get<PreconDeck>(`/api/precons/${id}`),
};
