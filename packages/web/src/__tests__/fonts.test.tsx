// The fonts picked by role: kept in this browser, written as the theme's tokens by the app's root
// from its first draw, and put back to the defaults, which are forgotten rather than kept.
import { act, render } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { DEFAULT_FONTS, FONTS, fontOf, pickFont, restoreDefaultFonts } from "../theme/fonts.ts";
import { PickedFonts } from "../theme/PickedFonts.tsx";

const KEY = "uraeda.fonts";

/** What the fonts' root writes on itself: the fonts picked, as its style's values. */
function rootStyle() {
  const { container } = render(
    <PickedFonts>
      <p>Text</p>
    </PickedFonts>,
  );
  const root = container.firstElementChild as HTMLElement;
  return () => root.getAttribute("style") ?? "";
}

afterEach(() => {
  restoreDefaultFonts();
});

test("an unknown font is the role's default", () => {
  expect(fontOf("reading", "comic-sans").id).toBe(DEFAULT_FONTS.reading);
  expect(fontOf("code", undefined).id).toBe(DEFAULT_FONTS.code);
});

test("the fonts picked before the app draws are on its root from its first draw", () => {
  const inter = FONTS.find((font) => font.id === "inter")!;
  window.localStorage.setItem(KEY, JSON.stringify({ reading: "inter" }));
  pickFont("reading", "inter");
  const style = rootStyle();
  expect(style()).toContain(inter.family);
  // Each font sets its own measure, so a line holds about 80 characters whatever it is.
  expect(style()).toContain(`calc(${inter.measure} *`);
});

test("a font picked is kept in this browser and redrawn on the root", () => {
  const style = rootStyle();
  const literata = FONTS.find((font) => font.id === "literata")!;
  expect(style()).not.toContain(literata.family);
  act(() => pickFont("heading", "literata"));
  expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}").heading).toBe("literata");
  expect(style()).toContain(literata.family);
});

test("restoring the defaults forgets the fonts picked", () => {
  pickFont("heading", "inter");
  restoreDefaultFonts();
  expect(window.localStorage.getItem(KEY)).toBeNull();
  const heading = fontOf("heading", DEFAULT_FONTS.heading);
  expect(rootStyle()()).toContain(heading.family);
});
