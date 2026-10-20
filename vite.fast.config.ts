import { globSync } from "node:fs";
import { resolve } from "node:path";
import type { TestProjectInlineConfiguration } from "vite-plus";
import { uiTransforms } from "./packages/web/vite.transforms.ts";
import { testWorkers } from "./scripts/test-policy.ts";
import { families, type Family, type FastSelection } from "./scripts/fast-selection.ts";

/** Inline projects never inherit a package's production startup or native freshness imports. */
export function fastConfig(selection: FastSelection) {
  const selected = (Object.keys(families) as Array<Family>).filter(
    (name) =>
      selection.families.includes(name) ||
      selection.related.some((path) => path.startsWith(`${families[name].root}/`)),
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
            env: { TZ: "UTC" },
            environment: name === "ui" ? "happy-dom" : "node",
            include: family.tests,
            name: `fast-${name}`,
            setupFiles: family.native
              ? [resolve("packages/binding/test-setup.ts")]
              : name === "ui"
                ? [resolve("packages/web/src/__tests__/setup.ts")]
                : [],
            testTimeout: 20_000,
          },
        };
      }),
      watch: false,
    },
  };
}
