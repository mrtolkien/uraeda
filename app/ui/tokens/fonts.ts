// The fonts the app bundles, and the one picked for each part of the UI. Their files are in the
// app's crate, `crates/app/assets/fonts/`, each family with its licence, the SIL Open Font License
// 1.1: Native Shell ships them with the app and registers them before the first frame, on every
// page, so no font comes from another host. Rust gives each family's name, as its files hold it.
import { bundledFonts } from "uraeda/native";

const FAMILIES = new Map(bundledFonts().map((font) => [font.id, font.family]));

/** The one family bundled whole: it draws the arrows, lines, and marks the others lack. */
const WHOLE = FAMILIES.get("neon");

/**
 * What a style's `fontFamily` takes for the bundled font `id`: its family, then the whole one for
 * the characters it lacks, then the system's `generic` one.
 */
function family(id: string, generic: string) {
  const names = [FAMILIES.get(id), WHOLE, generic].filter((name) => name !== undefined);
  return [...new Set(names)].join(", ");
}

/** A part of the UI with a font of its own. */
export type FontRole = "body" | "heading" | "reading" | "code" | "markdown";

/** A font the app bundles. */
export type Font = {
  id: string;
  label: string;
  /**
   * What a style's `fontFamily` takes: the family, then Monaspace Neon, bundled whole, for the
   * characters the family's files lack, then the system's of its kind.
   */
  family: string;
  /**
   * How many of the reading size about 80 characters of prose take in it: a monospace font's
   * letters are wider than a proportional one's, so a pane of prose in it is wider.
   */
  measure: number;
};

/** The fonts the app bundles, proportional first, then monospace. */
export const FONTS: ReadonlyArray<Font> = [
  { id: "inter", label: "Inter", family: family("inter", "sans-serif"), measure: 37.85 },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible Next",
    family: family("atkinson", "sans-serif"),
    measure: 34.8,
  },
  { id: "literata", label: "Literata", family: family("literata", "serif"), measure: 36.8 },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    family: family("jetbrains", "monospace"),
    measure: 48,
  },
  { id: "neon", label: "Monaspace Neon", family: family("neon", "monospace"), measure: 49.6 },
  { id: "argon", label: "Monaspace Argon", family: family("argon", "monospace"), measure: 49.6 },
  { id: "xenon", label: "Monaspace Xenon", family: family("xenon", "monospace"), measure: 49.6 },
  { id: "radon", label: "Monaspace Radon", family: family("radon", "monospace"), measure: 49.6 },
  {
    id: "krypton",
    label: "Monaspace Krypton",
    family: family("krypton", "monospace"),
    measure: 49.6,
  },
];

/** The parts, in the settings' order: each one's name, and what it draws. */
export const FONT_ROLES: ReadonlyArray<{ help: string; label: string; role: FontRole }> = [
  {
    help: "The sidebar, the status line, buttons, panes' titles, and lists.",
    label: "Interface",
    role: "body",
  },
  { help: "Pages' titles and sections' headings.", label: "Headings", role: "heading" },
  {
    help: "What is read at length: proposals, rounds, specs, plans, documents, and a session's messages. A pane of prose widens with a monospace font, to keep about 80 characters a line.",
    label: "Prose",
    role: "reading",
  },
  {
    help: "Code, in the editor and in messages, paths, and keys.",
    label: "Code and keys",
    role: "code",
  },
  { help: "The text you type, in every field.", label: "Markdown prose", role: "markdown" },
];

/** The fonts picked: a bundled font's id for each part. */
export type Fonts = Record<FontRole, string>;

/**
 * Monaspace for the interface, headings, and markdown prose; prose in a proportional font,
 * Atkinson's, which reads best; and code and keys in JetBrains Mono, a standard monospace font.
 */
export const DEFAULT_FONTS: Fonts = {
  body: "neon",
  code: "jetbrains",
  heading: "xenon",
  markdown: "neon",
  reading: "atkinson",
};

/** A font by its id, the default's for `role` when the id is no bundled font's. */
export function fontOf(role: FontRole, id: string | undefined): Font {
  return (
    FONTS.find((font) => font.id === id) ?? FONTS.find((font) => font.id === DEFAULT_FONTS[role])!
  );
}

/** The fonts picked, whole: the default for each part `picked` leaves out, or names no font for. */
export function wholeFonts(picked: Partial<Fonts> | undefined): Fonts {
  const fonts = { ...DEFAULT_FONTS };
  for (const { role } of FONT_ROLES) {
    fonts[role] = fontOf(role, picked?.[role]).id;
  }
  return fonts;
}
