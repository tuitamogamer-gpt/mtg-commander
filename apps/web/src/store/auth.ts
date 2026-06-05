import { create } from "zustand";
import type { AuthResponse, PublicUser } from "@mtgc/shared";
import { api, ApiError } from "@/lib/api";
import { resetSockets } from "@/lib/socket";

interface AuthState {
  user: PublicUser | null;
  /** false once the initial /me check has resolved. */
  loading: boolean;
  fetchMe: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetchMe: async () => {
    try {
      const { user } = await api.get<AuthResponse>("/api/auth/me");
      set({ user, loading: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ user: null, loading: false });
      } else {
        set({ loading: false });
      }
    }
  },
  login: async (identifier, password) => {
    // Drop any sockets authed as a previous user before switching identity.
    resetSockets();
    const { user } = await api.post<AuthResponse>("/api/auth/login", { identifier, password });
    set({ user });
  },
  register: async (username, email, password) => {
    resetSockets();
    const { user } = await api.post<AuthResponse>("/api/auth/register", { username, email, password });
    set({ user });
  },
  logout: async () => {
    await api.post("/api/auth/logout");
    resetSockets();
    set({ user: null });
  },
}));
