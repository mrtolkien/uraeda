// @vitest-environment node
// The mapping from a theme's roles to the theme's tokens (`theme/roles.ts`), on the shipped themes
// the core reads: Catppuccin draws what it drew before themes (SC-001), the built theme draws the
// shipped Catppuccin files, and every `-floor` entry of a shipped theme is the smallest step of
// lightness that brings its colour to the contrast floor (the Colour themes decision, R4).
import { readFileSync } from "node:fs";
import { readThemes, type Theme } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { mix } from "../theme/colour.ts";
import { entryPasses, floorStep, fromHsl, hslOf } from "../theme/floor.ts";
import { paletteCss } from "../theme/palette.ts";
import { tokensOf } from "../theme/roles.ts";
import today from "./fixtures/catppuccin-today.json" with { type: "json" };

const { themes } = await readThemes(temporaryFolder("uraeda-theme-roles"));

/** A shipped theme, by id. */
function shipped(id: string): Theme {
  const theme = themes.find((each) => each.id === id && each.isShipped);
  if (!theme) {
    throw new Error(`No shipped theme ${id}`);
  }
  return theme;
}

type Mode = "dark" | "light";
const CATPPUCCIN: Record<Mode, Theme> = {
  dark: shipped("catppuccin-mocha"),
  light: shipped("catppuccin-latte"),
};

/** Each of `tokens`, drawn differently since themes for `reason`. */
const because = (reason: string, tokens: Array<string>) =>
  Object.fromEntries(tokens.map((token) => [token, reason]));
/** R4: a `-floor` entry recomputed by the floor step, and the tints made from it. */
const floored = (entry: string, tokens: Array<string>) =>
  because(`R4: ${entry} recomputed by the floor step`, tokens);
const PINK = ["background", "border", "icon", "text"].map((kind) => `--color-${kind}-pink`);
const MEDIA = ["--color-on-dark", "--color-on-light"];

/**
 * The tokens Catppuccin draws differently since themes, each with its ruling: R5's five tokens
 * with no role of their own and the media constants, R4's floor steps recomputed, and the neutral
 * theme's own colours, which no role sets (R11).
 */
const EXCEPT: Record<Mode, Record<string, string>> = {
  dark: {
    "--color-skeleton": "R5: takes chip, Mocha drew surface1",
    "--color-text-gray": "R5: takes ink, Mocha drew subtext1",
    ...because("R5: the pink hue takes changed", PINK),
    ...because("R5: the built theme's constant, not mapped", MEDIA),
    ...floored("overlay2-floor", [
      "--color-icon-gray",
      "--color-syntax-comment",
      "--color-syntax-punctuation",
      "--color-text-disabled",
    ]),
  },
  light: {
    "--color-icon-gray": "R5: takes ink-faint, Latte drew overlay2",
    "--color-icon-secondary": "R5: takes ink-quiet, Latte drew subtext0",
    "--color-skeleton": "R5: takes chip, Latte drew surface0",
    ...because("R5: the pink hue takes changed", PINK),
    ...because("R5: the built theme's constant, not mapped", MEDIA),
    ...floored("mauve-floor", [
      "--astryx-theme-neutral-color-status-fill-accent",
      "--color-accent",
      "--color-accent-muted",
      "--color-background-purple",
      "--color-border-purple",
      "--color-icon-accent",
      "--color-icon-purple",
      "--color-syntax-keyword",
      "--color-text-accent",
      "--color-text-purple",
    ]),
    ...floored("red-floor", [
      "--astryx-theme-neutral-color-status-fill-error",
      "--color-border-red",
      "--color-error",
      "--color-icon-red",
      "--color-syntax-removed",
      "--color-syntax-removed-marker",
      "--color-syntax-tag",
      "--color-text-red",
    ]),
    ...floored("green-floor", [
      "--astryx-theme-neutral-color-status-fill-success",
      "--color-background-green",
      "--color-border-green",
      "--color-icon-green",
      "--color-success",
      "--color-success-muted",
      "--color-syntax-added",
      "--color-syntax-added-marker",
      "--color-syntax-string",
      "--color-text-green",
    ]),
    ...floored("yellow-floor", [
      "--astryx-theme-neutral-color-status-fill-warning",
      "--color-background-yellow",
      "--color-border-yellow",
      "--color-icon-yellow",
      "--color-selection",
      "--color-selection-edge",
      "--color-syntax-attribute",
      "--color-syntax-type",
      "--color-text-yellow",
      "--color-warning",
      "--color-warning-muted",
    ]),
    ...floored("blue-floor", [
      "--astryx-theme-neutral-color-status-muted-accent",
      "--color-background-blue",
      "--color-border-blue",
      "--color-icon-blue",
      "--color-syntax-function",
      "--color-text-blue",
    ]),
    ...floored("peach-floor", [
      "--color-border-orange",
      "--color-icon-orange",
      "--color-syntax-constant",
      "--color-syntax-number",
      "--color-text-orange",
    ]),
    ...floored("sky-floor", [
      "--color-background-cyan",
      "--color-border-cyan",
      "--color-icon-cyan",
      "--color-syntax-operator",
      "--color-text-cyan",
    ]),
    ...floored("teal-floor", ["--color-border-teal", "--color-icon-teal", "--color-text-teal"]),
    ...floored("sapphire-floor", ["--color-border-sapphire", "--color-text-sapphire"]),
    ...floored("lavender-floor", ["--color-syntax-property", "--color-text-lavender"]),
    ...floored("overlay2-floor", [
      "--color-syntax-comment",
      "--color-syntax-punctuation",
      "--color-text-disabled",
    ]),
  },
};
for (const mode of ["dark", "light"] as const) {
  for (const token of Object.keys(today[mode])) {
    if (token.startsWith("--astryx-theme-neutral-color-") && !token.includes("-status-")) {
      EXCEPT[mode][token] = "R11: the neutral theme's own colour, which no role sets";
    }
  }
}

test.each(
  (["dark", "light"] as const).flatMap((mode) =>
    Object.entries(today[mode])
      .filter(([token]) => !(token in EXCEPT[mode]))
      .map(([token, colour]) => [`${token} in ${mode}`, mode, token, colour] as const),
  ),
)("Catppuccin draws today's %s", (_, mode, token, colour) => {
  expect(tokensOf(CATPPUCCIN[mode].roles, mode)[token]).toBe(colour);
});

/** The palette entries R4 recomputed, at the colours picked by hand before themes. */
const HAND_PICKED: Record<Mode, Record<string, string>> = {
  dark: { "overlay2-floor": "#969db8" },
  light: {
    "blue-floor": "#1957d5",
    "green-floor": "#2c6f1f",
    "lavender-floor": "#4254c8",
    "mauve-floor": "#7b2fe0",
    "mauve-tint": "#e3def3",
    "overlay2-floor": "#5f6276",
    "peach-floor": "#a63f00",
    "red-floor": "#bc0d33",
    "sapphire-floor": "#04699a",
    "sky-floor": "#0a688e",
    "teal-floor": "#0f6c72",
    "yellow-floor": "#875800",
  },
};

// R4's rows are mapped too: with the hand-picked colours back, they draw what they drew.
test.each(
  (["dark", "light"] as const).flatMap((mode) =>
    Object.entries(EXCEPT[mode])
      .filter(([, reason]) => reason.startsWith("R4"))
      .map(([token]) => [`${token} in ${mode}`, mode, token] as const),
  ),
)("with the hand-picked floors, Catppuccin draws today's %s", (_, mode, token) => {
  const { roles, sources } = CATPPUCCIN[mode];
  const before = Object.fromEntries(
    Object.entries(roles).map(([role, colour]) => [
      role,
      HAND_PICKED[mode][sources[role]!] ?? colour,
    ]),
  );
  expect(tokensOf(before, mode)[token]).toBe(today[mode][token as keyof (typeof today)[Mode]]);
});

// The exceptions name tokens the fixture holds, so a stale one cannot hide a row.
test("every exception names a token Catppuccin drew", () => {
  for (const mode of ["dark", "light"] as const) {
    for (const token of Object.keys(EXCEPT[mode])) {
      expect(today[mode]).toHaveProperty([token]);
    }
  }
});

/** The built stylesheet's root custom properties: the first `:scope` block that sets the accent. */
function builtRoot(): Map<string, string> {
  const css = readFileSync(new URL("../theme/built/uraeda.css", import.meta.url), "utf8");
  for (const [, body] of css.matchAll(/:scope\s*\{([^}]*)\}/g)) {
    const tokens = new Map<string, string>();
    for (const [, name, value] of body!.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      tokens.set(name!, value!.trim());
    }
    if (tokens.has("--color-accent")) {
      return tokens;
    }
  }
  throw new Error("No root block in the built theme");
}

const root = builtRoot();

/** A built token's value in a mode, its `light-dark()` and `var()` resolved. */
function built(name: string, mode: Mode): string | undefined {
  let value = root.get(name);
  for (;;) {
    const pair = value && /^light-dark\((.+),\s*([^,]+)\)$/.exec(value);
    const reference = value && /^var\((--[\w-]+)\)$/.exec(value);
    if (pair) {
      value = (mode === "light" ? pair[1]! : pair[2]!).trim();
    } else if (reference) {
      value = root.get(reference[1]!);
    } else {
      return value?.toLowerCase();
    }
  }
}

test.each(["dark", "light"] as const)(
  "the built theme draws the shipped Catppuccin, in %s",
  (mode) => {
    const tokens = tokensOf(CATPPUCCIN[mode].roles, mode);
    const drawn = Object.fromEntries(Object.keys(tokens).map((name) => [name, built(name, mode)]));
    expect(drawn).toEqual(tokens);
  },
);

/**
 * The `-floor` entries a shipped theme's roles name, each with its theme. Its merged palette also
 * holds the floors of the theme it extends, which its own palette may make unused (R12).
 */
const FLOORS = themes
  .filter((theme) => theme.isShipped)
  .flatMap((theme) =>
    [...new Set(Object.values(theme.sources))]
      .filter((entry) => entry.endsWith("-floor"))
      .map((floor) => [theme.id, floor, theme] as const),
  );

test.each(FLOORS)("every floor step of %s is the smallest: %s", (_, floor, theme) => {
  const published = theme.palette[floor.slice(0, -"-floor".length)];
  expect(published, `${floor} steps from an entry of the palette`).toBeDefined();
  const mode = theme.mode as Mode;
  const passes = (colour: string) => entryPasses(theme, floor, colour);
  expect(passes("#000000") && passes("#ffffff"), `${floor} is in a measured pair`).toBe(false);

  const [hue, saturation] = hslOf(published!);
  const steps = Array.from({ length: 101 }, (_, lightness) => fromHsl(hue, saturation, lightness));
  const at = steps.indexOf(theme.palette[floor]!);
  expect(at, `${floor} has ${published}'s hue and saturation`).not.toBe(-1);
  expect(passes(steps[at]!), `every pair passes with ${floor}`).toBe(true);
  const back = mode === "dark" ? at - 1 : at + 1;
  expect(passes(steps[back]!), `a step back toward ${published} fails`).toBe(false);
  // Passing is not monotonic in lightness: the first passing step from the published colour.
  const away = mode === "dark" ? "lighter" : "darker";
  expect(theme.palette[floor], `${floor} is the floor step`).toBe(
    floorStep(published!, passes, away),
  );
});

/** Catppuccin's cursor-row tint: the entry it is mixed from, and its share over `base` (R11). */
const TINTS = [
  ["catppuccin-mocha", "mauve", 0.14],
  ["catppuccin-latte", "mauve-floor", 0.1],
] as const;

// The tint is written by hand in the TOML file: a recomputed floor must not leave it stale.
test.each(TINTS)("the mauve-tint of %s is %s mixed over base", (id, from, share) => {
  const { palette } = shipped(id);
  expect(palette["mauve-tint"]).toBe(mix(palette[from]!, share, palette.base!));
});

test("the palette rule drops a name or a colour that is not one", () => {
  const css = paletteCss({
    dark: {
      "--color-accent": "#cba6f7",
      "--color-text": "#fff;} body{color:red",
      "--x;} body{color:red;} .y{--z": "#ffffff",
    },
  });
  expect(css).toBe(
    '[data-astryx-theme="uraeda"][data-theme="dark"] {\n  --color-accent: #cba6f7;\n}\n',
  );
});
