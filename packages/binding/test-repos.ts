// The fixture repositories every test that reads git builds: their history built once per test
// file, each test given a copy of its own.
import { execFileSync } from "node:child_process";
import {
  constants,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

/** Each fixture's history, built once by `buildFixture` in a template folder, by its name. */
const templates = new Map<string, string>();

/**
 * A git repository in a temporary folder, built from `fixtures/<name>/`: `main/` committed on
 * `main`, then each folder of `branches/` committed on a branch of its name, from `main`. The
 * checkout is left on `main`. The history is built once per test file, in a template no test sees,
 * and each call returns a full copy of it: its objects, refs, index, configuration, and files are
 * its own, never hard-linked or borrowed, so one test's commits never reach another's.
 */
export function fixtureRepo(name = "repo"): string {
  let template = templates.get(name);
  // Each test file's end removes its temporary folders, its templates too, and a worker may run
  // another file after it in the same process: that file builds them again.
  if (template === undefined || !existsSync(template)) {
    template = owned("uraeda-template", (folder) => buildFixture(name, folder));
    templates.set(name, template);
  }
  const from = template;
  // A copy-on-write clone where the file system has one, an ordinary copy elsewhere: either way, a
  // write to one copy never reaches another.
  return owned("uraeda-repo", (repo) =>
    cpSync(from, repo, {
      mode: constants.COPYFILE_FICLONE,
      recursive: true,
      verbatimSymlinks: true,
    }),
  );
}

/** A new temporary folder that `fill` fills, removed at once if it fails. */
function owned(prefix: string, fill: (folder: string) => void): string {
  const folder = temporaryFolder(prefix);
  try {
    fill(folder);
  } catch (error) {
    rmSync(folder, { force: true, recursive: true });
    throw error;
  }
  return folder;
}

/** Builds a fixture's history in an empty folder, as `fixtureRepo` describes it. */
function buildFixture(name: string, repo: string) {
  const source = fixture(name);
  if (!existsSync(source)) {
    throw new Error(`no fixture repository ${source}`);
  }
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
}
