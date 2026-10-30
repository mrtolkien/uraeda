// The fonts, picked for each part of the UI, kept in this browser: the interface, the headings,
// prose, code and keys, and the human's messages in a session. Each part is a font family token of
// the theme, written over the theme's own by a StyleX style on the app's root, and on what draws
// outside it (`useFontStyle`), from the app's first draw, so no text changes face. One choice for
// the whole app: the settings' Fonts section and `Space u f` show and pick the same.
import * as stylex from "@stylexjs/stylex";
import { useSyncExternalStore } from "react";
import { measureOf, WIDTHS } from "./scale.ts";

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

const styles = stylex.create({
  // The fonts picked, over the theme's tokens, which the theme sets on its own element: each part's
  // family, and prose's measure, which each font sets so a line holds about 80 characters. The
  // tokens made of the measure are made again here, as a token holding a `var()` takes its value
  // where it is set; and the text takes the interface's family, as the theme's element gives it.
  picked: (
    body: string,
    heading: string,
    reading: string,
    code: string,
    human: string,
    measure: string,
  ) => ({
    "--font-family-body": body,
    "--font-family-code": code,
    "--font-family-heading": heading,
    "--font-family-human": human,
    "--font-family-reading": reading,
    "--size-reading-measure": measure,
    fontFamily: "var(--font-family-body)",
  }),
  // The scale's widths made of the measure, made again over the picked font's (`scale.ts`): each
  // passed in, as a style takes no value from outside its file but its arguments.
  widths: (pane: string, bigText: string, splitCard: string, twoPanes: string) => ({
    "--size-big-text": bigText,
    "--size-reading-pane": pane,
    "--size-split-card": splitCard,
    "--size-two-panes": twoPanes,
  }),
  // The app's root, which only carries the fonts: no box of its own.
  root: { display: "contents" },
  // A human's message once sent, in their font, its prose too.
  human: {
    "--font-family-body": "var(--font-family-human)",
    "--font-family-reading": "var(--font-family-human)",
    fontFamily: "var(--font-family-human)",
  },
});

/** The human's sent messages' font, for their bubble's style (`TranscriptMessages.tsx`). */
export const humanWords = styles.human;

/** The style of a root that only carries the fonts, with no box of its own. */
export const fontRoot = styles.root;

/**
 * The style of the fonts picked, for the app's root, inside the theme, and for what draws outside
 * it, as a bar put in the page's body: only the theme's own tokens are there.
 */
export function useFontStyle(): ReadonlyArray<stylex.StyleXStyles> {
  const fonts = useFonts();
  const family = (role: FontRole) => fontOf(role, fonts[role]).family;
  return [
    styles.picked(
      family("body"),
      family("heading"),
      family("reading"),
      family("code"),
      family("human"),
      measureOf(fontOf("reading", fonts.reading).measure),
    ),
    // Custom properties alone, which StyleX's types read as no style at all.
    styles.widths(
      WIDTHS["--size-reading-pane"],
      WIDTHS["--size-big-text"],
      WIDTHS["--size-split-card"],
      WIDTHS["--size-two-panes"],
    ) as stylex.StyleXStyles,
  ];
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
  for (const listener of listeners) {
    listener();
  }
}

/** The fonts picked, one for each part. */
export function useFonts(): Fonts {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_FONTS);
}
