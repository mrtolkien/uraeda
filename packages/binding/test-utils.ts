import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, onTestFinished, vi } from "vite-plus/test";

const fixtures = join(import.meta.dirname, "../../fixtures");

/**
 * Keeps git away from the machine's: every test that builds a repository imports this module, and
 * the core's own git commands, run by the binding in the same process, inherit its environment. A
 * global or system `core.hooksPath` or `init.templateDir` would run the developer's hooks on the
 * tests' commits, and the variables a git hook exports would point git at another repository. Each
 * repository's own configuration still applies.
 */
function isolateGit() {
  process.env.GIT_CONFIG_GLOBAL = "/dev/null";
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) {
    delete process.env[name];
  }
}
isolateGit();

const temporary: Array<string> = [];
process.once("exit", () => {
  for (const folder of temporary) {
    rmSync(folder, { force: true, recursive: true });
  }
});

/**
 * A new folder in the system's temporary folder, its name starting with `<prefix>-`, removed when
 * the process exits: thousands of test runs would otherwise fill a `/tmp` held in memory.
 */
export function temporaryFolder(prefix: string): string {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), `${prefix}-`)));
  temporary.push(folder);
  return folder;
}

/** A path inside the repository's shared `fixtures/` folder. */
export function fixture(path: string): string {
  // Not `new URL(path, import.meta.url)`: Vite rewrites that pattern in the UI's tests.
  return join(fixtures, path);
}

/** Runs git in a folder, without hooks, and returns its output. */
export function git(cwd: string, ...args: Array<string>): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * A git repository in a temporary folder, built from `fixtures/<name>/`: `main/` committed on
 * `main`, then each folder of `branches/` committed on a branch of its name, from `main`. The
 * checkout is left on `main`.
 */
export function fixtureRepo(name = "repo"): string {
  const source = fixture(name);
  const repo = temporaryFolder("uraeda-repo");
  git(repo, "init", "--quiet", "--initial-branch", "main");
  for (const [key, value] of [
    ["user.name", "Test"],
    ["user.email", "test@example.com"],
    ["commit.gpgSign", "false"],
  ]) {
    git(repo, "config", key, value);
  }
  cpSync(join(source, "main"), repo, { recursive: true });
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: specs");
  const branches = join(source, "branches");
  for (const branch of existsSync(branches) ? readdirSync(branches).sort() : []) {
    git(repo, "switch", "--quiet", "--create", branch, "main");
    cpSync(join(branches, branch), repo, { recursive: true });
    git(repo, "add", "--all");
    git(repo, "commit", "--quiet", "--no-verify", "--message", `work on ${branch}`);
    git(repo, "switch", "--quiet", "main");
  }
  return repo;
}

/**
 * Commits files on a branch of a fixture repository, their paths from its top level, in a
 * temporary worktree: the main checkout, its files, and its uncommitted changes are left as they
 * are, so a watcher of the repository never sees the branch's files there.
 */
export function commitOnBranch(repo: string, branch: string, files: Record<string, string>) {
  const worktree = join(temporaryFolder("uraeda-branch"), "worktree");
  git(repo, "worktree", "add", "--quiet", worktree, branch);
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(worktree, path)), { recursive: true });
      writeFileSync(join(worktree, path), text);
    }
    git(worktree, "add", "--", ...Object.keys(files));
    git(worktree, "commit", "--quiet", "--no-verify", "--message", `work on ${branch}`);
  } finally {
    git(repo, "worktree", "remove", "--force", worktree);
  }
}

/** A plan's task: its title, its checked steps, and its steps. */
export type PlanTask = [title: string, done: number, total: number];

/** A plan of 11 tasks of 5 steps, the first 6 done: the 7th, "Session column", is current. */
export const ELEVEN: Array<PlanTask> = [
  "Plan progress in the core",
  "One parser for plan tasks",
  "Branch changes in the core",
  "Branch changes on the server",
  "Sidebar slugs and progress",
  "The session's own page",
  "Session column",
  "Jump to the latest",
  "The phone's progress line",
  "Announcements",
  "Layout decision checks",
].map((title, index) => [title, index < 6 ? 5 : 0, 5]);

/**
 * Commits `specs/<folder>/plan.md` on the folder's branch, for spec revision 1, with its tasks'
 * steps written `- [x] **Step N: Do**`, without touching the main checkout. Called again, it
 * commits the plan's new text.
 */
export function addPlan(
  repo: string,
  folder: string,
  tasks: Array<PlanTask>,
  status = "auto-approved",
) {
  commitOnBranch(repo, folder, { [`specs/${folder}/plan.md`]: planText(tasks, status) });
}

/** A plan's text, for spec revision 1, with its tasks' steps written `- [x] **Step N: Do**`. */
export function planText(tasks: Array<PlanTask>, status = "auto-approved") {
  let text = `---\nstatus: ${status}\nspec-revision: 1\n---\n\n# Plan: Feature\n`;
  for (const [index, [title, done, total]] of tasks.entries()) {
    text += `\n## Task ${index + 1}: ${title}\n\n`;
    for (let step = 0; step < total; step++) {
      text += `- [${step < done ? "x" : " "}] **Step ${step + 1}: Do**\n`;
    }
  }
  return text;
}

/** A logger a test can spy on, as `process.stderr` or `console`, by the name of its method. */
type Logger = Record<string, (...args: Array<unknown>) => unknown>;

/**
 * Keeps the messages a test expects out of its log, and only those: until the test ends, the calls
 * of `target[method]` whose arguments, joined, match `expected` are swallowed, and every other goes
 * through to the real logger and fails the test once it ends. Returns the spy, to check the
 * expected calls.
 */
export function expectLogged(
  target: typeof process.stderr | typeof console,
  method: "write" | "error",
  expected: RegExp,
) {
  const logger = target as unknown as Logger;
  const real = logger[method]!.bind(target);
  const unexpected: Array<string> = [];
  const spy = vi.spyOn(logger, method).mockImplementation((...args: Array<unknown>) => {
    const text = args.map(String).join(" ");
    if (expected.test(text)) {
      return true;
    }
    unexpected.push(text);
    return real(...args);
  });
  onTestFinished(() => {
    spy.mockRestore();
    expect(unexpected, `only messages matching ${expected} are logged`).toEqual([]);
  });
  return spy;
}
