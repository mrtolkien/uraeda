// @vitest-environment node
// The picks' stored format, kept in every browser: the mode, a theme per mode, and the cache the
// first paint draws, with the scheme an earlier version stored read as a mode (US1.3), and a pick
// the lists no longer hold drawn as its mode's default (a deleted theme of yours).
import { readThemes } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { drawnTokens, storedDrawn, storedPicks } from "../theme.tsx";
import { tokensOf } from "../theme/roles.ts";

const { themes } = await readThemes(temporaryFolder("uraeda-theme-picks"));

/** The picks with nothing stored. */
const DEFAULTS = { dark: "catppuccin-mocha", light: "catppuccin-latte", mode: "system" };

// Breaks: Mocha picked before themes reading as System (US1.3), or a stored theme lost.
test.each([
  [{}, DEFAULTS],
  // An earlier pick of Mocha reads as the mode Dark, and Latte as Light: the look does not change.
  [{ "uraeda.theme": "mocha" }, { ...DEFAULTS, mode: "dark" }],
  [{ "uraeda.theme": "latte" }, { ...DEFAULTS, mode: "light" }],
  [{ "uraeda.theme": "dark" }, { ...DEFAULTS, mode: "dark" }],
  [{ "uraeda.theme": "light" }, { ...DEFAULTS, mode: "light" }],
  [{ "uraeda.theme": "system" }, DEFAULTS],
  [{ "uraeda.theme": "solarized" }, DEFAULTS],
  [{ "uraeda.theme.dark": "dracula" }, { ...DEFAULTS, dark: "dracula" }],
  [
    { "uraeda.theme": "light", "uraeda.theme.light": "github-light" },
    { ...DEFAULTS, light: "github-light", mode: "light" },
  ],
])("the stored value %j reads as %j", (stored: Record<string, string>, picks) => {
  expect(storedPicks((key) => stored[key] ?? null)).toEqual(picks);
});

/** A theme's tokens, by id. */
function tokensOfTheme(id: string) {
  const theme = themes.find((each) => each.id === id);
  if (!theme) {
    throw new Error(`No theme ${id}`);
  }
  return tokensOf(theme.roles, theme.mode === "dark" ? "dark" : "light");
}

// Breaks: a deleted theme of yours drawing nothing, or the built theme instead of the lists'.
test("an unknown pick draws its mode's default", () => {
  const drawn = drawnTokens(themes, { dark: "ember", light: "dracula", mode: "dark" });
  expect(drawn.dark).toEqual(tokensOfTheme("catppuccin-mocha"));
  // A dark theme picked for light mode is no light theme.
  expect(drawn.light).toEqual(tokensOfTheme("catppuccin-latte"));
});

test("a known pick draws its theme, and a preview replaces its mode's", () => {
  const picks = { dark: "dracula", light: "catppuccin-latte", mode: "system" } as const;
  expect(drawnTokens(themes, picks)).toEqual({
    dark: tokensOfTheme("dracula"),
    light: tokensOfTheme("catppuccin-latte"),
  });
  expect(drawnTokens(themes, picks, "alucard")).toEqual({
    dark: tokensOfTheme("dracula"),
    light: tokensOfTheme("alucard"),
  });
});

// Breaks: a corrupt or older cache throwing at load, or drawing what it cannot (review focus 4).
test.each([
  [null, {}],
  ["{", {}],
  ["[]", {}],
  ["null", {}],
  ['{"dark":"#000000"}', {}],
  ['{"dark":{"--x":"#000000"}}', { dark: { "--x": "#000000" } }],
  ['{"dark":{"--x":3},"light":{"--y":"#ffffff"}}', { light: { "--y": "#ffffff" } }],
])("the drawn cache %j reads as %j", (text, drawn) => {
  expect(storedDrawn(text)).toEqual(drawn);
});
