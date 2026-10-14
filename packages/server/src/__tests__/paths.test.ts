import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { layout, requireWeb } from "../paths.ts";
import { temporaryFolder } from "uraeda-binding/test-utils";

test.each([
  {
    expected: {
      checkout: "/work/uraeda",
      kind: "checkout",
      plugin: "/work/uraeda/packages/server/plugin",
      web: "/work/uraeda/packages/web/dist",
    },
    kind: "checkout",
    packaged: false,
    url: "file:///work/uraeda/packages/server/src/paths.ts",
  },
  {
    expected: {
      checkout: null,
      kind: "package",
      plugin: "/home/ana/.npm/_npx/1a/node_modules/uraeda/plugin",
      web: "/home/ana/.npm/_npx/1a/node_modules/uraeda/web",
    },
    kind: "package",
    packaged: true,
    url: "file:///home/ana/.npm/_npx/1a/node_modules/uraeda/dist/uraeda.mjs",
  },
])("the $kind layout", ({ expected, packaged, url }) => {
  expect(layout(packaged, url)).toEqual(expected);
});

test("this checkout's plugin holds the skill", () => {
  const { plugin } = layout();

  expect(existsSync(join(plugin, "skills", "uraeda", "SKILL.md"))).toBe(true);
});

test("a web folder without index.html is not built", () => {
  const web = temporaryFolder("uraeda-web");

  expect(() => requireWeb(web)).toThrow(
    "the web UI is not built; run vp run --filter uraeda-web build",
  );
  writeFileSync(join(web, "index.html"), "");
  expect(() => requireWeb(web)).not.toThrow();
});
