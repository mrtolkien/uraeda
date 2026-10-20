import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { commitOnBranch, commitsAt, fixtureRepo, git } from "./test-utils.ts";

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

/** What a fixture repository's history, refs, index, configuration, and files hold. */
function state(repo: string) {
  return {
    branches: git(repo, "for-each-ref", "--format=%(refname) %(objectname)"),
    config: git(repo, "config", "--local", "--list"),
    head: git(repo, "symbolic-ref", "HEAD"),
    priorities: readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8"),
    status: git(repo, "status", "--porcelain", "--untracked-files=all"),
    worktrees: git(repo, "worktree", "list", "--porcelain").replaceAll(repo, "<repo>"),
  };
}

/** Whether a repository holds an object. */
function holds(repo: string, object: string): boolean {
  try {
    git(repo, "cat-file", "-e", object);
    return true;
  } catch {
    return false;
  }
}

/** Every file under a folder, by its full path. */
function filesUnder(folder: string): Array<string> {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

test("each fixture repository owns its history, refs, index, configuration, and files", () => {
  const before = fixtureRepo();
  const original = state(before);
  const changed = fixtureRepo();
  expect(changed).not.toBe(before);
  expect(state(changed)).toEqual(original);

  // Every kind of mutable state a test changes: a commit on the checked-out branch, a new object,
  // a moved and a new ref, the index, the configuration, and the working files.
  writeFileSync(join(changed, "specs/PRIORITIES.md"), "changed\n");
  git(changed, "commit", "--quiet", "--no-verify", "--all", "--message", "change main");
  const commit = git(changed, "rev-parse", "HEAD").trim();
  git(changed, "branch", "--force", CLI, "HEAD");
  git(changed, "tag", "changed");
  git(changed, "config", "user.name", "Changed");
  writeFileSync(join(changed, "staged.txt"), "staged\n");
  git(changed, "add", "staged.txt");
  writeFileSync(join(changed, "loose.txt"), "loose\n");
  git(changed, "gc", "--quiet", "--prune=now");

  const after = fixtureRepo();
  for (const repo of [before, after]) {
    expect(state(repo)).toEqual(original);
    expect(holds(repo, commit)).toBe(false);
    expect(existsSync(join(repo, "staged.txt"))).toBe(false);
  }
  // No git data is shared, even through a hard link or an alternate object store: a copy's file
  // with another link may be changed in place through that link.
  for (const repo of [before, changed, after]) {
    const linked = filesUnder(join(repo, ".git")).filter((file) => statSync(file).nlink > 1);
    expect(linked).toEqual([]);
    expect(existsSync(join(repo, ".git/objects/info/alternates"))).toBe(false);
  }
});

test("a fixture repository's linked worktrees point at its own files only", () => {
  const first = fixtureRepo();
  const worktree = join(first, ".worktrees", CLI);
  git(first, "worktree", "add", "--quiet", worktree, CLI);
  const second = fixtureRepo();

  // The worktree's link and its metadata name the first repository, and the second has none.
  expect(readFileSync(join(worktree, ".git"), "utf8")).toBe(
    `gitdir: ${join(first, ".git/worktrees", CLI)}\n`,
  );
  expect(readFileSync(join(first, ".git/worktrees", CLI, "gitdir"), "utf8")).toBe(
    `${join(worktree, ".git")}\n`,
  );
  expect(git(second, "worktree", "list", "--porcelain")).toBe(
    `worktree ${second}\nHEAD ${git(second, "rev-parse", "HEAD").trim()}\nbranch refs/heads/main\n\n`,
  );
  expect(existsSync(join(second, ".git/worktrees"))).toBe(false);
  // Its own checkout of the branch the first holds, committed on without reaching the first.
  const own = join(second, ".worktrees", CLI);
  git(second, "worktree", "add", "--quiet", own, CLI);
  writeFileSync(join(own, "own.txt"), "own\n");
  git(own, "add", "own.txt");
  git(own, "commit", "--quiet", "--no-verify", "--message", "own");
  expect(git(first, "ls-tree", "--name-only", CLI)).not.toContain("own.txt");
  expect(existsSync(join(worktree, "own.txt"))).toBe(false);
});

test("a commit that fails on a branch removes the temporary worktree it added", () => {
  const repo = fixtureRepo();
  const worktrees = () => git(repo, "worktree", "list", "--porcelain");
  const listed = worktrees();
  // An empty message aborts the commit.
  expect(() => commitsAt(repo, CLI, [{ files: { "a.txt": "a\n" }, message: "" }])).toThrow();
  expect(worktrees()).toBe(listed);
  expect(existsSync(join(repo, ".git/worktrees"))).toBe(false);
});

/** How many of the tests' temporary folders the file's temporary folder holds. */
function leftovers(): number {
  return readdirSync(tmpdir()).filter((name) => name.startsWith("uraeda-")).length;
}

test("a fixture that fails to build leaves no repository and fails again when asked again", () => {
  const count = leftovers();
  expect(() => fixtureRepo("missing")).toThrow();
  expect(() => fixtureRepo("missing")).toThrow();
  expect(leftovers()).toBe(count);
  // A working fixture still builds after the failure.
  const repo = fixtureRepo();
  expect(execFileSync("git", ["log", "--oneline"], { cwd: repo, encoding: "utf8" })).toContain(
    "chore: specs",
  );
});
