// The colour mode: the one picked on the settings page, kept in this browser, or the system's. The
// mode is resolved here, light or dark, so the theme, and the story frames sent it, name it.
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { createContext, useContext, useState, type ReactNode } from "react";

/** A colour mode: the system's own, as a story outside Uraeda follows, or light or dark. */
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
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  const set = (next: ThemeMode) => {
    store(next);
    setMode(next);
  };
  const resolved = mode === "system" ? (dark ? "dark" : "light") : mode;
  return <ModeContext value={[mode, set]}>{children(resolved)}</ModeContext>;
}

/** The mode picked, `system` included, and the function that picks another. */
export function useThemeMode() {
  return useContext(ModeContext);
}
