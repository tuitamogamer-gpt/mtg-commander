import { create } from "zustand";

// The UI is dark-first; we ship a single dark theme plus an optional high-contrast
// boost. (A full light theme needs a semantic-color refactor — out of scope.)

function initialContrast(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("contrast");
}

interface ThemeState {
  highContrast: boolean;
  toggleContrast: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  highContrast: initialContrast(),
  toggleContrast: () => {
    const next = !get().highContrast;
    document.documentElement.classList.toggle("contrast", next);
    try {
      localStorage.setItem("mtgc-contrast", next ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ highContrast: next });
  },
}));
