// @vitest-environment node
// The UI look decision's rules a test of the theme's tokens checks (SC-001, US1's look): every text
// colour reaches 4.5:1 against its background, and borders and controls 3:1, in Latte and Mocha;
// text is at 120% of Astryx's base size and corners are square, at every width and pointer. It reads
// the built stylesheet the app loads, so it judges what ships, inherited tokens and rules included.
import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { contrast } from "../__browser__/colours.ts";
import { uraedaTheme } from "../theme/built/uraeda.js";

const css = readFileSync(new URL("../theme/built/uraeda.css", import.meta.url), "utf8");

/** A block of custom properties of the theme's scope, and the media condition it holds under. */
type Block = { media: string | undefined; tokens: Map<string, string> };

/** The theme's `:scope` blocks, in the stylesheet's order, with the `@media` around each. */
function scopeBlocks(text: string): Array<Block> {
  const blocks: Array<Block> = [];
  const preludes: Array<string> = [];
  let start = 0;
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] === "{") {
      preludes.push(text.slice(start, at).trim());
      start = at + 1;
    } else if (text[at] === "}") {
      const prelude = preludes.pop()!;
      if (prelude.endsWith(":scope")) {
        const tokens = new Map<string, string>();
        for (const [, name, value] of text.slice(start, at).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
          tokens.set(name!, value!.trim());
        }
        const media = preludes.findLast((outer) => outer.startsWith("@media"));
        blocks.push({ media: media?.replace(/^@media\s*/, ""), tokens });
      }
      start = at + 1;
    } else if (text[at] === ";" && preludes.length === 0) {
      start = at + 1;
    }
  }
  return blocks;
}

const blocks = scopeBlocks(css);

/** A screen: its width in px, and its pointer. */
type Screen = { pointer: "coarse" | "fine"; width: number };

/** Whether a media condition of the built theme, like `(width < 1024px) and (pointer: coarse)`, holds. */
function holds(media: string, screen: Screen) {
  return media.split(/\s+and\s+/).every((clause) => {
    const width = /^\(width\s*(<|>=)\s*(\d+)px\)$/.exec(clause);
    if (width) {
      return width[1] === "<" ? screen.width < Number(width[2]) : screen.width >= Number(width[2]);
    }
    const pointer = /^\(pointer:\s*(\w+)\)$/.exec(clause);
    if (pointer) {
      return screen.pointer === pointer[1];
    }
    throw new Error(`A media condition the test cannot read: ${clause}`);
  });
}

/** A token's raw value on a screen: the last block that sets it and whose condition holds. */
function raw(name: string, screen: Screen) {
  let value: string | undefined;
  for (const block of blocks) {
    if ((block.media === undefined || holds(block.media, screen)) && block.tokens.has(name)) {
      value = block.tokens.get(name);
    }
  }
  if (value === undefined) {
    throw new Error(`No token ${name}`);
  }
  return value;
}

/** Latte is the light slot of each `[light, dark]` pair, Mocha the dark one. */
type Slot = "latte" | "mocha";

const DESKTOP: Screen = { pointer: "fine", width: 1440 };

/** A token's value in a scheme, its `var()` and `light-dark()` resolved. */
function resolve(name: string, slot: Slot, screen: Screen = DESKTOP): string {
  let value = raw(name, screen);
  for (;;) {
    const pair = /^light-dark\((.+),\s*([^,]+)\)$/.exec(value);
    const reference = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(value);
    if (pair) {
      value = (slot === "latte" ? pair[1]! : pair[2]!).trim();
    } else if (reference) {
      value = resolve(reference[1]!, slot, screen);
    } else {
      return value;
    }
  }
}

/** A `#rrggbb` or `#rrggbbaa` colour's channels and alpha, from 0 to 1. */
function hex(colour: string): [number, number, number, number] {
  const match = /^#([\da-f]{6})([\da-f]{2})?$/i.exec(colour);
  if (!match) {
    throw new Error(`Not a hex colour: ${colour}`);
  }
  const channel = (at: number) => Number.parseInt(match[1]!.slice(at, at + 2), 16) / 255;
  const alpha = match[2] === undefined ? 1 : Number.parseInt(match[2], 16) / 255;
  return [channel(0), channel(2), channel(4), alpha];
}

/** A token's colour in a scheme, laid over `under` by its alpha. */
function colour(name: string, slot: Slot, under: [number, number, number] = [1, 1, 1]) {
  const [r, g, b, a] = hex(resolve(name, slot));
  return [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)] as [
    number,
    number,
    number,
  ];
}

/** The contrast of a token over a background token, in a scheme. */
function ratio(front: string, back: string, slot: Slot) {
  const background = colour(back, slot);
  return contrast(colour(front, slot, background), background);
}

const SLOTS: Array<Slot> = ["latte", "mocha"];
const root = blocks.find(
  (block) => block.media === undefined && block.tokens.has("--color-accent"),
)!;
const named = (pattern: RegExp) => [...root.tokens.keys()].filter((name) => pattern.test(name));

const HUES = ["red", "orange", "yellow", "green", "teal", "cyan", "blue", "purple", "pink", "gray"];
const BACKGROUNDS = [
  "--color-background-body",
  "--color-background-surface",
  "--color-background-card",
];

/** Every text colour against the backgrounds it is read on, beside the pairs components draw. */
const TEXT: Array<[string, string]> = [
  ...[...new Set([...named(/^--color-text-/), "--color-text-lavender"])].flatMap((text) =>
    BACKGROUNDS.map((back): [string, string] => [text, back]),
  ),
  ...["--color-text-primary", "--color-text-secondary"].flatMap((text) =>
    [
      "--color-background-muted",
      "--color-background-popover",
      "--color-accent-muted",
      // A card tinted by its kind, like the home's, holds secondary text too.
      ...HUES.map((hue) => `--color-background-${hue}`),
    ].map((back): [string, string] => [text, back]),
  ),
  ["--color-on-accent", "--color-accent"],
  // Astryx's media modes: text on light media is on-light, on dark media on-dark, each read on
  // the other, the light and dark fills the theme names.
  ["--color-on-light", "--color-on-dark"],
  // A selected row's accent text, and disabled text in it.
  ["--color-text-accent", "--color-accent-muted"],
  ["--color-text-disabled", "--color-accent-muted"],
  ...["accent", "success", "warning", "error"].map((status): [string, string] => [
    `--color-on-${status}`,
    `--astryx-theme-neutral-color-status-fill-${status}`,
  ]),
  ...HUES.map((hue): [string, string] => [`--color-text-${hue}`, `--color-background-${hue}`]),
  ["--color-text-blue", "--astryx-theme-neutral-color-status-muted-accent"],
  ["--color-text-green", "--color-success-muted"],
  ["--color-text-yellow", "--color-warning-muted"],
  ["--color-text-red", "--color-error-muted"],
  ...named(/^--color-syntax-(?!background$|added$|removed$|diff-header$)/).map(
    (syntax): [string, string] => [syntax, "--color-syntax-background"],
  ),
];

test.each(SLOTS.flatMap((slot) => TEXT.map(([front, back]) => [slot, front, back] as const)))(
  "in %s, %s reads at 4.5:1 on %s",
  (slot, front, back) => {
    expect(ratio(front, back, slot)).toBeGreaterThanOrEqual(4.5);
  },
);

/** Borders and controls, which stand 3:1 from the surfaces they sit on. */
const CONTROLS = [
  "--color-border",
  "--color-border-emphasized",
  "--color-accent",
  "--color-success",
  "--color-warning",
  "--color-error",
  ...named(/^--color-icon-/),
  ...HUES.map((hue) => `--color-border-${hue}`),
  "--color-selection-edge",
];

test.each(
  SLOTS.flatMap((slot) =>
    CONTROLS.flatMap((front) =>
      ["--color-background-surface", "--color-background-body"].map(
        (back) => [slot, front, back] as const,
      ),
    ),
  ),
)("in %s, %s stands 3:1 from %s", (slot, front, back) => {
  expect(ratio(front, back, slot)).toBeGreaterThanOrEqual(3);
});

// The icon on a scrim over media, like the lightbox's Close and a thumbnail's remove button, over
// the lightest image, white.
test.each(SLOTS)("in %s, --color-on-dark stands 3:1 from the scrim over white", (slot) => {
  expect(ratio("--color-on-dark", "--color-overlay", slot)).toBeGreaterThanOrEqual(3);
});

// A pane's border sits on a card and on the muted background too, like a story's stage.
test.each(
  SLOTS.flatMap((slot) =>
    ["--color-background-card", "--color-background-muted"].map((back) => [slot, back] as const),
  ),
)("in %s, --color-border stands 3:1 from %s", (slot, back) => {
  expect(ratio("--color-border", back, slot)).toBeGreaterThanOrEqual(3);
});

/** A length token in px, from the rem or px the build writes. */
function px(name: string, screen: Screen) {
  const value = resolve(name, "mocha", screen);
  const match = /^([\d.]+)(px|rem)$/.exec(value);
  if (!match) {
    throw new Error(`${name} is not a length: ${value}`);
  }
  return Number(match[1]) * (match[2] === "rem" ? 16 : 1);
}

const SCREENS: Array<Screen> = [390, 800, 1205, 1440, 1900].flatMap((width) =>
  (["fine", "coarse"] as const).map((pointer) => ({ pointer, width })),
);

test.each(SCREENS)(
  "at $width px with a $pointer pointer, text is 120% and corners square",
  (screen) => {
    // 14 px, Astryx's base size, at 120%.
    expect(px("--text-body-size", screen)).toBeCloseTo(16.8, 5);
    expect(px("--text-label-size", screen)).toBeCloseTo(16.8, 5);
    expect(px("--text-reading-size", screen)).toBe(19);
    for (const radius of ["inner", "element", "container", "page"]) {
      expect(px(`--radius-${radius}`, screen), radius).toBe(0);
    }
    // A finger's controls stay 44 px tall.
    expect(px("--size-element-md", screen)).toBe(screen.pointer === "coarse" ? 44 : 38.4);
  },
);

test("the fonts are JetBrains Mono, and Inter for reading", () => {
  for (const font of ["--font-family-body", "--font-family-heading", "--font-family-code"]) {
    expect(resolve(font, "mocha")).toMatch(/^"JetBrains Mono Variable",/);
  }
  expect(resolve("--font-family-reading", "mocha")).toMatch(/^"Inter Variable",/);
});

test("the breakpoints are named at 768 and 1280 px", () => {
  const { widthBreakpoints } = (
    uraedaTheme as unknown as { __adaptations: { widthBreakpoints: Record<string, number> } }
  ).__adaptations;
  expect(widthBreakpoints.md).toBe(768);
  expect(widthBreakpoints.xl).toBe(1280);
});
