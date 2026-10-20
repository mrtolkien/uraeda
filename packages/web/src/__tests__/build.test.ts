// @vitest-environment node
// The diagrams decision's rule, and the redesign's review focus 5: `pele` is never in the build's
// main bundle, only in chunks of its own that a page with a diagram loads. It reads the build `vp run
// web:build` left in `dist/`, which `vp run ts:test` builds first.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));

/** A text only Pele's own code holds: the role it gives every diagram's SVG. */
const PELE = "graphics-document document";

/** The scripts the build's page loads at once: its entry, and what the entry imports statically. */
function mainBundle(): Array<string> {
  const page = readFileSync(join(dist, "index.html"), "utf8");
  const scripts = [...page.matchAll(/<(?:script|link)[^>]+(?:src|href)="\/assets\/([^"]+\.js)"/g)];
  return scripts.map((match) => match[1]!);
}

test("the main bundle holds no pele, which chunks of their own hold", () => {
  expect(existsSync(join(dist, "index.html")), "run `vp run web:build` first").toBe(true);
  const main = mainBundle();
  expect(main.length).toBeGreaterThan(0);
  for (const file of main) {
    expect(readFileSync(join(dist, "assets", file), "utf8"), file).not.toContain(PELE);
  }
  const chunks = readdirSync(join(dist, "assets")).filter(
    (file) =>
      file.endsWith(".js") &&
      !main.includes(file) &&
      readFileSync(join(dist, "assets", file), "utf8").includes(PELE),
  );
  expect(chunks.length).toBeGreaterThan(0);
});

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
