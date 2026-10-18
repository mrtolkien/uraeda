import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { commitOnBranch, fixtureRepo, git, temporaryFolder } from "uraeda-binding/test-utils";

const binding = await import("uraeda-binding");

const FOLDER = "2026-10-06-recurring-tasks";
const NAMES = ["agents", "git", "stack", "tui", "ui-behaviour"];

/** The mean before the branch's decision changes were read, measured on the fixture of 5 decisions. */
const BASELINE_MS = 20.6;

/** The decisions both branches hold unchanged, as the repository's folder holds about 20. */
const UNCHANGED = 15;

/** A fixture repository whose feature branch rewords a rule of each of 5 decisions, beside 15. */
function repoChangingFive(): string {
  const repo = fixtureRepo();
  const same: Record<string, string> = {};
  for (let index = 0; index < UNCHANGED; index++) {
    const text = readFileSync(
      join(repo, `specs/decisions/${NAMES[index % NAMES.length]}.md`),
      "utf8",
    );
    same[`specs/decisions/unchanged-${index}.md`] = text;
  }
  commitOnBranch(repo, "main", same);
  // The branch merges them in, so they are at its merge base and unchanged.
  const worktree = join(temporaryFolder("uraeda-bench"), "worktree");
  git(repo, "worktree", "add", "--quiet", worktree, FOLDER);
  git(worktree, "merge", "--quiet", "--no-edit", "main");
  git(repo, "worktree", "remove", "--force", worktree);
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
