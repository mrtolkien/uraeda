// @vitest-environment node
// SC-001 and SC-002: the UI components decision's rules, as `vp run ready` checks them.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
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
  // The UI coherence decision: markdown goes through `Prose.tsx`.
  ["raw-markdown.tsx", "no-restricted-imports"],
  // US3.6: a `test.only` left behind fails the lint.
  ["only-test.test.tsx", "no-only-tests"],
  // The code quality decision: a marker left on code that no longer breaks its rule fails.
  ["unused-directive.tsx", "Unused oxlint-disable directive"],
  // US3.2 and SC-005: the code quality decision's limits, each fixture just over its limit.
  ["long-function.tsx", "max-lines-per-function"],
  ["long-file.tsx", "max-lines"],
  ["many-params.tsx", "max-params"],
  ["deep-nesting.tsx", "max-depth"],
])("lint refuses %s (SC-002)", (file, rule) => {
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

test("no stylesheet but Astryx's is imported (SC-001)", () => {
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

/** Files that still set the reading size by hand: each moves to `Prose.tsx`'s styles, none joins. */
const LEGACY_READING = [
  "Folds.tsx",
  "Question.tsx",
  "RoundPage.tsx",
  "spec/BuiltParts.tsx",
  "spec/DecisionCard.tsx",
  "spec/SpecOpening.tsx",
  "spec/StoryCard.tsx",
];

test("reading text is set in Prose.tsx, bar the files that still move there (UI coherence)", () => {
  const found: Array<string> = [];
  for (const entry of readdirSync(src, { recursive: true, withFileTypes: true })) {
    const file = relative(src, join(entry.parentPath, entry.name));
    if (!entry.isFile() || !/\.tsx?$/.test(file) || /^(theme|__)|stories|\.test\./.test(file)) {
      continue;
    }
    if (/text-reading-|size-reading-measure/.test(readFileSync(join(src, file), "utf8"))) {
      found.push(file);
    }
  }
  expect(found.filter((file) => file !== "Prose.tsx" && !LEGACY_READING.includes(file))).toEqual(
    [],
  );
});
