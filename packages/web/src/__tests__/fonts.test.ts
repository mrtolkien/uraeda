// The fonts picked by role: kept in this browser, written as the theme's tokens before the app
// draws, and put back to the defaults, which are forgotten rather than kept.
import { afterEach, expect, test } from "vite-plus/test";
import {
  applyStoredFonts,
  DEFAULT_FONTS,
  FONTS,
  fontOf,
  pickFont,
  restoreDefaultFonts,
} from "../theme/fonts.ts";

const KEY = "uraeda.fonts";

/** The stylesheet the fonts write. */
const sheet = () => document.querySelector("style[data-uraeda-fonts]")?.textContent ?? "";

afterEach(() => {
  restoreDefaultFonts();
});

test("an unknown font is the role's default", () => {
  expect(fontOf("reading", "comic-sans").id).toBe(DEFAULT_FONTS.reading);
  expect(fontOf("code", undefined).id).toBe(DEFAULT_FONTS.code);
});

test("a font picked is kept in this browser and written as its role's token", () => {
  const inter = FONTS.find((font) => font.id === "inter")!;
  pickFont("reading", "inter");
  expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}").reading).toBe("inter");
  expect(sheet()).toContain(`--font-family-reading: ${inter.family};`);
  // Each font sets its own measure, so a line holds about 80 characters whatever it is.
  expect(sheet()).toContain(`--size-reading-measure: calc(${inter.measure} *`);
});

test("restoring the defaults forgets the fonts picked", () => {
  pickFont("heading", "inter");
  restoreDefaultFonts();
  expect(window.localStorage.getItem(KEY)).toBeNull();
  const heading = fontOf("heading", DEFAULT_FONTS.heading);
  expect(sheet()).toContain(`--font-family-heading: ${heading.family};`);
});

test("the human's sent messages take their own font, through `data-words`", () => {
  applyStoredFonts();
  expect(sheet()).toContain('[data-words="human"]');
  expect(sheet()).toContain("font-family: var(--font-family-human);");
});
