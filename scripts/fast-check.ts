/**
 * `vp run fast`: the checks an agent runs after every task, in place of `vp run ready` (see
 * `specs/decisions/toolchain.md`): the formatter, the linter, the types, and the tests of what the
 * change touched. `select` chooses them from the changed files and is pure; the rest runs them, in
 * order, and stops at the first failure. `ready` still runs before a push: this can pass where it
 * fails.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** A command of the plan, which the runner wraps in `scripts/test-run.ts`. */
export type Step = {
  command: Array<string>;
  /** Waits for a slot of the machine's `heavy` lock, as `ready`'s checks do. */
  heavy?: boolean;
  /** Runs with git's defaults, as `ready`'s tests do. */
  isolated?: boolean;
};

/**
 * Every test that loads the binding, found by Vitest's own module graph from the binding's loader,
 * which every importer of `uraeda-binding` reaches: a hand-kept list would go stale.
 */
const BINDING_ENTRY = "packages/binding/index.js";

/** What the binding is built from or tested against: a change there reaches its tests. */
const BINDING_PATHS = [/^crates\//, /^skills\//, /^fixtures\//, /^Cargo\.(toml|lock)$/];

/**
 * The Rust workspace's own files, which every crate is built from, and the fixtures, which every
 * crate's tests read (`rust:test`'s inputs list them): a change there runs every crate's tests.
 */
const RUST_WORKSPACE = /^(Cargo\.(toml|lock)|clippy\.toml|rust-toolchain\.toml|fixtures\/.*)$/;

/** The files the toolchain test reads without importing them. */
const TOOLCHAIN_PATHS = [
  /^vite\.tasks\.ts$/,
  /^\.github\/workflows\//,
  /^\.config\/nextest\.toml$/,
];

const TOOLCHAIN_TEST = "packages/server/src/__tests__/toolchain.test.ts";

/** Every Vitest project but the browser's, which `ready`'s two browser jobs run. */
const NO_BROWSER = ["--project", "!phone", "--project", "!desktop"];

/**
 * A source file Vitest relates tests to: the packages' and the scripts'. A root config file would
 * relate every test, since each loads it, so `vp check` and the toolchain test cover it instead.
 */
const isSource = (file: string) =>
  /^(packages|scripts)\/.*\.(ts|tsx|mts|js|mjs)$/.test(file) && !file.endsWith(".d.ts");
const matches = (patterns: Array<RegExp>, files: Array<string>) =>
  files.some((file) => patterns.some((pattern) => pattern.test(file)));

/** The crates, by their folder, whose files changed: `crates/core/src/lib.rs` is `core`. */
function crates(files: Array<string>): Array<string> {
  const names = files.flatMap((file) => /^crates\/([^/]+)\//.exec(file)?.[1] ?? []);
  return [...new Set(names)].toSorted();
}

/** The Rust steps: a crate's tests and its dependents', or every crate's for a workspace file or a fixture. */
function rustSteps(files: Array<string>): Array<Step> {
  const names = crates(files);
  const everything = files.some((file) => RUST_WORKSPACE.test(file));
  if (!names.length && !everything) {
    return [];
  }
  // Nextest's `rdeps` is the package and the packages depending on it.
  const filter = names.map((name) => `rdeps(uraeda-${name})`).join(" + ");
  const run = everything ? ["cargo", "nextest", "run"] : ["cargo", "nextest", "run", "-E", filter];
  const format = files.some((file) => file.endsWith(".rs"))
    ? [{ command: ["cargo", "fmt", "--check"] }]
    : [];
  return [...format, { command: run, heavy: true, isolated: true }];
}

/**
 * The plan for a change: `vp check` always, then the tests the files reach. `exists` tells a file
 * of the change that is still there from one the change deleted: Vitest fails on a path it cannot
 * find, and a deleted file reaches no test, so only `vp check` and the Rust steps see it.
 */
export function select(
  files: Array<string>,
  exists: (file: string) => boolean = () => true,
): Array<Step> {
  const related = files.filter((file) => isSource(file) && exists(file));
  if (matches(BINDING_PATHS, files)) {
    related.push(BINDING_ENTRY);
  }
  const steps: Array<Step> = [{ command: ["vp", "check"], heavy: true }, ...rustSteps(files)];
  // `lua:fmt`'s check, which `vp check` does not cover.
  if (files.some((file) => /^editors\/nvim\/.*\.lua$/.test(file))) {
    steps.push({ command: ["stylua", "--check", "editors/nvim"] });
  }
  if (related.length) {
    steps.push({
      command: ["vp", "test", "related", ...related, "--run", ...NO_BROWSER],
      isolated: true,
    });
  }
  if (matches(TOOLCHAIN_PATHS, files)) {
    steps.push({ command: ["vp", "test", TOOLCHAIN_TEST, "--run"], isolated: true });
  }
  return steps;
}

/** A git command's output lines, from the checkout's root. */
function git(root: string, ...args: Array<string>): Array<string> {
  const { status, stdout } = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return status === 0 ? stdout.split("\n").filter(Boolean) : [];
}

/**
 * The files of the task: the working tree's changes against `base` (the last commit by default),
 * new files included, or the last commit's when the tree is clean, as after a task's commit. A task
 * is one commit, so what an earlier task changed was checked by it: `vp run fast main` checks the
 * whole branch.
 */
function changedFiles(root: string, base?: string): Array<string> {
  const diff = git(root, "diff", "--name-only", "--no-renames", base ?? "HEAD");
  const untracked = git(root, "ls-files", "--others", "--exclude-standard");
  const changed = [...new Set([...diff, ...untracked])];
  const files =
    changed.length || base ? changed : git(root, "diff", "--name-only", "HEAD~", "HEAD");
  return files.toSorted();
}

/** The git variables a test must not see, which `ready`'s tasks drop the same way. */
const GIT_REPOSITORY = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"];

/** Runs a step through `scripts/test-run.ts`, so its temporary files go with it. */
function run(root: string, step: Step): number {
  const env = { ...process.env };
  if (step.isolated) {
    GIT_REPOSITORY.forEach((name) => delete env[name]);
    Object.assign(env, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" });
  }
  const lock = step.heavy ? ["--lock", "heavy", "--slots", "2"] : [];
  const args = [join(root, "scripts/test-run.ts"), ...lock, ...step.command];
  return spawnSync("node", args, { cwd: root, env, stdio: "inherit" }).status ?? 1;
}

if (import.meta.main) {
  const root = join(import.meta.dirname, "..");
  const files = changedFiles(root, process.argv[2]);
  process.stdout.write(`fast: ${files.length} changed file(s)\n`);
  for (const step of select(files, (file) => existsSync(join(root, file)))) {
    process.stdout.write(`\n$ ${step.command.join(" ")}\n`);
    const status = run(root, step);
    if (status !== 0) {
      process.stdout.write(`\nfast: stopped, ${step.command[0]} failed\n`);
      process.exit(status);
    }
  }
  process.stdout.write("\nfast: passed. Run `vp run ready` before pushing.\n");
}
