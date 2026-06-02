import { create } from "zustand";

interface SettingsState {
  /** Play short UI sound cues for game events. */
  sound: boolean;
  /** "Next phase" jumps to the next stop (main/combat/end) instead of every step. */
  autoPass: boolean;
  toggleSound: () => void;
  toggleAutoPass: () => void;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  sound: load("mtgc-sound", false),
  autoPass: load("mtgc-autopass", false),
  toggleSound: () => {
    const v = !get().sound;
    save("mtgc-sound", v);
    set({ sound: v });
  },
  toggleAutoPass: () => {
    const v = !get().autoPass;
    save("mtgc-autopass", v);
    set({ autoPass: v });
  },
}));
