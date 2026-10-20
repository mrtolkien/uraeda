import { globSync } from "node:fs";
import { resolve } from "node:path";
import type { TestProjectInlineConfiguration } from "vite-plus";
import { uiTestOptions, uiTransforms } from "./packages/web/vite.transforms.ts";
import { gitTestTimeout, scriptsTestTimeout, testWorkers } from "./scripts/test-policy.ts";
import { families, type Family, type FastSelection, matches } from "./scripts/fast-selection.ts";

const binding = resolve("packages/binding/test-setup.ts");
/**
 * The other families' test settings, those of their packages' configurations (`vite.config.ts`,
 * which an inline project never loads): the same setup files and time bounds, and nothing more. The
 * package family's has none, so keeps Vitest's defaults as `vp test` there.
 */
const packageOptions: Record<
  Exclude<Family, "ui">,
  NonNullable<TestProjectInlineConfiguration["test"]>
> = {
  benchmarks: { testTimeout: gitTestTimeout },
  binding: { setupFiles: [binding], testTimeout: gitTestTimeout },
  package: {},
  scripts: { testTimeout: scriptsTestTimeout },
  server: { setupFiles: [binding], testTimeout: gitTestTimeout },
};

/** Inline projects never inherit a package's production startup or native freshness imports. */
export function fastConfig(selection: FastSelection) {
  // Before the plugins are made: the stylex plugin reads it, and without it keeps a dev server's
  // timer, which holds the process open after the tests end.
  process.env.VITEST = "true";
  const selected = (Object.keys(families) as Array<Family>).filter(
    (name) =>
      selection.families.includes(name) ||
      selection.related.some((path) => matches(path, families[name].inputs)),
  );
  const wholeTests = selected
    .filter((name) => selection.families.includes(name))
    .flatMap((name) => {
      const family = families[name];
      const files = globSync(family.tests, { cwd: resolve(family.root) });
      if (!files.length) {
        throw new Error(`Selected family ${name} has no test files`);
      }
      return files.map((file) => resolve(family.root, file));
    });
  return {
    related: [...selection.related.map((file) => resolve(file)), ...wholeTests],
    test: {
      maxWorkers: testWorkers,
      projects: selected.map((name): TestProjectInlineConfiguration => {
        const family = families[name];
        return {
          extends: false,
          plugins: name === "ui" ? uiTransforms() : [],
          root: resolve(family.root),
          test: {
            ...(name === "ui" ? uiTestOptions() : packageOptions[name]),
            include: family.tests,
            name: `fast-${name}`,
          },
        };
      }),
      watch: false,
    },
  };
}
