// @vitest-environment node
// The UI components and code quality decisions' rules a linter enforces, as `vp run ready` checks them.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const src = fileURLToPath(new URL("..", import.meta.url));

/** `vp lint` on a file of `packages/web`, with the repository's config. */
function lint(file: string) {
  return spawnSync(join(root, "node_modules/.bin/vp"), ["lint", `packages/web/${file}`], {
    cwd: root,
    encoding: "utf8",
    // The fixtures are left out of the normal lint.
    env: { ...process.env, URAEDA_LINT_FIXTURES: "1" },
  });
}

/** What `vp lint` reports on a file of `packages/web`. */
function lintOutput(file: string) {
  const result = lint(file);
  return `${result.stdout}${result.stderr}`;
}

test.each([
  ["raw-button.tsx", "react(forbid-elements)"],
  ["style-prop.tsx", "react(forbid-dom-props)"],
  ["class-name.tsx", "react(forbid-component-props)"],
  ["raw-color.tsx", "valid-styles"],
  // A `test.only` left behind fails the lint.
  ["only-test.test.tsx", "no-only-tests"],
  // The code quality decision: a marker left on code that no longer breaks its rule fails.
  ["unused-directive.tsx", "Unused oxlint-disable directive"],
  // The code quality decision's limits, each fixture just over its limit.
  ["long-function.tsx", "max-lines-per-function"],
  ["long-file.tsx", "max-lines"],
  ["many-params.tsx", "max-params"],
  ["deep-nesting.tsx", "max-depth"],
])("lint refuses %s", (file, rule) => {
  expect(lintOutput(`src/__lint__/${file}`)).toContain(rule);
});

test("a suppression with its reason passes", () => {
  // Its summary reads "0 errors" on some runs: the exit status says it passed.
  const result = lint("src/__lint__/suppressed.tsx");
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
});

test("a marked function over the limit passes", () => {
  const result = lint("src/__lint__/marked-function.tsx");
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
});

test("no stylesheet but Astryx's is imported", () => {
  const allowed = [
    "@astryxdesign/core/reset.css",
    "@astryxdesign/core/astryx.css",
    "./theme/built/uraeda.css",
    "../theme/built/uraeda.css",
  ];
  const imports: Array<string> = [];
  for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      const text = readFileSync(join(entry.parentPath, entry.name), "utf8");
      for (const [, path] of text.matchAll(/import\s+(?:[^"']*from\s+)?["']([^"']+\.css)["']/g)) {
        imports.push(path!);
      }
    }
  }
  expect(imports.length).toBeGreaterThan(0);
  expect(imports.filter((path) => !allowed.includes(path))).toEqual([]);
  expect(readdirSync(src)).not.toContain("styles.css");
});
