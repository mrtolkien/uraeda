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
 * Commits files on a branch of a fixture repository, their paths from its top level, and leaves
 * the checkout on `main`.
 */
export function commitOnBranch(repo: string, branch: string, files: Record<string, string>) {
  git(repo, "switch", "--quiet", branch);
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), text);
    }
    git(repo, "add", "--all");
    git(repo, "commit", "--quiet", "--no-verify", "--message", `work on ${branch}`);
  } finally {
    git(repo, "switch", "--quiet", "main");
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
 * steps written `- [x] **Step N: Do**`, and leaves the checkout on `main`. Called again, it
 * commits the plan's new text.
 */
export function addPlan(
  repo: string,
  folder: string,
  tasks: Array<PlanTask>,
  status = "auto-approved",
) {
  let text = `---\nstatus: ${status}\nspec-revision: 1\n---\n\n# Plan: Feature\n`;
  for (const [index, [title, done, total]] of tasks.entries()) {
    text += `\n## Task ${index + 1}: ${title}\n\n`;
    for (let step = 0; step < total; step++) {
      text += `- [${step < done ? "x" : " "}] **Step ${step + 1}: Do**\n`;
    }
  }
  commitOnBranch(repo, folder, { [`specs/${folder}/plan.md`]: text });
}
