// @vitest-environment node
// The UI look decision's offline rule, "checked by a test of the built app" (SC-002): the build the
// server serves, `packages/web/dist`, which `ready` builds before these tests, loads nothing from
// another host. Its page links and loads only its own files, and its stylesheets and scripts import
// no stylesheet, font, or image from an address with a host. `__browser__/offline.test.tsx` checks
// the same of the page Vitest's dev server draws.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));

/** An address another host serves: `http://`, `https://`, or protocol-relative `//host`. */
const FOREIGN = String.raw`(?:https?:)?\/\/`;

/** What loads a file in a stylesheet, or in a script that writes one: `@import`, `url()`, a font. */
const LOADS = [
  new RegExp(String.raw`@import\s+(?:url\(\s*)?["']?${FOREIGN}`, "gi"),
  new RegExp(String.raw`url\(\s*["']?${FOREIGN}`, "gi"),
  new RegExp(String.raw`new FontFace\([^)]*${FOREIGN}`, "gi"),
  /fonts\.(?:googleapis|gstatic)\.com|use\.typekit\.net|fonts\.bunny\.net/gi,
];

/** The places a page loads a file from: an element's `src` or `href`, and its inline styles. */
const PAGE_LOADS = [
  new RegExp(
    String.raw`<(?:link|script|img|iframe|source)\b[^>]*\b(?:src|href)\s*=\s*["']?${FOREIGN}`,
    "gi",
  ),
  ...LOADS,
];

/** The matches of `patterns` in `text`, each with a little of what follows it. */
function found(text: string, patterns: Array<RegExp>) {
  return patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) =>
      text.slice(match.index, match.index + match[0].length + 60),
    ),
  );
}

/** Every file of the build, by its path from `dist`. */
function files(folder = dist, prefix = ""): Array<string> {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(folder, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

test("the built app's page loads only its own files", () => {
  expect(existsSync(join(dist, "index.html")), "packages/web/dist is built").toBe(true);
  const page = readFileSync(join(dist, "index.html"), "utf8");
  expect(page).toMatch(/<script[^>]+src="\/assets\//);
  expect(found(page, PAGE_LOADS)).toEqual([]);
});

test("the built app's stylesheets and scripts load nothing from another host", () => {
  const assets = files().filter((path) => /\.(?:css|js|mjs)$/.test(path));
  expect(assets.some((path) => path.endsWith(".css"))).toBe(true);
  const loads = assets.flatMap((path) =>
    found(readFileSync(join(dist, path), "utf8"), LOADS).map((load) => `${path}: ${load}`),
  );
  expect(loads).toEqual([]);
  // The fonts are bundled: the stylesheet's faces load files of the build.
  const css = assets
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(join(dist, path), "utf8"))
    .join("\n");
  expect(css).toMatch(/@font-face\{[^}]*url\(\/assets\/[^)]+\.woff2\)/);
});
