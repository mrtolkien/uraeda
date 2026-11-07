// The pairs of tokens the UI look decision's contrast floor measures: every text colour 4.5:1
// against the backgrounds it is read on, and borders and controls 3:1 from the surfaces they sit
// on. Shared by the contrast tests (`theme-tokens.test.ts`), the floor step (`floor.ts`), and the
// script that prints a shipped theme's floor entries (`scripts/theme-floor.ts`).
import { contrast } from "./contrast.ts";
import { MEDIA, type Tokens } from "./roles.ts";

/** A pair: the token in front, and the one behind it. */
export type Pair = readonly [front: string, back: string];

const HUES = ["red", "orange", "yellow", "green", "teal", "cyan", "blue", "purple", "pink", "gray"];
const BACKGROUNDS = [
  "--color-background-body",
  "--color-background-surface",
  "--color-background-card",
];
const SYNTAX = [
  "attribute",
  "comment",
  "constant",
  "function",
  "keyword",
  "number",
  "operator",
  "property",
  "punctuation",
  "string",
  "tag",
  "type",
  "variable",
  "added-marker",
  "removed-marker",
];
/** Every text token: the hues', and lavender and sapphire, a pane's title and a live window's. */
const TEXTS = ["accent", "primary", "secondary", "disabled", "lavender", "sapphire", ...HUES].map(
  (name) => `--color-text-${name}`,
);

/**
 * The text roles no Astryx token carries, which views read as `--role-*` (R1): headings, inline code,
 * quotes, your messages, a running session's mark, context notes, and the Vim modes, drawn as text
 * and as the status line's block under `on-action`.
 */
const MODES = ["normal", "insert", "visual", "replace", "command"].map(
  (mode) => `--role-mode-${mode}`,
);
const ROLE_TEXTS = [
  ...[
    "heading-1",
    "heading-2",
    "heading-3",
    "code-inline",
    "quote",
    "yours",
    "working",
    "context",
  ].map((role) => `--role-${role}`),
  ...MODES,
];

/** The pairs `fronts` × `backs`. */
const across = (fronts: Array<string>, backs: Array<string>): Array<Pair> =>
  fronts.flatMap((front) => backs.map((back): Pair => [front, back]));

/** Every text colour against the backgrounds it is read on, beside the pairs components draw. */
export const TEXT_PAIRS: ReadonlyArray<Pair> = [
  ...across(TEXTS, BACKGROUNDS),
  ...across(ROLE_TEXTS, BACKGROUNDS),
  ...across(["--role-on-action"], MODES),
  ...across(
    ["--color-text-primary", "--color-text-secondary"],
    [
      "--color-background-muted",
      "--color-background-popover",
      "--color-accent-muted",
      // A card tinted by its kind, like the home's, holds secondary text too.
      ...HUES.map((hue) => `--color-background-${hue}`),
    ],
  ),
  ["--color-on-accent", "--color-accent"],
  // The status line's mode, in its block (`shell/status/Sections.tsx`), and in its section b.
  ...across(
    ["--color-on-accent"],
    [
      "--color-text-secondary",
      ...["blue", "green", "purple", "red", "orange"].map((hue) => `--color-border-${hue}`),
    ],
  ),
  ...["secondary", "blue", "green", "purple", "red", "orange"].map((hue): Pair => [
    `--color-text-${hue}`,
    "--color-background-gray",
  ]),
  // Astryx's media modes: text on light media is on-light, on dark media on-dark, each read on
  // the other, the light and dark fills the theme names.
  ["--color-on-light", "--color-on-dark"],
  // A selected row's accent text, and disabled text in it.
  ["--color-text-accent", "--color-accent-muted"],
  ["--color-text-disabled", "--color-accent-muted"],
  ...["accent", "success", "warning", "error"].map((status): Pair => [
    `--color-on-${status}`,
    `--astryx-theme-neutral-color-status-fill-${status}`,
  ]),
  ...HUES.map((hue): Pair => [`--color-text-${hue}`, `--color-background-${hue}`]),
  ["--color-text-blue", "--astryx-theme-neutral-color-status-muted-accent"],
  ["--color-text-green", "--color-success-muted"],
  ["--color-text-yellow", "--color-warning-muted"],
  ["--color-text-red", "--color-error-muted"],
  ...SYNTAX.map((token): Pair => [`--color-syntax-${token}`, "--color-syntax-background"]),
];

/** Borders and controls, which stand 3:1 from the surfaces they sit on. */
export const CONTROL_PAIRS: ReadonlyArray<Pair> = [
  ...across(
    [
      "--color-border",
      "--color-border-emphasized",
      "--color-accent",
      "--color-success",
      "--color-warning",
      "--color-error",
      ...[...HUES, "accent", "disabled", "primary", "secondary"].map(
        (name) => `--color-icon-${name}`,
      ),
      ...HUES.map((hue) => `--color-border-${hue}`),
      // A live window's double border, in the theme's own sapphire.
      "--color-border-sapphire",
      // A sub-agent's mark and its row's icon, in the theme's own teal.
      "--color-fill-teal",
      "--color-selection-edge",
    ],
    ["--color-background-surface", "--color-background-body"],
  ),
  // The icon on a scrim over media, like the lightbox's Close and a thumbnail's remove button,
  // over the lightest image, white.
  ["--color-on-dark", "--color-overlay"],
  // A pane's border sits on a card and on the muted background too, like a story's stage.
  ...across(["--color-border"], ["--color-background-card", "--color-background-muted"]),
];

/** A `#rrggbb` or `#rrggbbaa` colour's channels and alpha, from 0 to 1. */
function channels(colour: string): [number, number, number, number] {
  const match = /^#([\da-f]{6})([\da-f]{2})?$/i.exec(colour);
  if (!match) {
    throw new Error(`Not a hex colour: ${colour}`);
  }
  const channel = (at: number) => Number.parseInt(match[1]!.slice(at, at + 2), 16) / 255;
  const alpha = match[2] === undefined ? 1 : Number.parseInt(match[2], 16) / 255;
  return [channel(0), channel(2), channel(4), alpha];
}

/** A colour laid over an opaque one by its alpha. */
function laid(colour: string, under: [number, number, number]): [number, number, number] {
  const [r, g, b, a] = channels(colour);
  return [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)];
}

/** A token's colour, the media constants included. */
function token(tokens: Tokens, name: string) {
  const colour = tokens[name] ?? MEDIA[name];
  if (colour === undefined) {
    throw new Error(`No token ${name}`);
  }
  return colour;
}

/**
 * The contrast of `front` over `back`: the back laid over white, the lightest image under a
 * scrim, and the front over the back, so a colour with alpha is measured as it is seen.
 */
export function ratio(tokens: Tokens, front: string, back: string) {
  const ground = laid(token(tokens, back), [1, 1, 1]);
  return contrast(laid(token(tokens, front), ground), ground);
}

/** Every pair under its floor, 4.5:1 for text and 3:1 for controls. */
export function failures(
  tokens: Tokens,
): Array<{ back: string; floor: number; front: string; ratio: number }> {
  const measured = [
    ...TEXT_PAIRS.map((pair) => [pair, 4.5] as const),
    ...CONTROL_PAIRS.map((pair) => [pair, 3] as const),
  ];
  return measured.flatMap(([[front, back], floor]) => {
    const value = ratio(tokens, front, back);
    return value < floor ? [{ back, floor, front, ratio: value }] : [];
  });
}
