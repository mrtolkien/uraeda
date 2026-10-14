import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { commitOnBranch, fixtureRepo, git } from "./test-utils.ts";

const CLI = "2026-10-12-cli-tuis";

test("commits on a branch without touching the main checkout or its uncommitted files", () => {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "notes.txt"), "mine\n");
  const head = git(repo, "rev-parse", "HEAD");

  commitOnBranch(repo, CLI, { "src/cli.rs": "fn main() {}\n" });
  commitOnBranch(repo, CLI, { "src/cli.rs": "fn main() { run() }\n" });

  expect(git(repo, "show", `${CLI}:src/cli.rs`)).toBe("fn main() { run() }\n");
  expect(git(repo, "ls-tree", "--name-only", CLI)).not.toContain("notes.txt");
  expect(git(repo, "rev-parse", "HEAD")).toBe(head);
  expect(git(repo, "branch", "--show-current")).toBe("main\n");
  expect(git(repo, "status", "--porcelain")).toBe("?? notes.txt\n");
  expect(existsSync(join(repo, "src/cli.rs"))).toBe(false);
  expect(git(repo, "worktree", "list", "--porcelain")).not.toContain(CLI);
});
