import { create } from "zustand";

export type Theme = "dark" | "light";

function initial(): Theme {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) {
    return "light";
  }
  return "dark";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem("mtgc-theme", theme);
  } catch {
    /* ignore */
  }
}

function initialContrast(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("contrast");
}

interface ThemeState {
  theme: Theme;
  highContrast: boolean;
  toggle: () => void;
  toggleContrast: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initial(),
  highContrast: initialContrast(),
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    apply(next);
    set({ theme: next });
  },
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
