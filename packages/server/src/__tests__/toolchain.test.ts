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
  cache?: boolean | { input?: Array<unknown>; untrackedEnv?: Array<string> };
  command: string | Array<string>;
  dependsOn?: Array<string>;
};

/** A command that only touches files: one `touch`, alone, maybe in a shell to expand its globs. */
function touchOnly(command: string | Array<string>): boolean {
  return typeof command === "string" && /^(sh -c ')?touch [^;&|]*'?$/.test(command);
}

/**
 * The tasks that run a check but do not list their inputs, or track some automatically. A group,
 * whose command is `true`, and a task that only touches files, as `binding:touch` does, read nothing.
 */
function untracked(tasks: Record<string, Task>): Array<string> {
  return Object.entries(tasks)
    .filter(([, { command }]) => command !== "true" && !touchOnly(command))
    .flatMap(([name, { cache }]) => {
      const input = typeof cache === "object" ? (cache.input ?? []) : [];
      if (!input.length) {
        return [
          `\`${name}\` has no \`cache.input\`: list the files it reads, so \`ready\` reruns it when they change.`,
        ];
      }
      return input.some((entry) => typeof entry === "object" && entry !== null && "auto" in entry)
        ? [
            `\`${name}\` tracks its inputs automatically: list the files it reads in \`cache.input\` instead of \`{ auto: true }\`.`,
          ]
        : [];
    });
}

/** A text without its comments: `#` ones in TOML and YAML, line and block ones elsewhere. */
function uncommented(path: string, text: string): string {
  return /\.(toml|ya?ml)$/.test(path)
    ? text.replaceAll(/(^|\s)#.*$/gm, "$1")
    : text.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/(^|\s)\/\/.*$/gm, "$1");
}

/** The ways a test runner is told to retry: an option on its command line, or nextest's variable. */
const RETRY_FLAG = /--retr(?:y|ies)\b|NEXTEST_RETRIES/;

/**
 * The retry settings of the test runners' configurations: `retries` in nextest's TOML, `retry` in a
 * Vitest config, and a retry flag or variable in CI's workflow. A comment that names them is not a
 * setting.
 */
function retried(files: Record<string, string>): Array<string> {
  return Object.entries(files).flatMap(([path, text]) => {
    const code = uncommented(path, text);
    const found = path.endsWith(".toml")
      ? /\bretries\s*=/.test(code) && "retries"
      : /\.ya?ml$/.test(path)
        ? RETRY_FLAG.exec(code)?.[0]
        : /\bretry\s*:/.test(code) && "retry";
    return found
      ? [
          `Tests are never retried (toolchain decision): remove \`${found}\` and fix the test that needed it.`,
        ]
      : [];
  });
}

/** The tasks whose command, or the variables passed to it, tell a test runner to retry. */
function retriedTasks(tasks: Record<string, Task>): Array<string> {
  return Object.entries(tasks).flatMap(([name, { cache, command }]) => {
    const env = typeof cache === "object" ? (cache.untrackedEnv ?? []) : [];
    const found = RETRY_FLAG.exec([command, env].flat().join("\n"))?.[0];
    return found
      ? [
          `\`${name}\` retries its tests (toolchain decision): remove \`${found}\` and fix the test that needed it.`,
        ]
      : [];
  });
}

/** Every task of `vite.config.ts`. */
function allTasks(): Record<string, Task> {
  return (config as { run?: { tasks?: Record<string, Task> } }).run?.tasks ?? {};
}

/** Every task `ready` depends on, transitively, `ready` included. */
function readyTasks(): Record<string, Task> {
  const tasks = allTasks();
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

/** The tasks `ready` depends on directly: its groups, the units CI's jobs run. */
function readyGroups(): Record<string, Task> {
  const tasks = allTasks();
  return Object.fromEntries(
    (readyTasks().ready.dependsOn ?? []).map((name) => [name, tasks[name]] as const),
  );
}

/**
 * The tasks CI's workflow runs by no job: a job runs a task with `vp run --no-cache <task>`, since
 * CI runs every check without Vite Task's cache. A commented-out step runs nothing.
 */
function notInCi(tasks: Record<string, Task>, ci: string): Array<string> {
  const run = new Set(
    [...uncommented("ci.yml", ci).matchAll(/\bvp run --no-cache ([\w:@/.-]+)/g)].map(
      ([, task]) => task,
    ),
  );
  return Object.keys(tasks)
    .filter((name) => !run.has(name))
    .map(
      (name) =>
        `\`ready\` runs \`${name}\`, but no CI job does: add it to a job in \`.github/workflows/ci.yml\`.`,
    );
}

/** nextest's configuration, CI's workflow, the root's Vitest config, and each package's. */
function runnerConfigs(): Record<string, string> {
  const packages = readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap(({ name }) =>
      readdirSync(join(ROOT, "packages", name))
        .filter((file) => /^vite.*\.config\.ts$/.test(file))
        .map((file) => `packages/${name}/${file}`),
    );
  const paths = [".config/nextest.toml", ".github/workflows/ci.yml", "vite.config.ts", ...packages];
  return Object.fromEntries(paths.map((path) => [path, readFileSync(join(ROOT, path), "utf8")]));
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
    "a task tracking its inputs automatically",
    untracked({
      "ts:test": { cache: { input: ["packages/**", { auto: true }] }, command: "vp test" },
    }),
    [
      "`ts:test` tracks its inputs automatically: list the files it reads in `cache.input` instead of `{ auto: true }`.",
    ],
  ],
  [
    "a check run after a touch",
    untracked({
      "ts:test": { cache: false, command: ["touch -c packages/binding/index.js", "vp test"] },
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
    "a Vitest project retried on one line",
    retried({ "packages/web/vite.config.ts": "export default { test: { retry: 2 } };\n" }),
    [
      "Tests are never retried (toolchain decision): remove `retry` and fix the test that needed it.",
    ],
  ],
  [
    "a runner retried by a task's command or variable",
    retriedTasks({
      "rust:test": { command: "NEXTEST_RETRIES=2 cargo nextest run" },
      "ts:test": { command: ["vp build", "vp test --retry=2"] },
      "web:build": { command: "vp build" },
    }),
    [
      "`rust:test` retries its tests (toolchain decision): remove `NEXTEST_RETRIES` and fix the test that needed it.",
      "`ts:test` retries its tests (toolchain decision): remove `--retry` and fix the test that needed it.",
    ],
  ],
  [
    "a crate with doctests",
    withDoctests({ "uraeda-core": '[package]\nname = "uraeda-core"\n' }),
    ["`uraeda-core` must set `doctest = false`: cargo-nextest does not run doctests."],
  ],
])("%s is reported", (_name, problems, expected) => expect(problems).toEqual(expected));

test("a comment naming a retry setting is not reported", () =>
  expect(
    retried({
      ".config/nextest.toml": "# No profile sets retries = 2.\n[profile.default]\n",
      "vite.config.ts": "// No `retry: 2` here.\n/* nor retry: 3 */\nexport default {};\n",
    }),
  ).toEqual([]));

test("a ready task no CI job runs is reported", () => {
  const ci =
    "jobs:\n  rust:\n    steps:\n      - run: nix develop -c vp run --no-cache ready:rust\n";
  expect(
    notInCi({ "ready:rust": { command: "true" }, "ready:typescript": { command: "true" } }, ci),
  ).toEqual([
    "`ready` runs `ready:typescript`, but no CI job does: add it to a job in `.github/workflows/ci.yml`.",
  ]);
});

test("CI runs every group of ready", () => {
  expect(
    notInCi(readyGroups(), readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8")),
  ).toEqual([]);
});

test("the repository's toolchain follows the decision", () => {
  expect(untracked(readyTasks())).toEqual([]);
  expect(retried(runnerConfigs())).toEqual([]);
  expect(retriedTasks(allTasks())).toEqual([]);
  expect(withDoctests(libraryManifests())).toEqual([]);
});
