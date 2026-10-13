import { createContext, useContext, useState, type ReactNode } from "react";

export type ThemeMode = "system" | "light" | "dark";

const KEY = "uraeda.theme";

/** The theme picked on this browser, `system` when none or when storage is unavailable. */
function storedMode(): ThemeMode {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function store(mode: ThemeMode) {
  try {
    if (mode === "system") {
      window.localStorage.removeItem(KEY);
    } else {
      window.localStorage.setItem(KEY, mode);
    }
  } catch {
    // Private windows may refuse storage: the choice lasts until the page reloads.
  }
}

const ModeContext = createContext<[ThemeMode, (mode: ThemeMode) => void]>(["system", () => {}]);

export function ThemeModeProvider({ children }: { children: (mode: ThemeMode) => ReactNode }) {
  const [mode, setMode] = useState(storedMode);
  const set = (next: ThemeMode) => {
    store(next);
    setMode(next);
  };
  return <ModeContext value={[mode, set]}>{children(mode)}</ModeContext>;
}

export function useThemeMode() {
  return useContext(ModeContext);
}
