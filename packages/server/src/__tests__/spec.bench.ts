import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { commitOnBranch, fixtureRepo } from "uraeda-binding/test-utils";

const binding = await import("uraeda-binding");

const FOLDER = "2026-10-06-recurring-tasks";
const NAMES = ["agents", "git", "stack", "tui", "ui-behaviour"];

/** The mean before the branch's decision changes were read, measured on the same fixture. */
const BASELINE_MS = 20.6;

/** A fixture repository whose feature branch rewords a rule of each of 5 decisions. */
function repoChangingFive(): string {
  const repo = fixtureRepo();
  const files: Record<string, string> = {};
  for (const name of NAMES) {
    const path = `specs/decisions/${name}.md`;
    const text = readFileSync(join(repo, path), "utf8");
    files[path] =
      `${text.replace("MUST", "MUST always")}\n- A new rule MAY be added. Checked by review.\n`;
  }
  commitOnBranch(repo, FOLDER, files);
  return repo;
}

/** SC-003, with `vp run bench`. */
test("SC-003: a spec whose branch changes 5 decisions opens at most 200 ms slower than before", async ({
  bench,
}) => {
  const repo = repoChangingFive();
  const read = await binding.readFile(repo, FOLDER, "spec.md");
  expect(read.decisionChanges.map(({ name }) => name)).toEqual(NAMES);
  const result = await bench("open the spec", async () => {
    await binding.readFile(repo, FOLDER, "spec.md");
  }).run();

  process.stdout.write(`The spec opened in ${result.latency.mean.toFixed(1)} ms on average.\n`);
  expect(result.latency.mean).toBeLessThan(BASELINE_MS + 200);
});
