// @vitest-environment node
// The diagrams decision's rule, and the redesign's review focus 5: `mermaid` is never in the build's
// main bundle, only in chunks of its own that a page with a diagram loads. It reads the build `vp run
// web:build` left in `dist/`, which `vp run ts:test` builds first.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));

/** A text only Mermaid's own code holds: the role it gives every diagram's SVG. */
const MERMAID = "graphics-document document";

/** The scripts the build's page loads at once: its entry, and what the entry imports statically. */
function mainBundle(): Array<string> {
  const page = readFileSync(join(dist, "index.html"), "utf8");
  const scripts = [...page.matchAll(/<(?:script|link)[^>]+(?:src|href)="\/assets\/([^"]+\.js)"/g)];
  return scripts.map((match) => match[1]!);
}

test("the main bundle holds no mermaid, which a chunk of its own holds", () => {
  expect(existsSync(join(dist, "index.html")), "run `vp run web:build` first").toBe(true);
  const main = mainBundle();
  expect(main.length).toBeGreaterThan(0);
  for (const file of main) {
    expect(readFileSync(join(dist, "assets", file), "utf8"), file).not.toContain(MERMAID);
  }
  const chunks = readdirSync(join(dist, "assets")).filter(
    (file) =>
      file.endsWith(".js") &&
      !main.includes(file) &&
      readFileSync(join(dist, "assets", file), "utf8").includes(MERMAID),
  );
  expect(chunks.length).toBeGreaterThan(0);
});
