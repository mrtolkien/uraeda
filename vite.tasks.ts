// The task graph of `vp run ready`, which `vite.config.ts` gives Vite Task as its `run.tasks`.
import { statSync } from "node:fs";
import { join } from "node:path";
import { SOURCES } from "./packages/server/src/binding.ts";

/** The pinned tools used by cached checks, in the dev shell and package runtime. */
const toolchainInputs = [
  "flake.nix",
  "flake.lock",
  "package.json",
  "pnpm-workspace.yaml",
  "rust-toolchain.toml",
];
/** The root config files, which every task loading the root config reads. */
const rootConfig = [
  "vite.config.ts",
  "vite.tasks.ts",
  "scripts/test-policy.ts",
  "tsconfig.json",
  "tsconfig.base.json",
  ...toolchainInputs,
];

/**
 * The dev shell's variables the tests need, which Vite Task does not pass to a task unless listed:
 * the browsers, their fonts and EGL driver, and mini.test. Not part of a result, so not fingerprinted.
 */
const testEnv = [
  "PLAYWRIGHT_BROWSERS_PATH",
  "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS",
  "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD",
  "FONTCONFIG_FILE",
  "__EGL_VENDOR_LIBRARY_DIRS",
  "MINI_TEST",
  "URAEDA_TEST_TRACE",
];

/**
 * A test ignores the host's git: its configuration, so the tests' repositories get git's defaults,
 * and the repository variables a git hook exports, which `--no-cache` and uncached tasks pass on.
 */
const isolatedGit =
  "env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1";

/**
 * Runs a test command in a temporary folder of its own, `TMPDIR`, removed when it ends (see
 * `scripts/test-run.ts`): several checkouts' tests at once once filled the machine's `/tmp`. From
 * the task's `cwd`, which `from` reaches the root from.
 */
const testRun = (from = ".") => `node ${from === "." ? "" : `${from}/`}scripts/test-run.ts`;

/**
 * The browser tests run at most two at once on the machine, one checkout's phone and desktop: more,
 * from several checkouts, slowed them all past their timeouts. The others wait for their turn.
 */
const browserRun = `${testRun()} --lock browser --slots 2`;

/**
 * The type checks, the lints, and the Rust tests run at most two at once on the machine, from every
 * checkout: more, from several worktrees, got runs killed. The others wait for their turn.
 */
const heavyRun = `${testRun()} --lock heavy --slots 2`;

/** What the Rust crates are built from: the skill is compiled into the core. */
const rustSources = [
  "crates/**",
  "Cargo.toml",
  "Cargo.lock",
  "clippy.toml",
  "rust-toolchain.toml",
  "skills/uraeda/**",
  ...toolchainInputs,
];

/** The binding's sources, from `binding.ts`'s list, a folder standing for every file under it. */
const bindingInputs = SOURCES.map((source) =>
  statSync(join(import.meta.dirname, source)).isDirectory() ? `${source}/**` : source,
);

/** What the TypeScript tests read: the packages, the fixtures, and the skill the core embeds. */
const tsTestInputs = [
  "packages/**",
  "fixtures/**",
  "skills/uraeda/**",
  ...bindingInputs,
  ...rootConfig,
  "pnpm-lock.yaml",
  "!**/node_modules/**",
  "!**/dist/**",
  "!**/.vitest/**",
  "!packages/web/storybook-static/**",
  // Built by `ui:build`, from what the tests read already.
  "!packages/uraeda/{plugin,web}/**",
];

/**
 * The checks of `vp run ready`, as a graph of cached tasks (see `specs/decisions/toolchain.md`):
 * each lists the files it reads in `cache.input`, so a change reruns only the checks it can break.
 * The `ready:*` groups, which run nothing themselves, are the units CI's jobs run, uncached.
 */
export const tasks = {
  // Selection has no cached result: HEAD and the working tree are runtime inputs. It takes a heavy
  // slot itself, after selecting, and none when it escalates to ready, whose tasks take their own.
  fast: {
    cache: false,
    command: `${testRun()} ${isolatedGit} node scripts/fast-check.ts`,
  },
  // The benchmarks of the specs' success criteria: they measure time, so are never replayed.
  bench: {
    cache: false,
    command: [
      `${testRun()} ${isolatedGit} cargo nextest run --run-ignored only -E 'test(/^bench_/)'`,
      `${testRun()} ${isolatedGit} vp test bench --run`,
      // The run-ui feature's SC-002: the installed package's first page within 2 seconds.
      `${testRun()} ${isolatedGit} node packages/uraeda/scripts/smoke.ts --binding packages/binding --timed`,
    ],
    dependsOn: ["binding:touch", "ui:build"],
  },
  // A hit restores the built binding, and its generated files, which are committed.
  "binding:build": {
    cache: {
      input: [
        ...bindingInputs,
        "packages/binding/package.json",
        "pnpm-lock.yaml",
        "rust-toolchain.toml",
        ...toolchainInputs,
      ],
      output: [
        "packages/binding/*.node",
        "packages/binding/index.js",
        "packages/binding/index.d.ts",
      ],
    },
    command:
      "node_modules/.bin/napi build --platform --esm --no-const-enum --manifest-path ../../crates/binding/Cargo.toml --output-dir .",
    cwd: "packages/binding",
  },
  // A hit restores the binding with the time it was built at, which a source saved since with the
  // same content is newer than: the configs loading it would rebuild it (`freshBinding`), from
  // inside the task. The binding is built from its sources as they are, so it is marked as built
  // now, on every run, before any task loading it.
  // The results page of `benchmarks/runs/`, opened in the browser (see the benchmarks spec's US5).
  "benchmarks:report": {
    cache: false,
    command: "node src/report-cli.ts",
    cwd: "packages/benchmarks",
  },
  // Checks Claude Code, the token, and `auto` mode against a real case image (see the benchmarks
  // plan's Task 1). It needs Docker and the network, so it is never cached or part of `ready`.
  "benchmarks:probe": {
    cache: false,
    command: "node scripts/probe.ts",
    cwd: "packages/benchmarks",
  },
  "binding:touch": {
    cache: false,
    // In a shell: Vite Task runs a plain command without expanding its globs.
    command: "sh -c 'touch -c packages/binding/*.node'",
    dependsOn: ["binding:build"],
  },
  "browser:desktop": {
    cache: { input: [...tsTestInputs, "scripts/test-run.ts"], output: [], untrackedEnv: testEnv },
    command: `${browserRun} ${isolatedGit} vp test --project desktop`,
    dependsOn: ["binding:touch"],
  },
  "browser:phone": {
    cache: { input: [...tsTestInputs, "scripts/test-run.ts"], output: [], untrackedEnv: testEnv },
    command: `${browserRun} ${isolatedGit} vp test --project phone`,
    dependsOn: ["binding:touch"],
  },
  // A report of the lines the Rust tests and the TypeScript unit tests run, never a check: it is not
  // cached, no task depends on it, and nothing fails when coverage drops.
  coverage: {
    cache: false,
    command: [
      // cargo-llvm-cov writes its lcov file into an existing folder only.
      "mkdir -p coverage",
      `${testRun()} ${isolatedGit} cargo llvm-cov nextest --profile coverage --lcov --output-path coverage/rust.lcov`,
      "cargo llvm-cov report --html --output-dir coverage/rust",
      `${testRun()} ${isolatedGit} vp test --project '!phone' --project '!desktop' --coverage`,
      "node scripts/coverage-summary.ts",
    ],
    dependsOn: ["binding:touch", "web:build"],
  },
  // The HTML reports `vp run coverage` last wrote, opened in the browser.
  "coverage:open": {
    cache: false,
    command: "xdg-open coverage/rust/html/index.html && xdg-open coverage/typescript/index.html",
  },
  "lua:fmt": {
    cache: { input: ["editors/nvim/**", ...toolchainInputs], output: [] },
    command: "stylua --check editors/nvim",
  },
  ready: {
    command: "true",
    dependsOn: ["ready:rust", "ready:typescript", "ready:browser-phone", "ready:browser-desktop"],
  },
  "ready:browser-desktop": { command: "true", dependsOn: ["browser:desktop"] },
  "ready:browser-phone": { command: "true", dependsOn: ["browser:phone"] },
  "ready:rust": {
    command: "true",
    dependsOn: ["rust:fmt", "rust:clippy", "rust:test", "rust:features", "specs:check"],
  },
  "ready:typescript": {
    command: "true",
    dependsOn: [
      "binding:build",
      "web:theme",
      "lua:fmt",
      "ts:check",
      "ts:test",
      "web:build",
      "ui:build",
      "ui:smoke",
      "storybook:build",
    ],
  },
  "rust:clippy": {
    cache: { input: rustSources, output: [] },
    command: `${heavyRun} cargo clippy --workspace --all-targets -- -D warnings`,
  },
  // `ura` never builds napi: a binding built into the other crates' tests would not link.
  "rust:features": {
    cache: {
      input: [
        "crates/*/Cargo.toml",
        "Cargo.toml",
        "Cargo.lock",
        "rust-toolchain.toml",
        ...toolchainInputs,
      ],
      output: [],
    },
    command: "! cargo tree -p uraeda-cli -e features --prefix none | grep -qE '^napi(-derive)? v'",
  },
  "rust:fmt": {
    cache: {
      input: ["crates/**", "rustfmt.toml", "rust-toolchain.toml", ...toolchainInputs],
      output: [],
    },
    command: "cargo fmt --check",
  },
  "rust:test": {
    // CI sets NEXTEST_PROFILE=ci, to report every failure at once.
    cache: {
      input: [...rustSources, "fixtures/**", ".config/nextest.toml", "scripts/test-run.ts"],
      output: [],
      untrackedEnv: [...testEnv, "NEXTEST_PROFILE"],
    },
    command: `${heavyRun} ${isolatedGit} cargo nextest run`,
  },
  // `ura check` follows the specs' links to any Markdown file of the repository.
  "specs:check": {
    cache: {
      input: [
        ...rustSources,
        "specs/**",
        "**/*.md",
        // In the main checkout, every worktree's files: an edit there is not this checkout's.
        "!.worktrees/**",
        "!**/node_modules/**",
        "!target/**",
        "!coverage/**",
        "!**/.vitest/**",
        "!**/dist/**",
        "!packages/uraeda/{plugin,web}/**",
        "!packages/web/storybook-static/**",
      ],
      output: [],
    },
    command: [
      "cargo run -q -p uraeda-cli -- check specs",
      "cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs",
    ],
  },
  // Uraeda's own Storybook, built so a story that does not build fails `ready` (see
  // `specs/decisions/preview.md`): the stories, its config, the skill's two files it loads, and the
  // web UI's Vite config it extends, with the server's fate API its client is generated from, and
  // the fixture's helpers and fake Storybook its config loads.
  "storybook:build": {
    cache: {
      input: [
        "packages/web/src/**",
        "packages/web/.storybook/**",
        "packages/web/vite.config.ts",
        "packages/web/vite.transforms.ts",
        "packages/web/package.json",
        "packages/server/src/**",
        "skills/uraeda/assets/storybook/uraeda-preview.js",
        "skills/uraeda/assets/storybook/uraeda-pick.js",
        "packages/binding/test-utils.ts",
        "fixtures/preview/**",
        "pnpm-lock.yaml",
        ...rootConfig,
        "!packages/web/node_modules/.cache/storybook/**",
      ],
      output: ["packages/web/storybook-static/**"],
    },
    // `vp exec` is never cached: the binary itself is.
    command: "node_modules/.bin/storybook build --quiet --output-dir storybook-static",
    cwd: "packages/web",
    dependsOn: ["binding:touch"],
  },
  // CI only (see the toolchain decision): the Neovim plugin's tests, on the `ura` they build.
  "test:nvim": {
    cache: false,
    command: [
      "cargo build -q -p uraeda-cli",
      `${testRun("../..")} ${isolatedGit} nvim --headless --noplugin -u tests/minimal_init.lua -c 'lua MiniTest.run()'`,
    ],
    cwd: "editors/nvim",
  },
  // Every file `vp check` formats or lints, by extension: a Rust or Lua change does not rerun it.
  "ts:check": {
    cache: {
      input: [
        ...toolchainInputs,
        "**/*.{ts,tsx,js,mjs,cjs,json,jsonc,md,toml,yml,yaml,html,css}",
        // In the main checkout, every worktree's files: an edit there is not this checkout's.
        "!.worktrees/**",
        "!**/node_modules/**",
        "!target/**",
        "!**/dist/**",
        "!fixtures/**",
        "!packages/web/storybook-static/**",
        "!coverage/**",
        "!**/.vitest/**",
        "!packages/uraeda/{plugin,web}/**",
      ],
      output: [],
    },
    command: `${heavyRun} vp check`,
    dependsOn: ["binding:build"],
  },
  "ts:test": {
    cache: {
      // The toolchain test reads the runners' settings, CI's workflow, and the crates' manifests.
      input: [
        ...tsTestInputs,
        ".config/nextest.toml",
        ".github/workflows/ci.yml",
        "crates/*/Cargo.toml",
        "crates/*/src/lib.rs",
        // `vp run coverage`'s summary, tested with the server's tests, and fast's selection and
        // focused configuration, which the scripts tests run.
        "scripts/**",
        "vite.fast.config.ts",
      ],
      output: [],
      untrackedEnv: testEnv,
    },
    // Every project but the browser's, by exclusion: a package added to `test.projects` runs here.
    // The built web UI is read by server tests; its source and toolchain inputs above determine
    // it. Listing dist here would have no effect: the explicit dist exclusion always wins.
    command: `${testRun()} ${isolatedGit} vp test --project '!phone' --project '!desktop'`,
    dependsOn: ["binding:touch", "web:build"],
  },
  // `@uraeda/ui`, built from the web UI, the server, the binding's loader, and the skill.
  "ui:build": {
    cache: {
      input: [
        "packages/uraeda/**",
        "packages/server/**",
        "packages/web/dist/**",
        "packages/binding/index.js",
        "skills/uraeda/**",
        ...rootConfig,
        "pnpm-lock.yaml",
        "!**/node_modules/**",
        "!packages/uraeda/{dist,plugin,web}/**",
      ],
      output: ["packages/uraeda/{dist,plugin,web}/**"],
    },
    command: "node scripts/build.ts",
    cwd: "packages/uraeda",
    dependsOn: ["web:build", "binding:build"],
  },
  // The package, installed and run as a user would, on the checkout's binding: timed by `bench` only.
  "ui:smoke": {
    cache: {
      input: [
        "packages/uraeda/**",
        "packages/binding/*.node",
        "packages/server/src/free-port.ts",
        "packages/binding/index.js",
        "Cargo.toml",
        ...rootConfig,
        "pnpm-lock.yaml",
        "scripts/test-run.ts",
        "!**/node_modules/**",
      ],
      output: [],
      untrackedEnv: testEnv,
    },
    command: `${testRun()} ${isolatedGit} node packages/uraeda/scripts/smoke.ts --binding packages/binding`,
    dependsOn: ["ui:build", "binding:touch"],
  },
  "web:build": {
    cache: {
      input: [
        "packages/web/**",
        "packages/server/**",
        ...rootConfig,
        "pnpm-lock.yaml",
        "!**/node_modules/**",
        "!**/dist/**",
        "!**/.vitest/**",
        "!packages/web/storybook-static/**",
      ],
      output: ["packages/web/dist/**"],
    },
    command: "vp build",
    cwd: "packages/web",
    dependsOn: ["binding:touch"],
  },
  "web:theme": {
    cache: {
      input: ["packages/web/src/theme/**", "pnpm-lock.yaml", ...toolchainInputs],
      output: [],
    },
    command:
      "node_modules/.bin/astryx theme build src/theme/theme.ts --out src/theme/built/uraeda.css --check",
    cwd: "packages/web",
  },
};
