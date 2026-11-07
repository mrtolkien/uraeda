// The colour picks, kept in this browser: the mode, System, Light, or Dark, and a theme for each
// mode, among the themes the server serves. The provider draws the picked themes over the built
// one (`theme/palette.ts`), and keeps what it drew in a cache, which the first paint's script in
// `index.html` and the sign-in page draw before the server answers. The picks' keys and their
// migration are the data model's "Picks in the browser".
import { useMediaQuery } from "@astryxdesign/core/hooks";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Theme } from "uraeda-binding";
import { applyPalette } from "./theme/palette.ts";
import { tokensOf, type Tokens } from "./theme/roles.ts";
import { useThemes } from "./useThemes.ts";

/** The mode picked: the system's own, or one of the two. */
export type Mode = "system" | "light" | "dark";

/** What this browser picked: the mode, and the theme of each mode, by id. */
export type Picks = { dark: string; light: string; mode: Mode };

/** The tokens of each mode's theme, as the palette rule draws them. */
export type Drawn = { dark?: Tokens; light?: Tokens };

/**
 * The themes each mode draws when none is picked, or when the pick is not in the lists: the core's
 * `DEFAULT_DARK` and `DEFAULT_LIGHT`.
 */
export const DEFAULTS = { dark: "catppuccin-mocha", light: "catppuccin-latte" } as const;

/** The browser's keys, which the first paint's script in `index.html` reads too. */
const KEYS = {
  dark: "uraeda.theme.dark",
  drawn: "uraeda.theme.drawn",
  light: "uraeda.theme.light",
  mode: "uraeda.theme",
} as const;

const MODES = ["dark", "light"] as const;

/**
 * The picks stored: `system` when no mode, or one it does not know, and each mode's default theme
 * when none. An earlier version stored the scheme, `mocha` or `latte`: they read as the modes Dark
 * and Light, with the default themes, so the look does not change.
 */
export function storedPicks(read: (key: string) => string | null): Picks {
  const mode = read(KEYS.mode);
  const dark = mode === "dark" || mode === "mocha";
  const light = mode === "light" || mode === "latte";
  return {
    dark: read(KEYS.dark) || DEFAULTS.dark,
    light: read(KEYS.light) || DEFAULTS.light,
    mode: dark ? "dark" : light ? "light" : "system",
  };
}

/** A plain object's entries, or none for anything else. */
function entriesOf(value: unknown): Array<[string, unknown]> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.entries(value)
    : [];
}

/**
 * The drawn cache: each mode's tokens it holds, their text entries only, and nothing when it is
 * absent or unreadable, so the built theme draws.
 */
export function storedDrawn(text: string | null): Drawn {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text ?? "null");
  } catch {
    return {};
  }
  const stored = Object.fromEntries(entriesOf(parsed));
  const drawn: Drawn = {};
  for (const mode of MODES) {
    const entries = entriesOf(stored[mode]).filter(([, colour]) => typeof colour === "string");
    if (entries.length > 0) {
      drawn[mode] = Object.fromEntries(entries) as Tokens;
    }
  }
  return drawn;
}

/** A mode's theme: the one picked, else the mode's default, else none, when the list lacks both. */
function themeOf(themes: ReadonlyArray<Theme>, mode: "dark" | "light", id: string) {
  const ofMode = themes.filter((theme) => theme.mode === mode);
  return (
    ofMode.find((theme) => theme.id === id) ?? ofMode.find((theme) => theme.id === DEFAULTS[mode])
  );
}

/**
 * The tokens each mode draws: its pick among `themes`, or its default when the pick is not there,
 * the theme `preview` names replacing its mode's.
 */
export function drawnTokens(themes: ReadonlyArray<Theme>, picks: Picks, preview?: string): Drawn {
  const previewed = themes.find((theme) => theme.id === preview);
  const drawn: Drawn = {};
  for (const mode of MODES) {
    const theme = previewed?.mode === mode ? previewed : themeOf(themes, mode, picks[mode]);
    if (theme) {
      drawn[mode] = tokensOf(theme.roles, mode);
    }
  }
  return drawn;
}

/** Reads this browser's storage, nothing when it refuses. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes `value` under `key`, or removes the key for `undefined`. */
function store(key: string, value: string | undefined) {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Private windows may refuse storage: the picks last until the page reloads.
  }
}

/** Stores the picks changed, each removed when it is its default. */
function storePicks(next: Partial<Picks>) {
  if (next.mode !== undefined) {
    store(KEYS.mode, next.mode === "system" ? undefined : next.mode);
  }
  for (const mode of MODES) {
    const id = next[mode];
    if (id !== undefined) {
      store(KEYS[mode], id === DEFAULTS[mode] ? undefined : id);
    }
  }
}

/** Each mode's default, as the lists show it until the server answers: the built theme draws it. */
const DEFAULT_THEMES: ReadonlyArray<Theme> = [
  { id: DEFAULTS.dark, mode: "dark", name: "Catppuccin Mocha" },
  { id: DEFAULTS.light, mode: "light", name: "Catppuccin Latte" },
].map((theme) => ({ ...theme, isShipped: true, palette: {}, roles: {}, sources: {} }));

type Picked = {
  drawn: Drawn;
  pick: (next: Partial<Picks>) => void;
  picks: Picks;
  preview: (id: string | undefined) => void;
  setThemes: (themes: ReadonlyArray<Theme>) => void;
  themes: ReadonlyArray<Theme> | undefined;
};

const PickedContext = createContext<Picked>({
  drawn: {},
  pick: () => {},
  picks: { ...DEFAULTS, mode: "system" },
  preview: () => {},
  setThemes: () => {},
  themes: undefined,
});

/** The colour of the browser's bar in a mode with nothing drawn: the built Catppuccin's page. */
const BAR = { dark: "#1e1e2e", light: "#eff1f5" } as const;

/**
 * Sets each `theme-color` meta of `index.html`, one per system mode, to the colour of the page
 * shown: the meta's own mode's under System, else the mode shown, so the browser's bar follows the
 * page.
 */
function paintBar(drawn: Drawn, mode: "system" | "light" | "dark") {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes("dark") ? "dark" : "light";
    const shown = mode === "system" ? own : mode;
    meta.content = drawn[shown]?.["--color-background-body"] ?? BAR[shown];
  }
}

/** Writes the drawn cache when what the picks draw changes, once the server's themes drew it. */
function useDrawnCache(drawn: Drawn | undefined) {
  useEffect(() => {
    if (drawn === undefined) {
      return;
    }
    const text = JSON.stringify(drawn);
    if (read(KEYS.drawn) !== text) {
      store(KEYS.drawn, text);
    }
  }, [drawn]);
}

/** The mode a page shows: a previewed theme's, else the mode picked, the system's under System. */
function shownMode(picks: Picks, systemDark: boolean, previewMode: string | undefined) {
  if (previewMode === "dark" || previewMode === "light") {
    return previewMode;
  }
  if (picks.mode === "system") {
    return systemDark ? "dark" : "light";
  }
  return picks.mode;
}

/**
 * Draws the picked themes over the built one, and gives its children Astryx's mode: the mode
 * picked, the system's under System, or the previewed theme's. Until `ThemesFeed` gives it the
 * server's themes, it draws the cache of what it drew last, as the sign-in page does.
 */
export function ThemeProvider({ children }: { children: (mode: "light" | "dark") => ReactNode }) {
  const [picks, setPicks] = useState(() => storedPicks(read));
  const [themes, setThemes] = useState<ReadonlyArray<Theme>>();
  const [previewed, preview] = useState<string>();
  const [cached] = useState(() => storedDrawn(read(KEYS.drawn)));
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const picked = useMemo(() => themes && drawnTokens(themes, picks), [themes, picks]);
  const drawn = useMemo(
    () => (themes ? drawnTokens(themes, picks, previewed) : cached),
    [cached, themes, picks, previewed],
  );
  const previewMode = themes?.find((theme) => theme.id === previewed)?.mode;
  const mode = shownMode(picks, systemDark, previewMode);
  useDrawnCache(picked);
  useLayoutEffect(() => {
    applyPalette(drawn);
    paintBar(drawn, previewMode === undefined ? picks.mode : mode);
  }, [drawn, mode, picks.mode, previewMode]);
  const value = useMemo(
    () => ({
      drawn,
      pick: (next: Partial<Picks>) => {
        storePicks(next);
        setPicks((before) => ({ ...before, ...next }));
      },
      picks,
      preview,
      setThemes,
      themes,
    }),
    [drawn, picks, themes],
  );
  return <PickedContext value={value}>{children(mode)}</PickedContext>;
}

/**
 * Gives the provider the themes the server serves, as they change. Drawn where the app is signed
 * in, under a `Suspense` of its own, so no page waits for it.
 */
export function ThemesFeed() {
  const themes = useThemes()?.themes;
  const { setThemes } = useContext(PickedContext);
  useEffect(() => {
    if (themes) {
      setThemes(themes);
    }
  }, [setThemes, themes]);
  return null;
}

/** The picks, and the function that changes some of them, kept in this browser. */
export function usePicks(): [Picks, (next: Partial<Picks>) => void] {
  const { pick, picks } = useContext(PickedContext);
  return [picks, pick];
}

/** The themes the lists show, dark first: the server's, or each mode's default until it answers. */
export function useThemeList(): ReadonlyArray<Theme> {
  return useContext(PickedContext).themes ?? DEFAULT_THEMES;
}

/** Draws the app in the theme an id names, its mode included, until called with `undefined`. */
export function useThemePreview(): (id: string | undefined) => void {
  return useContext(PickedContext).preview;
}

/** The tokens the page draws now, a preview included, for the story frames. */
export function useDrawnTokens(): Drawn {
  return useContext(PickedContext).drawn;
}
