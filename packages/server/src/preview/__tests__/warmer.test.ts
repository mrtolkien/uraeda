// The story warmer on the fake preview, which serves the checkout's source files and logs what it
// served.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vite-plus/test";
import type { Checkout } from "../runner.ts";
import { warmStory } from "../warmer.ts";
import { previews, ready, storyCheckout } from "./helpers.ts";

/** The test feature's base, under which Storybook's served code names its modules. */
const BASE = "/r/repo/preview/2026-10-20-sidebar-resize/";

/**
 * The test feature's checkout with `files` written in it, their paths from its top level, and its
 * ready Storybook: the checkout, and the Storybook's port.
 */
async function readyWith(
  files: Record<string, string>,
): Promise<{ checkout: Checkout; port: number }> {
  const { checkout } = await storyCheckout();
  for (const [path, text] of Object.entries(files)) {
    const file = join(checkout.dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  const runner = previews();
  runner.view(checkout);
  await ready(runner, checkout);
  const state = runner.state(checkout.base);
  if (state?.state !== "ready") {
    throw new Error("Storybook is not ready");
  }
  return { checkout, port: state.port };
}

/** The paths the fake preview on `port` served, in order. */
async function requests(port: number): Promise<Array<string>> {
  const response = await fetch(`http://127.0.0.1:${port}/__requests`);
  return (await response.json()) as Array<string>;
}

test("a story's compile fetches its page's modules and its file's static imports, each once (US3.2)", async () => {
  // A stories file importing a module, which imports one under the base, one missing, one whose
  // address cannot be parsed, and one dynamically.
  const { checkout, port } = await readyWith({
    "packages/web/src/Dep.tsx": `import "${BASE}src/Leaf.tsx";\nimport "./Missing.tsx";\nimport x from "https://";\nimport("./Lazy.tsx");`,
    "packages/web/src/Leaf.tsx": `import "./Dep.tsx";`,
    "packages/web/src/Warm.stories.tsx": `import "./Dep.tsx";\nexport const A = {};`,
  });

  await warmStory(
    port,
    checkout.base,
    { id: "warm--a", importPath: "./src/Warm.stories.tsx" },
    new AbortController().signal,
  );

  const served = await requests(port);
  expect(served).toEqual(
    expect.arrayContaining(["/story.js", "/src/Warm.stories.tsx", "/src/Dep.tsx", "/src/Leaf.tsx"]),
  );
  expect(served.filter((path) => path === "/src/Dep.tsx")).toHaveLength(1);
  expect(served).not.toContain("/src/Lazy.tsx");
});
