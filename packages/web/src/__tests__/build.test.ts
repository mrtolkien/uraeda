// @vitest-environment node
// The Sandbox decision's rule, "checked by a test of the build's output": the sandbox's code,
// sample projects, and picker never reach the built app. It reads the build `vp run web:build` left
// in `dist/`, which `vp run ts:test` builds first.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));

/**
 * Texts only the sandbox's code holds: the source locations' attribute and code-inspector's names,
 * the pick script's file, the bar's component and entry, and the pick's first line.
 */
const SANDBOX_ONLY = [
  "data-insp-path",
  "code-inspector",
  "uraeda-pick",
  "SandboxBar",
  "mountSandboxBar",
  "Sandbox pick:",
];

/** Every file of the build, by its path from `dist/`. */
function built(folder = dist): Array<string> {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? built(join(folder, entry.name)) : [join(folder, entry.name)],
  );
}

test("the build holds no sandbox code, source attribute, or code-inspector client", () => {
  expect(existsSync(join(dist, "index.html")), "run `vp run web:build` first").toBe(true);
  for (const file of built()) {
    const text = readFileSync(file, "utf8");
    for (const sandbox of SANDBOX_ONLY) {
      expect(text.includes(sandbox), `${sandbox} in ${file}`).toBe(false);
    }
  }
});
