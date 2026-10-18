// The toolchain decision's rules a tool can read (see `specs/decisions/toolchain.md`): each check is
// a pure function, shown to fire on a fixture that breaks it, then run on the repository's files.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, matchesGlob } from "node:path";
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
  // Only run steps count. A job name, an echo, or a comment naming a task executes no check.
  // Read the inline command or the indented body of a YAML run block, failing closed on other
  // shell wrappers: a new wrapper must teach this check how it invokes the task.
  const lines = uncommented("ci.yml", ci).split("\n");
  const commands = lines.flatMap((line, index) => {
    const step = /^( *)(?:- )?run:\s*(.*)$/.exec(line);
    if (!step) {
      return [];
    }
    if (!/^[|>][-+]?\s*$/.test(step[2])) {
      return [step[2]];
    }
    const body: Array<string> = [];
    for (const next of lines.slice(index + 1)) {
      if (next.trim() && next.length - next.trimStart().length <= step[1].length) {
        break;
      }
      body.push(next.trim());
    }
    return body;
  });
  const run = new Set(
    commands.flatMap((command) => {
      const task =
        /^(?:nix develop (?:-c|--command) )?(?:pnpm exec )?vp run --no-cache ([\w:@/.-]+)(?:\s|$)/.exec(
          command.trim(),
        )?.[1];
      return task ? [task] : [];
    }),
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

/**
 * The `--project` options of each `vp test` a command runs, quotes removed. A run with none runs
 * every project.
 */
function projectOptions(command: string | Array<string>): Array<Array<string>> {
  return [command].flat().flatMap((line) => {
    const words = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map(
      ([, single, double, bare]) => single ?? double ?? bare,
    );
    const start = words.findIndex((word, index) => word === "vp" && words[index + 1] === "test");
    if (start === -1 || ["bench", "list"].includes(words[start + 2])) {
      return [];
    }
    const end = words.findIndex((word, index) => index > start && /^(&&|\|\|?|;)$/.test(word));
    const args = words.slice(start + 2, end === -1 ? undefined : end);
    return [
      args.flatMap((word, index) =>
        word === "--project"
          ? [args[index + 1]]
          : word.startsWith("--project=")
            ? [word.slice("--project=".length)]
            : [],
      ),
    ];
  });
}

/** Whether Vitest's `--project` options select the project: by name, `*` wildcards, `!` to exclude. */
function selects(options: Array<string>, project: string): boolean {
  const matches = (pattern: string) =>
    new RegExp(
      `^${pattern
        .split("*")
        .map((part) => part.replaceAll(/[.+?^${}()|[\]\\/]/g, String.raw`\$&`))
        .join(".*")}$`,
    ).test(project);
  const included = options.filter((option) => !option.startsWith("!"));
  const excluded = options
    .filter((option) => option.startsWith("!"))
    .map((option) => option.slice(1));
  return (!included.length || included.some(matches)) && !excluded.some(matches);
}

/**
 * The Vitest projects no `vp test` of the tasks runs. A task naming each project with `--project`
 * drops a project added later: one selecting the others by exclusion runs it.
 */
function unselected(projects: Array<string>, tasks: Record<string, Task>): Array<string> {
  const runs = Object.values(tasks).flatMap(({ command }) => projectOptions(command));
  return projects
    .filter((project) => !runs.some((options) => selects(options, project)))
    .map(
      (project) =>
        `\`${project}\` is in \`test.projects\`, but no task of \`ready\` runs it: select the unit projects by exclusion in \`ts:test\` (\`--project '!phone'\`), or add a task running it.`,
    );
}

/**
 * The names of the root config's Vitest projects: a package's is its `package.json` name, and a
 * config file's are its browser instances' names.
 */
function projectNames(): Array<string> {
  const projects = (config as { test?: { projects?: Array<string> } }).test?.projects ?? [];
  return projects.flatMap((project) => {
    if (!project.endsWith(".ts")) {
      const manifest = readFileSync(join(ROOT, project, "package.json"), "utf8");
      return [(JSON.parse(manifest) as { name: string }).name];
    }
    const text = uncommented(project, readFileSync(join(ROOT, project), "utf8"));
    const instances = /\binstances:\s*\[([\s\S]*?)\n\s*\]/.exec(text)?.[1] ?? "";
    const names = [...instances.matchAll(/\bname:\s*"([^"]+)"/g)].map(([, name]) => name);
    if (!names.length) {
      throw new Error(`no browser instance names in ${project}: teach \`projectNames\` its names`);
    }
    return names;
  });
}

/** A command line that runs tests: a test runner, or the package's smoke test. */
const TEST_RUNNER = /\b(?:vp test|cargo (?:llvm-cov )?nextest|nvim --headless)\b|smoke\.ts\b/;

/** `scripts/test-run.ts`, from the root or a task's folder, with its options. */
const TEST_RUN = /^node (?:\.\.\/)*scripts\/test-run\.ts((?: --\S+ \S+)*) /;

/**
 * The tasks running tests outside a temporary folder of their own: a test leaving its folders
 * behind, or a run killed before its cleanup, would fill the machine's `/tmp`.
 */
function outsideRunFolder(tasks: Record<string, Task>): Array<string> {
  return Object.entries(tasks).flatMap(([name, { command }]) =>
    [command].flat().some((line) => TEST_RUNNER.test(line) && !TEST_RUN.test(line))
      ? [
          `\`${name}\` runs tests outside a temporary folder of their own: start its command with \`node scripts/test-run.ts\`.`,
        ]
      : [],
  );
}

/**
 * The tasks running a browser project without the machine's lock of the browser tests, which
 * caps how many run at once across checkouts.
 */
function unlockedBrowsers(tasks: Record<string, Task>, browsers: Array<string>): Array<string> {
  return Object.entries(tasks).flatMap(([name, { command }]) =>
    [command]
      .flat()
      .some(
        (line) =>
          projectOptions(line).some((options) =>
            browsers.some((browser) => selects(options, browser)),
          ) && !/--lock browser\b/.test(TEST_RUN.exec(line)?.[1] ?? ""),
      )
      ? [
          `\`${name}\` runs browser tests without waiting for the other checkouts': run it with \`node scripts/test-run.ts --lock browser --slots 2\`.`,
        ]
      : [],
  );
}

/** A port written as a number: a config's `port: 4310`, or a command's `--port 4310`. */
const FIXED_PORT = /\bport\s*:\s*\d+|--port[= ]\d+/;

/**
 * The test runners' configurations and the tasks' commands that set a fixed port: several
 * checkouts' tests at once would take the same one.
 */
function fixedPorts(files: Record<string, string>): Array<string> {
  return Object.entries(files)
    .filter(([path, text]) => FIXED_PORT.test(uncommented(path, text)))
    .map(
      ([path]) =>
        `\`${path}\` sets a fixed port: take a free one, as \`freePort\` of \`packages/server/src/free-port.ts\` gives.`,
    );
}

/** Each task's commands, by the task's name. */
function taskCommands(tasks: Record<string, Task>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tasks).map(([name, { command }]) => [name, [command].flat().join("\n")]),
  );
}

/**
 * The test runners' configurations that start a browser server on Vitest's port, 63315, which every
 * checkout's tests would ask for: a config enabling a browser sets `test.api`'s port.
 */
function defaultBrowserPort(files: Record<string, string>): Array<string> {
  return Object.entries(files)
    .filter(([path, text]) => {
      const code = uncommented(path, text);
      return (
        /\bbrowser:\s*\{[^}]*\benabled:\s*true/.test(code) && !/\bapi:\s*\{[^}]*\bport:/.test(code)
      );
    })
    .map(
      ([path]) =>
        `\`${path}\` starts its browser server on Vitest's port: set \`test.api\` to \`{ port: await freePort() }\`.`,
    );
}

/**
 * The Vitest configs loading the native binding whose first import is not `fresh-binding`: an
 * import before it could load a binding older than the Rust core, which Node cannot reload once
 * rebuilt.
 */
function staleBindingFirst(configs: Record<string, string>): Array<string> {
  return Object.entries(configs)
    .filter(([path, text]) => {
      const first = /^import\s[^;]*?["']([^"']+)["'];?$/m.exec(uncommented(path, text))?.[1] ?? "";
      return !/(^|\/)fresh-binding(\.ts)?$/.test(first);
    })
    .map(
      ([path]) =>
        `\`${path}\` may load the binding before it is rebuilt: import \`uraeda-server/fresh-binding\` first.`,
    );
}

/** The Vitest configs of the root's projects whose package is the binding or depends on it. */
function bindingConfigs(): Record<string, string> {
  const projects = (config as { test?: { projects?: Array<string> } }).test?.projects ?? [];
  return Object.fromEntries(
    projects
      .map((project) => (project.endsWith(".ts") ? project : `${project}/vite.config.ts`))
      .filter((path) => {
        const manifest = readFileSync(
          join(ROOT, path.slice(0, path.lastIndexOf("/")), "package.json"),
          "utf8",
        );
        return /"uraeda-binding"/.test(manifest);
      })
      .map((path) => [path, readFileSync(join(ROOT, path), "utf8")]),
  );
}

/** The browser projects' names: the instances of the root's config file projects. */
function browserProjects(): Array<string> {
  const projects = (config as { test?: { projects?: Array<string> } }).test?.projects ?? [];
  const packages = projects.filter((project) => !project.endsWith(".ts")).length;
  return projectNames().slice(packages);
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
  [
    "a Vitest project no task selects",
    unselected(["uraeda-binding", "uraeda-server", "phone"], {
      "browser:phone": { command: "vp test --project phone" },
      ready: { command: "true", dependsOn: ["ts:test", "browser:phone"] },
      "ts:test": { command: "env -u GIT_DIR vp test --project uraeda-binding" },
    }),
    [
      "`uraeda-server` is in `test.projects`, but no task of `ready` runs it: select the unit projects by exclusion in `ts:test` (`--project '!phone'`), or add a task running it.",
    ],
  ],
  [
    "a test task outside a run folder, next to a wrapped one and a build",
    outsideRunFolder({
      "rust:test": { command: "env -u GIT_DIR cargo nextest run" },
      "test:nvim": {
        command: ["cargo build -q", "node ../../scripts/test-run.ts nvim --headless -u x.lua"],
      },
      "ts:test": { command: "node scripts/test-run.ts vp test --project '!phone'" },
      "ui:smoke": { command: ["node scripts/build.ts", "node packages/uraeda/scripts/smoke.ts"] },
    }),
    [
      "`rust:test` runs tests outside a temporary folder of their own: start its command with `node scripts/test-run.ts`.",
      "`ui:smoke` runs tests outside a temporary folder of their own: start its command with `node scripts/test-run.ts`.",
    ],
  ],
  [
    "a browser task without the lock",
    unlockedBrowsers(
      {
        "browser:desktop": { command: "node scripts/test-run.ts vp test --project desktop" },
        "browser:phone": {
          command: "node scripts/test-run.ts --lock browser --slots 2 vp test --project phone",
        },
        coverage: {
          command: "node scripts/test-run.ts vp test --project '!phone' --project '!desktop'",
        },
        everything: { command: "node scripts/test-run.ts vp test" },
      },
      ["phone", "desktop"],
    ),
    [
      "`browser:desktop` runs browser tests without waiting for the other checkouts': run it with `node scripts/test-run.ts --lock browser --slots 2`.",
      "`everything` runs browser tests without waiting for the other checkouts': run it with `node scripts/test-run.ts --lock browser --slots 2`.",
    ],
  ],
  [
    "a fixed port in a test config and a task, but not in a comment",
    fixedPorts({
      "packages/web/vite.browser.config.ts": "export default { test: { api: { port: 63315 } } };\n",
      "packages/web/vite.config.ts": "// Never `port: 4310` in tests.\nexport default {};\n",
      storybook: "storybook dev --port 6006",
    }),
    [
      "`packages/web/vite.browser.config.ts` sets a fixed port: take a free one, as `freePort` of `packages/server/src/free-port.ts` gives.",
      "`storybook` sets a fixed port: take a free one, as `freePort` of `packages/server/src/free-port.ts` gives.",
    ],
  ],
  [
    "a config importing something before the binding is rebuilt",
    staleBindingFirst({
      "packages/binding/vite.config.ts":
        '// A comment.\nimport "../server/src/fresh-binding.ts";\nimport { defineConfig } from "vite-plus";\n',
      "packages/web/vite.browser.config.ts":
        'import { addRepository } from "uraeda-binding";\nimport "uraeda-server/fresh-binding";\n',
      "packages/web/vite.config.ts":
        'import "uraeda-server/fresh-binding";\nimport {\n  devHandler,\n} from "uraeda-server/dev";\n',
    }),
    [
      "`packages/web/vite.browser.config.ts` may load the binding before it is rebuilt: import `uraeda-server/fresh-binding` first.",
    ],
  ],
  [
    "a browser config on Vitest's port",
    defaultBrowserPort({
      "a.config.ts": "export default { test: { browser: { enabled: true } } };\n",
      "b.config.ts":
        "export default { test: { api: { port: await freePort() }, browser: { enabled: true } } };\n",
      "c.config.ts": "export default { test: { environment: 'happy-dom' } };\n",
    }),
    [
      "`a.config.ts` starts its browser server on Vitest's port: set `test.api` to `{ port: await freePort() }`.",
    ],
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

test("a job name or echo naming a ready task does not count as running it", () => {
  const ci = `jobs:
  rust:
    name: vp run --no-cache ready:rust
    steps:
      - run: echo 'vp run --no-cache ready:rust'
      - run: |
          nix develop --command pnpm exec vp run --no-cache ready:typescript
`;
  expect(
    notInCi({ "ready:rust": { command: "true" }, "ready:typescript": { command: "true" } }, ci),
  ).toHaveLength(1);
  expect(notInCi({ "ready:typescript": { command: "true" } }, ci)).toEqual([]);
});

/**
 * Vite Task's globs match dot folders, `**` included, which `matchesGlob`'s do not: a leading dot is
 * renamed in both, so `.worktrees` is a folder like any other.
 */
const undotted = (path: string) => path.replaceAll(/(^|\/)\./g, "$1dot-");

/** Whether explicit include and exclude globs fingerprint a file. Excludes always win. */
function tracks(task: string, file: string): boolean {
  const cache = allTasks()[task].cache;
  const inputs =
    typeof cache === "object"
      ? (cache.input?.filter((input): input is string => typeof input === "string") ?? [])
      : [];
  return (
    inputs.some(
      (input) => !input.startsWith("!") && matchesGlob(undotted(file), undotted(input)),
    ) &&
    !inputs.some(
      (input) => input.startsWith("!") && matchesGlob(undotted(file), undotted(input.slice(1))),
    )
  );
}

test.each(["ts:test", "browser:phone", "browser:desktop"])(
  "%s invalidates on native binding changes",
  (task) => {
    expect(tracks(task, "crates/core/src/lib.rs")).toBe(true);
    expect(tracks(task, "crates/binding/src/lib.rs")).toBe(true);
    expect(tracks(task, "Cargo.lock")).toBe(true);
  },
);

test("cached checks track the dev shell and ignore generated reports", () => {
  for (const [name, { cache }] of Object.entries(readyTasks())) {
    if (typeof cache !== "object") {
      continue;
    }
    expect(tracks(name, "flake.lock"), `${name} tracks its pinned tools`).toBe(true);
    for (const file of [
      "coverage/report.md",
      "packages/web/.vitest/traces/failed.zip",
      "packages/web/storybook-static/index.html",
      // Another checkout's files: in the main checkout, `.worktrees/` holds every worktree.
      ".worktrees/other/specs/proposal.md",
      ".worktrees/other/packages/web/src/app.ts",
    ]) {
      expect(tracks(name, file), `${name} ignores ${file}`).toBe(false);
    }
  }
  expect(allTasks()["ts:check"].dependsOn).toContain("binding:build");
});

test("the repository's toolchain follows the decision", () => {
  expect(untracked(readyTasks())).toEqual([]);
  expect(retried(runnerConfigs())).toEqual([]);
  expect(retriedTasks(allTasks())).toEqual([]);
  expect(withDoctests(libraryManifests())).toEqual([]);
  expect(unselected(projectNames(), readyTasks())).toEqual([]);
  expect(outsideRunFolder(allTasks())).toEqual([]);
  expect(unlockedBrowsers(allTasks(), browserProjects())).toEqual([]);
  expect(fixedPorts({ ...runnerConfigs(), ...taskCommands(allTasks()) })).toEqual([]);
  expect(defaultBrowserPort(runnerConfigs())).toEqual([]);
  expect(staleBindingFirst(bindingConfigs())).toEqual([]);
  expect(Object.keys(bindingConfigs()).sort()).toEqual([
    "packages/binding/vite.config.ts",
    "packages/server/vite.config.ts",
    "packages/web/vite.browser.config.ts",
    "packages/web/vite.config.ts",
  ]);
});

test("the browser projects are the browser config's instances", () =>
  expect(browserProjects()).toEqual(["phone", "desktop"]));

test("a project added to test.projects is run by a task selecting the others by exclusion", () =>
  expect(
    unselected(["uraeda-binding", "uraeda-new", "phone", "desktop"], {
      "browser:desktop": { command: "vp test --project desktop" },
      "browser:phone": { command: "vp test --project phone" },
      "ts:test": { command: "vp test --project '!phone' --project '!desktop'" },
    }),
  ).toEqual([]));

test("the heavy checks wait for the other checkouts' through a shared limit of two", () => {
  for (const name of ["ts:check", "rust:clippy", "rust:test"]) {
    const line = [allTasks()[name].command].flat()[0];
    expect(TEST_RUN.exec(line)?.[1], `${name} runs under the heavy lock`).toBe(
      " --lock heavy --slots 2",
    );
  }
});
