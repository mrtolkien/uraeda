// The colour scheme: the one picked on the settings page, Mocha or Latte, kept in this browser, or
// the system's. The theme draws Latte in Astryx's light slot and Mocha in its dark one, so the
// scheme is resolved here to Astryx's mode, which the theme, and the story frames sent it, name.
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { createContext, useContext, useState, type ReactNode } from "react";

/** A colour scheme: Catppuccin's Mocha or Latte, or the system's own. */
export type Scheme = "system" | "mocha" | "latte";

/**
 * Astryx's colour mode: the system's own, as a story outside Uraeda follows, or the slot a scheme
 * draws in, light for Latte and dark for Mocha.
 */
export type ThemeMode = "system" | "light" | "dark";

const KEY = "uraeda.theme";

/**
 * The scheme a stored value names, `system` when none, or for a value it does not know. An earlier
 * version stored `dark` and `light`: they read as Mocha and Latte, until the next pick rewrites
 * them.
 */
export function storedScheme(value: string | null): Scheme {
  if (value === "mocha" || value === "dark") {
    return "mocha";
  }
  return value === "latte" || value === "light" ? "latte" : "system";
}

/** The scheme picked on this browser, `system` when none or when storage is unavailable. */
function readScheme(): Scheme {
  try {
    return storedScheme(window.localStorage.getItem(KEY));
  } catch {
    return "system";
  }
}

function store(scheme: Scheme) {
  try {
    if (scheme === "system") {
      window.localStorage.removeItem(KEY);
    } else {
      window.localStorage.setItem(KEY, scheme);
    }
  } catch {
    // Private windows may refuse storage: the choice lasts until the page reloads.
  }
}

const SchemeContext = createContext<[Scheme, (scheme: Scheme) => void]>(["system", () => {}]);

/** Gives its children Astryx's mode for the scheme picked, the system's when none is. */
export function ThemeModeProvider({
  children,
}: {
  children: (mode: Exclude<ThemeMode, "system">) => ReactNode;
}) {
  const [scheme, setScheme] = useState(readScheme);
  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  const set = (next: Scheme) => {
    store(next);
    setScheme(next);
  };
  const resolved = scheme === "mocha" || (scheme === "system" && dark) ? "dark" : "light";
  return <SchemeContext value={[scheme, set]}>{children(resolved)}</SchemeContext>;
}

/** The scheme picked, `system` included, and the function that picks another. */
export function useScheme() {
  return useContext(SchemeContext);
}
