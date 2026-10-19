// The toolchain decision's rules a tool can read (see `specs/decisions/toolchain.md`): each check is
// a pure function, shown to fire on a fixture that breaks it, then run on the repository's files.
import { readdirSync, readFileSync } from "node:fs";
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

/** The browser projects' names: the instances of the root's config file projects. */
function browserProjects(): Array<string> {
  const projects = (config as { test?: { projects?: Array<string> } }).test?.projects ?? [];
  const packages = projects.filter((project) => !project.endsWith(".ts")).length;
  return projectNames().slice(packages);
}

const NO_RETRY = "Tests are never retried (toolchain decision)";

/** Each check is shown to fire on a fixture that breaks one rule of the decision. */
test.each([
  [
    "a task without inputs",
    untracked({ "rust:fmt": { command: "cargo fmt --check" } }),
    [
      "`rust:fmt` has no `cache.input`: list the files it reads, so `ready` reruns it when they change.",
    ],
  ],
  [
    "a retried runner",
    retried({ "nextest.toml": "[profile.default]\nretries = 2\n" }),
    [`${NO_RETRY}: remove \`retries\` and fix the test that needed it.`],
  ],
  [
    "a retried Vitest project",
    retried({ "vite.config.ts": "export default {\n  test: {\n    retry: 2,\n  },\n};\n" }),
    [`${NO_RETRY}: remove \`retry\` and fix the test that needed it.`],
  ],
  [
    "a runner retried by a task's command",
    retriedTasks({ "ts:test": { command: ["vp build", "vp test --retry=2"] } }),
    [
      "`ts:test` retries its tests (toolchain decision): remove `--retry` and fix the test that needed it.",
    ],
  ],
  [
    "a Vitest project no task selects",
    unselected(["uraeda-binding", "uraeda-server"], {
      ready: { command: "true", dependsOn: ["ts:test"] },
      "ts:test": { command: "vp test --project uraeda-binding" },
    }),
    [
      "`uraeda-server` is in `test.projects`, but no task of `ready` runs it: select the unit projects by exclusion in `ts:test` (`--project '!phone'`), or add a task running it.",
    ],
  ],
  [
    "a test task outside a run folder",
    outsideRunFolder({ "rust:test": { command: "cargo nextest run" } }),
    [
      "`rust:test` runs tests outside a temporary folder of their own: start its command with `node scripts/test-run.ts`.",
    ],
  ],
  [
    "a browser task without the lock",
    unlockedBrowsers(
      { "browser:desktop": { command: "node scripts/test-run.ts vp test --project desktop" } },
      ["desktop"],
    ),
    [
      "`browser:desktop` runs browser tests without waiting for the other checkouts': run it with `node scripts/test-run.ts --lock browser --slots 2`.",
    ],
  ],
  [
    "a fixed port in a test config",
    fixedPorts({
      "vite.browser.config.ts": "export default { test: { api: { port: 63315 } } };\n",
    }),
    [
      "`vite.browser.config.ts` sets a fixed port: take a free one, as `freePort` of `packages/server/src/free-port.ts` gives.",
    ],
  ],
  [
    "a browser config on Vitest's port",
    defaultBrowserPort({
      "a.config.ts": "export default { test: { browser: { enabled: true } } };\n",
    }),
    [
      "`a.config.ts` starts its browser server on Vitest's port: set `test.api` to `{ port: await freePort() }`.",
    ],
  ],
])("%s is reported", (_name, problems, expected) => expect(problems).toEqual(expected));

/** CI's step for a task, as the workflow writes it. */
const ciStep = (task: string) => `      - run: nix develop -c vp run --no-cache ${task}\n`;

/** A workflow of one job, with the steps given. */
const jobs = (steps: string, name = "") => `jobs:\n  a:\n${name}    steps:\n${steps}`;

test("a ready group no CI job runs, or runs cached, is reported", () => {
  const groups = { "ready:rust": { command: "true" }, "ready:typescript": { command: "true" } };
  const missing =
    "`ready` runs `ready:typescript`, but no CI job does: add it to a job in `.github/workflows/ci.yml`.";

  expect(notInCi(groups, jobs(ciStep("ready:rust")))).toEqual([missing]);
  expect(
    notInCi(
      groups,
      jobs(`${ciStep("ready:rust")}      - run: nix develop -c vp run ready:typescript\n`),
    ),
  ).toEqual([missing]);
  expect(
    notInCi(groups, jobs(ciStep("ready:rust"), "    name: vp run --no-cache ready:typescript\n")),
  ).toEqual([missing]);
});

test("CI runs every group of ready, uncached", () => {
  expect(
    notInCi(readyGroups(), readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8")),
  ).toEqual([]);
});

test("the repository's tests are isolated, never retried, and ready runs every check", () => {
  expect(untracked(readyTasks())).toEqual([]);
  expect(retried(runnerConfigs())).toEqual([]);
  expect(retriedTasks(allTasks())).toEqual([]);
  expect(unselected(projectNames(), readyTasks())).toEqual([]);
  expect(outsideRunFolder(allTasks())).toEqual([]);
  expect(unlockedBrowsers(allTasks(), browserProjects())).toEqual([]);
  expect(fixedPorts({ ...runnerConfigs(), ...taskCommands(allTasks()) })).toEqual([]);
  expect(defaultBrowserPort(runnerConfigs())).toEqual([]);
});

test("the fast check exists and does not replace ready", () => {
  const tasks = allTasks();
  expect(tasks.fast).toBeDefined();
  expect(Object.keys(readyTasks())).not.toContain("fast");
  expect(tasks.ready.dependsOn?.length).toBeGreaterThan(0);
  expect(tasks.fast.cache).toBe(false);
  // The server tests it relates read the built web UI, as `ts:test`'s do.
  expect(tasks.fast.dependsOn).toContain("web:build");
});

/**
 * Vite Task's globs match dot folders, `**` included, which `matchesGlob`'s do not: a leading dot is
 * renamed in both, so `.worktrees` is a folder like any other.
 */
const undotted = (path: string) => path.replaceAll(/(^|\/)\./g, "$1dot-");

/** Whether a cached task's explicit input globs fingerprint a file. */
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
  "%s reruns when the native binding or the pinned tools change",
  (task) => {
    for (const file of [
      "crates/core/src/lib.rs",
      "crates/binding/src/lib.rs",
      "Cargo.lock",
      "flake.lock",
    ]) {
      expect(tracks(task, file), `${task} tracks ${file}`).toBe(true);
    }
  },
);
