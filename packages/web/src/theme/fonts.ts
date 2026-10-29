// The fonts, picked for each part of the UI, kept in this browser: the interface, the headings,
// prose, code and keys, and the human's messages in a session. Each part is a font family token of
// the theme, written over the theme's own in a stylesheet of the page's head, outside Astryx's
// theme layer, so it wins. One choice for the whole app: the settings' Fonts section and
// `Space u f` show and pick the same.
import { useSyncExternalStore } from "react";

/** A part of the UI with a font of its own. */
export type FontRole = "body" | "heading" | "reading" | "code" | "human";

/** A font the UI bundles: its name, its CSS family with fallbacks, and its prose measure. */
export type Font = {
  family: string;
  id: string;
  label: string;
  /**
   * How many of the reading size about 80 characters of prose take in it: a monospace font's
   * letters are wider than a proportional one's, so a pane of prose in it is wider. Measured on a
   * spec's sentence, against Inter's, the theme's own.
   */
  measure: number;
};

const MONO = "ui-monospace, monospace";
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** The fonts the UI bundles (`main.tsx`), proportional first, then monospace. */
export const FONTS: ReadonlyArray<Font> = [
  { family: `"Inter Variable", ${SANS}`, id: "inter", label: "Inter", measure: 37.85 },
  {
    family: `"Atkinson Hyperlegible Next Variable", ${SANS}`,
    id: "atkinson",
    label: "Atkinson Hyperlegible Next",
    measure: 34.8,
  },
  {
    family: '"Literata Variable", Georgia, serif',
    id: "literata",
    label: "Literata",
    measure: 36.8,
  },
  {
    family: `"JetBrains Mono Variable", ${MONO}`,
    id: "jetbrains",
    label: "JetBrains Mono",
    measure: 48,
  },
  { family: `"Monaspace Neon", ${MONO}`, id: "neon", label: "Monaspace Neon", measure: 49.6 },
  { family: `"Monaspace Argon", ${MONO}`, id: "argon", label: "Monaspace Argon", measure: 49.6 },
  { family: `"Monaspace Xenon", ${MONO}`, id: "xenon", label: "Monaspace Xenon", measure: 49.6 },
  { family: `"Monaspace Radon", ${MONO}`, id: "radon", label: "Monaspace Radon", measure: 49.6 },
  {
    family: `"Monaspace Krypton", ${MONO}`,
    id: "krypton",
    label: "Monaspace Krypton",
    measure: 49.6,
  },
];

/** The parts, in the settings' order: each one's name, its key under `Space u f`, and its help. */
export const ROLES: ReadonlyArray<{ help: string; key: string; label: string; role: FontRole }> = [
  {
    help: "The sidebar, the status line, buttons, panes' titles, and lists.",
    key: "i",
    label: "Interface",
    role: "body",
  },
  { help: "Pages' titles and sections' headings.", key: "h", label: "Headings", role: "heading" },
  {
    help: "What is read at length: proposals, rounds, specs, plans, and documents. A pane of prose widens with a monospace font, to keep about 80 characters a line.",
    key: "p",
    label: "Prose",
    role: "reading",
  },
  { help: "Code, paths, and keys.", key: "c", label: "Code and keys", role: "code" },
  {
    help: "Your messages in a session, once sent.",
    key: "u",
    label: "Your messages",
    role: "human",
  },
];

/** The fonts picked: one for each part. */
export type Fonts = Record<FontRole, string>;

/** Monaspace everywhere but prose, which reads best in a proportional font: Atkinson's. */
export const DEFAULT_FONTS: Fonts = {
  body: "neon",
  code: "krypton",
  heading: "xenon",
  human: "radon",
  reading: "atkinson",
};

const KEY = "uraeda.fonts";

/** A font by its id, the default's for `role` when the id is not a bundled font's. */
export function fontOf(role: FontRole, id: string | undefined): Font {
  return (
    FONTS.find((font) => font.id === id) ?? FONTS.find((font) => font.id === DEFAULT_FONTS[role])!
  );
}

/** The fonts picked on this browser, the defaults for any part not picked, or unreadable. */
function readFonts(): Fonts {
  let stored: Partial<Record<FontRole, unknown>> = {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    stored = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // An older value, storage refused, or text that is not JSON: the defaults.
  }
  const picked = { ...DEFAULT_FONTS };
  for (const { role } of ROLES) {
    const id = stored[role];
    picked[role] = fontOf(role, typeof id === "string" ? id : undefined).id;
  }
  return picked;
}

/** The fonts as last read: `useSyncExternalStore` needs the same object until they change. */
let current: Fonts | undefined;

function snapshot(): Fonts {
  current ??= readFonts();
  return current;
}

/** The stylesheet of the fonts picked: the theme's tokens, and the human's messages. */
function sheet(fonts: Fonts) {
  const family = (role: FontRole) => fontOf(role, fonts[role]).family;
  return `:root [data-astryx-theme], :root[data-astryx-theme] {
  --font-family-body: ${family("body")};
  --font-family-heading: ${family("heading")};
  --font-family-reading: ${family("reading")};
  --font-family-code: ${family("code")};
  --font-family-human: ${family("human")};
  --size-reading-measure: calc(${fontOf("reading", fonts.reading).measure} * var(--text-reading-size));
}
[data-words="human"] {
  font-family: var(--font-family-human);
  --font-family-body: var(--font-family-human);
  --font-family-reading: var(--font-family-human);
}`;
}

/** Writes the stylesheet of `fonts` in the page's head. */
function apply(fonts: Fonts) {
  let style = document.querySelector<HTMLStyleElement>("style[data-uraeda-fonts]");
  if (!style) {
    style = document.createElement("style");
    style.dataset.uraedaFonts = "";
    document.head.append(style);
  }
  style.textContent = sheet(fonts);
}

/** Writes the fonts picked before the app draws, so no text changes face. */
export function applyStoredFonts() {
  apply(snapshot());
}

/** What re-reads the fonts picked, one for each component that shows them. */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Picks `font` for `role`, kept in this browser. */
export function pickFont(role: FontRole, font: string) {
  store({ ...snapshot(), [role]: fontOf(role, font).id }, true);
}

/** Puts the default fonts back, forgetting the ones picked on this browser. */
export function restoreDefaultFonts() {
  store(DEFAULT_FONTS, false);
}

/** Uses `next`, kept in this browser when `keeps`, else forgotten, and redraws what shows them. */
function store(next: Fonts, keeps: boolean) {
  try {
    if (keeps) {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(KEY);
    }
  } catch {
    // Private windows may refuse storage: the choice lasts until the page reloads.
  }
  current = next;
  apply(next);
  for (const listener of listeners) {
    listener();
  }
}

/** The fonts picked, one for each part. */
export function useFonts(): Fonts {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_FONTS);
}
