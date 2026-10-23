// The UI look decision's bundled fonts (US1 more 2, SC-002): the home draws in its fonts with no
// request to another host, as on a machine with no network.
import { expect, test } from "vite-plus/test";
import { LIVE, show } from "./helpers.tsx";

/** The addresses a stylesheet's rules load: its imports, and its fonts' files, nested ones too. */
function loads(rules: CSSRuleList, base: string): Array<string> {
  return [...rules].flatMap((rule) => {
    if (rule.cssText.startsWith("@import")) {
      return [new URL((rule as CSSImportRule).href, base).href];
    }
    if (rule.cssText.startsWith("@font-face")) {
      const src = (rule as CSSFontFaceRule).style.getPropertyValue("src");
      return [...src.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(
        ([, url]) => new URL(url!, base).href,
      );
    }
    return "cssRules" in rule ? loads((rule as CSSGroupingRule).cssRules, base) : [];
  });
}

test("the home loads its fonts and makes no request to another host", async () => {
  await show("/", "Priorities");
  // Both fonts are bundled and drawn: JetBrains Mono for the UI, Inter for reading text.
  // `load` resolves with no face while the stylesheet declaring a family has not arrived yet, as
  // on a busy machine: it is asked again, as long as live data is waited for, until it loads a face
  // of each family.
  for (const family of ["JetBrains Mono Variable", "Inter Variable"]) {
    await expect
      .poll(async () => (await document.fonts.load(`16px "${family}"`)).length, LIVE)
      .toBeGreaterThan(0);
  }
  await document.fonts.ready;
  // The requests are read once the fonts loaded, so a font's file fetched from another host counts.
  const requested = [
    ...performance.getEntriesByType("resource").map((entry) => entry.name),
    ...[...document.styleSheets].flatMap((sheet) =>
      loads(sheet.cssRules, sheet.href ?? window.location.href),
    ),
  ];
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.filter((url) => new URL(url).origin !== window.location.origin)).toEqual([]);
  const loaded = [...document.fonts]
    .filter((face) => face.status === "loaded")
    .map((face) => face.family.replaceAll(/["']/g, ""));
  expect(loaded).toEqual(expect.arrayContaining(["JetBrains Mono Variable", "Inter Variable"]));
});
