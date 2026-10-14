// The toolchain decision's rules a tool can read (see `specs/decisions/toolchain.md`): each check is
// a pure function, shown to fire on a fixture that breaks it, then run on the repository's files.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import config from "../../../../vite.config.ts";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));

/** A task of `vite.config.ts`'s `run.tasks`, as far as these checks read it. */
type Task = {
  cache?: boolean | { input?: Array<unknown> };
  command: string | Array<string>;
  dependsOn?: Array<string>;
};

/**
 * The tasks that run a check but do not list their inputs. A group, whose command is `true`, and a
 * task that only touches files, as `binding:touch` does, read nothing.
 */
function untracked(tasks: Record<string, Task>): Array<string> {
  return Object.entries(tasks)
    .filter(([, { command }]) => command !== "true" && !/^(sh -c ')?touch /.test(String(command)))
    .filter(([, { cache }]) => typeof cache !== "object" || !cache.input?.length)
    .map(
      ([name]) =>
        `\`${name}\` has no \`cache.input\`: list the files it reads, so \`ready\` reruns it when they change.`,
    );
}

/**
 * The retry settings of the test runners' configurations: `retries` in nextest's TOML, `retry` in a
 * Vitest config. A comment that names them is not a setting.
 */
function retried(files: Record<string, string>): Array<string> {
  return Object.entries(files).flatMap(([path, text]) => {
    const setting = path.endsWith(".toml") ? "retries" : "retry";
    const pattern = path.endsWith(".toml") ? /^\s*retries\s*=/m : /^\s*retry\s*:/m;
    return pattern.test(text)
      ? [
          `Tests are never retried (toolchain decision): remove \`${setting}\` and fix the test that needed it.`,
        ]
      : [];
  });
}

/** The library crates whose `[lib]` section does not set `doctest = false`. */
function withDoctests(manifests: Record<string, string>): Array<string> {
  return Object.entries(manifests)
    .filter(([, text]) => {
      const lib = /^\[lib\]\n((?:(?!\[).*\n?)*)/m.exec(text)?.[1] ?? "";
      return !/^doctest\s*=\s*false\s*$/m.test(lib);
    })
    .map(
      ([crate]) =>
        `\`${crate}\` must set \`doctest = false\`: cargo-nextest does not run doctests.`,
    );
}

/** Every task `ready` depends on, transitively, `ready` included. */
function readyTasks(): Record<string, Task> {
  const tasks = (config as { run?: { tasks?: Record<string, Task> } }).run?.tasks ?? {};
  if (!tasks.ready) {
    throw new Error("no `ready` task in vite.config.ts");
  }
  const found: Record<string, Task> = {};
  const visit = (name: string) => {
    const task = tasks[name];
    if (!task) {
      throw new Error(`\`${name}\` is not a task of vite.config.ts`);
    }
    found[name] = task;
    for (const dependency of task.dependsOn ?? []) {
      visit(dependency);
    }
  };
  visit("ready");
  return found;
}

/** nextest's configuration, the root's Vitest config, and each package's. */
function runnerConfigs(): Record<string, string> {
  const paths = [
    ".config/nextest.toml",
    "vite.config.ts",
    "packages/binding/vite.config.ts",
    "packages/server/vite.config.ts",
    "packages/web/vite.config.ts",
    "packages/web/vite.browser.config.ts",
  ];
  return Object.fromEntries(paths.map((path) => [path, readFileSync(join(ROOT, path), "utf8")]));
}

/** The manifest of each crate with a library target, by package name. */
function libraryManifests(): Record<string, string> {
  const crates = join(ROOT, "crates");
  return Object.fromEntries(
    readdirSync(crates)
      .filter((crate) => existsSync(join(crates, crate, "src/lib.rs")))
      .map((crate) => {
        const text = readFileSync(join(crates, crate, "Cargo.toml"), "utf8");
        return [/^name = "(.+)"$/m.exec(text)?.[1] ?? crate, text];
      }),
  );
}

test.each([
  [
    "a task without inputs",
    untracked({ "rust:fmt": { command: "cargo fmt --check" } }),
    [
      "`rust:fmt` has no `cache.input`: list the files it reads, so `ready` reruns it when they change.",
    ],
  ],
  [
    "an uncached check, next to a group and a touch",
    untracked({
      "binding:touch": { cache: false, command: "sh -c 'touch -c packages/binding/*.node'" },
      ready: { command: "true", dependsOn: ["ts:test"] },
      "ts:test": { cache: false, command: "vp test" },
    }),
    [
      "`ts:test` has no `cache.input`: list the files it reads, so `ready` reruns it when they change.",
    ],
  ],
  [
    "a retried runner",
    retried({ "nextest.toml": "[profile.default]\nretries = 2\n" }),
    [
      "Tests are never retried (toolchain decision): remove `retries` and fix the test that needed it.",
    ],
  ],
  [
    "a retried Vitest project",
    retried({ "vite.config.ts": "export default {\n  test: {\n    retry: 2,\n  },\n};\n" }),
    [
      "Tests are never retried (toolchain decision): remove `retry` and fix the test that needed it.",
    ],
  ],
  [
    "a crate with doctests",
    withDoctests({ "uraeda-core": '[package]\nname = "uraeda-core"\n' }),
    ["`uraeda-core` must set `doctest = false`: cargo-nextest does not run doctests."],
  ],
])("%s is reported", (_name, problems, expected) => expect(problems).toEqual(expected));

test("the repository's toolchain follows the decision", () => {
  expect(untracked(readyTasks())).toEqual([]);
  expect(retried(runnerConfigs())).toEqual([]);
  expect(withDoctests(libraryManifests())).toEqual([]);
});
