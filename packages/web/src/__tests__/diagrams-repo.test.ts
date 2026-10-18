// @vitest-environment node
// The diagrams decision's choice of `pele`: every `mermaid` block of a file the repository tracks, in
// the specs, the skill's templates and examples, and the fixtures, draws, so no diagram a reader
// opens falls back to its source for a syntax Pele does not read.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "pele";
import { expect, test } from "vite-plus/test";

const root = fileURLToPath(new URL("../../../..", import.meta.url));

/** Every `mermaid` block of a tracked Markdown file, with the file it is in. */
function diagrams(): Array<{ file: string; source: string }> {
  const files = execFileSync("git", ["ls-files", "*.md"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  return files.flatMap((file) => {
    const text = readFileSync(join(root, file), "utf8");
    return [...text.matchAll(/^```mermaid\n([\s\S]*?)^```/gm)].map((match) => ({
      file,
      source: match[1]!,
    }));
  });
}

test("every mermaid block of the repository draws", () => {
  const all = diagrams();
  expect(all.length).toBeGreaterThan(0);
  for (const { file, source } of all) {
    expect(() => render(source), file).not.toThrow();
  }
});
