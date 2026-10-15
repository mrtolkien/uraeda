import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
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
 * are, so a watcher of the repository never sees the branch's files there. A file given `null` is
 * removed.
 */
export function commitOnBranch(repo: string, branch: string, files: Record<string, string | null>) {
  const worktree = join(temporaryFolder("uraeda-branch"), "worktree");
  git(repo, "worktree", "add", "--quiet", worktree, branch);
  try {
    for (const [path, text] of Object.entries(files)) {
      if (text === null) {
        rmSync(join(worktree, path), { force: true });
        continue;
      }
      mkdirSync(dirname(join(worktree, path)), { recursive: true });
      writeFileSync(join(worktree, path), text);
    }
    git(worktree, "add", "--all", "--", ...Object.keys(files));
    git(worktree, "commit", "--quiet", "--no-verify", "--message", `work on ${branch}`);
  } finally {
    git(repo, "worktree", "remove", "--force", worktree);
  }
}

/**
 * Creates the change `folder` on its branch `change/<folder>`, from `main`, with each file committed
 * at `specs/changes/<folder>/<file>`, without touching the main checkout.
 */
export function addChange(repo: string, folder: string, files: Record<string, string>) {
  const branch = `change/${folder}`;
  git(repo, "branch", branch, "main");
  commitOnBranch(
    repo,
    branch,
    Object.fromEntries(
      Object.entries(files).map(([file, text]) => [`specs/changes/${folder}/${file}`, text]),
    ),
  );
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

/** How the fake preview, `fixtures/preview/serve.mjs`, behaves: see its header. */
export type FakeMode = "ok" | "fail" | "hang" | "bad-index" | "no-pick";

/** The preview decision's path, from a checkout's top level. */
const PREVIEW_DECISION = "specs/decisions/preview.md";

/**
 * An active preview decision running the fake preview in `folder`, logging its starts to `log`.
 * The command ends in `&& true`, so its shell waits for the fake, as `pnpm exec` waits for
 * Storybook: only a signal to the whole process group stops both.
 */
function previewDecision(log: string, folder: string, mode: FakeMode, delay: number): string {
  const command = `node ${fixture("preview/serve.mjs")} --port {port} --mode ${mode} --delay ${delay} --log ${log} && true`;
  return `---\nstatus: active\napproved-by: Test\npreview-folder: ${folder}\npreview-command: ${command}\n---\n\n# Preview\n\nThe tests' fake Storybook.\n`;
}

/** Writes files in the main checkout, their paths from its top level, and commits them. */
function commitOnMain(repo: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git(repo, "add", "--", ...Object.keys(files));
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: files");
}

/**
 * Commits `specs/decisions/preview.md`, active, running the fake preview in `folder`
 * (`packages/web` by default), on `main`, in the main checkout, and on every other branch, which
 * no worktree may hold yet. Returns the log file the fake appends its starts to: see
 * `previewStarts`.
 */
export function addPreview(
  repo: string,
  options: { delay?: number; folder?: string; mode?: FakeMode } = {},
): string {
  const log = join(temporaryFolder("uraeda-preview"), "starts.log");
  const text = previewDecision(
    log,
    options.folder ?? "packages/web",
    options.mode ?? "ok",
    options.delay ?? 0,
  );
  commitOnMain(repo, { [PREVIEW_DECISION]: text });
  const branches = git(repo, "for-each-ref", "--format=%(refname:short)", "refs/heads").split("\n");
  for (const branch of branches.filter((name) => name !== "" && name !== "main")) {
    commitOnBranch(repo, branch, { [PREVIEW_DECISION]: text });
  }
  return log;
}

/** Each start the fake preview logged: its base path, its folder, its process, and its port. */
export function previewStarts(
  log: string,
): Array<{ base: string; cwd: string; pid: number; port: number }> {
  if (!existsSync(log)) {
    return [];
  }
  return readFileSync(log, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as { base: string; cwd: string; pid: number; port: number });
}

/** The test feature's branch and folder: the spec's own example. */
export const STORY_FEATURE = "2026-10-20-sidebar-resize";

/** The stories file the test feature links, from the repository's top level. */
export const STORIES_FILE = "packages/web/src/SidebarHandle.stories.tsx";

/** The stories file's text, with the given exports. */
function storiesText(exports: Array<string>): string {
  const stories = exports.map((name) => `export const ${name} = {};\n`).join("");
  return `export default { title: "SidebarHandle" };\n\n${stories}`;
}

/** The test feature's files, from `fixtures/preview/feature/`, with the given statuses. */
function featureFiles(options: { round?: "awaiting-human" | "answered"; specStatus?: string }) {
  const folder = fixture("preview/feature");
  const files: Record<string, string> = {};
  for (const name of readdirSync(join(folder, "specs", STORY_FEATURE))) {
    const path = `specs/${STORY_FEATURE}/${name}`;
    files[path] = readFileSync(join(folder, path), "utf8");
  }
  const spec = `specs/${STORY_FEATURE}/spec.md`;
  if (options.specStatus !== undefined) {
    files[spec] = files[spec]!.replace(/^status: .*$/m, `status: ${options.specStatus}`);
  }
  if (options.round === "answered") {
    const round = `specs/${STORY_FEATURE}/clarifications-01.md`;
    const answered = files[round]!.replace(/^status: .*$/m, "status: answered");
    // Q2's answer is the second, and last, empty one.
    const at = answered.lastIndexOf("**Answer:**\n");
    files[round] = `${answered.slice(0, at)}**Answer:** A\n${answered.slice(at + 12)}`;
    files[STORIES_FILE] = storiesText(["Dragging", "ThinLine"]);
  }
  return files;
}

/**
 * Builds the test feature, `2026-10-20-sidebar-resize`, in a fixture repository: commits
 * `packages/web/src/SidebarHandle.stories.tsx`, exporting `Dragging`, `ThinLine`, and `Grip`, on
 * `main`, then the branch with the files of `fixtures/preview/feature/`, and checks it out in
 * `.worktrees/2026-10-20-sidebar-resize` unless `worktree` is false. With `preview` (the default),
 * the fake preview's decision is committed on every branch first, and its log returned. `specStatus`
 * rewrites the spec's status; `round: "answered"` answers the round's Q2 "A" and deletes `Grip`.
 */
export function addStoryFeature(
  repo: string,
  options: {
    preview?: false | { delay?: number; mode?: FakeMode };
    round?: "awaiting-human" | "answered";
    specStatus?: string;
    worktree?: boolean;
  } = {},
): { log?: string } {
  commitOnMain(repo, { [STORIES_FILE]: storiesText(["Dragging", "ThinLine", "Grip"]) });
  git(repo, "branch", STORY_FEATURE, "main");
  commitOnBranch(repo, STORY_FEATURE, featureFiles(options));
  const log = options.preview === false ? undefined : addPreview(repo, options.preview ?? {});
  if (options.worktree !== false) {
    git(repo, "worktree", "add", "--quiet", join(".worktrees", STORY_FEATURE), STORY_FEATURE);
  }
  return { log };
}
