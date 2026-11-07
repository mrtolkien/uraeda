// The story warmer on the fake preview, which serves the checkout's source files and logs what it
// served.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vite-plus/test";
import type { Checkout, Previews } from "../runner.ts";
import { warmStory } from "../warmer.ts";
import { portOf, previews, ready, servedPaths, storyCheckout } from "./helpers.ts";

/**
 * The test feature's checkout with the files `files(base)` gives written in it, their paths from
 * its top level, `base` the path its Storybook's served code names its modules under, and its ready
 * Storybook: the checkout, and its runner.
 */
async function readyWith(
  files: (base: string) => Record<string, string>,
): Promise<{ checkout: Checkout; runner: Previews }> {
  const { checkout } = await storyCheckout();
  for (const [path, text] of Object.entries(files(checkout.base))) {
    const file = join(checkout.dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  const runner = previews();
  runner.view(checkout);
  await ready(runner, checkout);
  return { checkout, runner };
}

test("a story's compile fetches its page's modules and its file's static imports, each once (US3.2)", async () => {
  // A stories file importing a module, which imports one under the base, one missing, one whose
  // address cannot be parsed, and one dynamically.
  const { checkout, runner } = await readyWith((base) => ({
    "packages/web/src/Dep.tsx": `import "${base}src/Leaf.tsx";\nimport "./Missing.tsx";\nimport x from "https://";\nimport("./Lazy.tsx");`,
    "packages/web/src/Leaf.tsx": `import "./Dep.tsx";`,
    "packages/web/src/Warm.stories.tsx": `import "./Dep.tsx";\nexport const A = {};`,
  }));

  await warmStory(
    portOf(runner, checkout.base),
    checkout.base,
    { id: "warm--a", importPath: "./src/Warm.stories.tsx" },
    new AbortController().signal,
  );

  const served = await servedPaths(runner, checkout.base);
  expect(served).toEqual(
    expect.arrayContaining(["/story.js", "/src/Warm.stories.tsx", "/src/Dep.tsx", "/src/Leaf.tsx"]),
  );
  expect(served.filter((path) => path === "/src/Dep.tsx")).toHaveLength(1);
  expect(served).not.toContain("/src/Lazy.tsx");
});
