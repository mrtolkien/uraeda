---
status: auto-approved
spec-revision: 1
---

# Plan: Testing review

**Goal:** `vp run ready` reruns only what a change can affect, in parallel; CI runs every check
uncached across parallel jobs; every test gives the same result on every run; and coverage is
reported.

**Architecture:** the [toolchain](../decisions/toolchain.md) decision's rules hold the whole
feature. `vite.config.ts`'s `run.tasks` owns the task graph and, through each task's `cache.input`,
the only map of what a change can break; the binding's sources stay listed once, in
[`binding.ts`](/packages/server/src/binding.ts)'s `SOURCES`, which the binding task imports. CI's
jobs run the graph's four groups, and a test of the toolchain's configuration keeps the graph, CI,
the runners' settings, and the crates in step. Each test owns its isolation: git's global
configuration is ignored by the task commands for in-process git, and by the existing helpers for
spawned git. The browser tests own their size (a helper that skips a test at the other size before
any hook runs) and their repository (a template built once per process, copied per test). See the
[spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A browser test skipped at one size still taking a repository**: a skip decided inside the test
   body, as the `window.innerWidth` early returns do today, runs `beforeEach`'s `takeRepo` and saves
   nothing. A skipped test must not run the file's hooks. Task 5.
2. **The two browser sizes running at once**, as two `vp test` processes under `ready`: each has its
   own global setup, data folder, fake agent and port (`strictPort: false`). Both must pass when run
   together, which today never happens, since one process runs both sizes in turn. Task 5.
3. **A cache hit restoring the binding's `.node` file** must not trip the web configs' freshness
   check, which compares the file's modification time with its sources'. Task 3.
4. **A test that prints an expected error**, such as the runner cache's "could not be opened", must
   capture it, so CI's log only shows errors that are bugs. Task 4.
5. **The toolchain test reading the real files** must fail on the real `ci.yml` the moment a task is
   added to `ready` without a job: its checks are pure functions, tested on fixtures, then run on
   the repository's files. Tasks 3 and 9.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these.

From [toolchain](../decisions/toolchain.md), word for word:

- `vp run ready` MUST run every check of the repository, except the CI-only checks below. A new
  language, package, crate, or tool MUST add its checks to it. Checked by review.
- Each check of `ready` MUST be a task of `vite.config.ts`, cached by Vite Task, with its inputs
  listed in `cache.input`: a check MUST NOT rely on automatic input tracking. Checked by the test of
  the toolchain's configuration.
- CI MUST run every check of `ready`, without Vite Task's cache, inside the `flake.nix` dev shell,
  on Linux x64, split across parallel jobs, and MUST fail when a job leaves the working tree
  changed. Other platforms are built by the release matrix, not validated. Checked by the test of
  the toolchain's configuration, which compares `ready`'s tasks with the tasks CI's jobs run.
- Checks too slow or too secondary for every local run MAY run on CI only: today the Neovim plugin's
  tests, the release plan, and the release binary's size. Each MUST stay runnable locally with
  `vp run <task>`. Checked by review.
- Rust code MUST pass `cargo fmt --check`, `cargo clippy` with warnings as errors, and its tests,
  run with cargo-nextest. Checked by `ready`.
- A bare `cargo nextest run` or `cargo test` MUST test every crate except the Node binding, through
  the workspace's `default-members`; the binding's tests MUST run from TypeScript. `--workspace` is
  not supported: selecting the binding turns on the core's `napi` feature for every crate, and their
  test binaries then fail to link napi's symbols, which only Node provides. Checked by `ready`.
- Library crates MUST set `doctest = false`, since cargo-nextest does not run doctests. Checked by
  the test of the toolchain's configuration.
- Test runners MUST NOT retry a failed test: cargo-nextest, Vitest, and mini.test run each test
  once. A test that fails without a bug MUST be fixed or rewritten in the pull request that finds
  it. Checked by the test of the toolchain's configuration, and by review.
- Coverage of the Rust and TypeScript unit tests MUST be reported by `vp run coverage`, and CI MUST
  keep the report of each push to `main` as an artifact. A coverage drop MUST NOT fail a check.
  Checked by review.
- The Rust toolchain MUST be pinned in `rust-toolchain.toml`, with the 2024 edition; Node and pnpm
  MUST be pinned in `package.json`'s `devEngines`; cargo-nextest and cargo-llvm-cov MUST be pinned
  by the flake. Checked by review.
- Files generated by napi-rs MUST be committed, and MUST NOT be edited by hand. Checked by CI's
  clean working tree.

From [code quality](../decisions/code-quality.md), word for word:

- Rust and TypeScript functions MUST NOT be longer than 100 lines. Checked by clippy's
  `too_many_lines` and Oxlint's `max-lines-per-function`.
- Rust and TypeScript source files MUST NOT be longer than 500 lines. Tests and generated files are
  exempt. Checked by Oxlint's `max-lines`, and for Rust by a structural test of the workspace.
- A new marker MUST NOT be added unless a human approves it as a constitution exception in the
  plan's complexity tracking. Checked by review.
- A custom lint rule or structural test MUST say how to fix the problem in its message. Checked by
  review, and by the fixtures that make each rule fire.
- Unit tests MUST NOT sleep for a fixed time, or assert how long something took. Benchmarks of a
  spec's success criteria are exempt. Checked by review.

From [UI checks](../decisions/ui-checks.md), word for word:

- Every UI test MUST guard a spec's acceptance scenario, edge case, or success criterion, or a rule
  of a UI decision. A test that guards neither MUST NOT be added.
- A test that no longer matches the spec MUST be changed or removed with the spec, never kept
  passing by loosening its assertion.
- `vp run ready` MUST run, in WebKit, at 402 × 874 and at 1440 × 900, on every page a UI decision
  governs: no text cut, no sideways scroll, the text sizes and control heights of the
  [UI layout](../decisions/ui-layout.md) decision, and axe-core's WCAG 2.1 A and AA rules in light
  and dark.

From [the spec](spec.md):

- The task names and groups of the spec's [Data](spec.md#data) table: `rust:fmt`, `rust:clippy`,
  `rust:test`, `rust:features`, `specs:check`, `binding:build`, `web:theme`, `lua:fmt`, `ts:check`,
  `ts:test`, `browser:phone`, `browser:desktop`, `web:build`, `ready:rust`, `ready:typescript`,
  `ready:browser-phone`, `ready:browser-desktop`, `ready`, `test:nvim`, `bench`, `coverage`.
- Cargo tasks declare `output: []`; `binding:build` declares `packages/binding/*.node`,
  `packages/binding/index.js` and `packages/binding/index.d.ts` as outputs.
- Every test task ignores the host's git configuration (`GIT_CONFIG_GLOBAL=/dev/null`,
  `GIT_CONFIG_NOSYSTEM=1`, set in its command), and passes `PLAYWRIGHT_BROWSERS_PATH`,
  `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`,
  `FONTCONFIG_FILE`, `__EGL_VENDOR_LIBRARY_DIRS` and `MINI_TEST` through `cache.untrackedEnv`, from
  one shared list.
- `.config/nextest.toml`: profile `default` with
  `slow-timeout = { period = "30s", terminate-after = 4 }` and
  `leak-timeout = { period = "500ms", result = "fail" }`, no `retries`; profile `ci` the same with
  `fail-fast = false`, selected by `NEXTEST_PROFILE=ci`; profile `coverage` the default with a
  `default-filter` leaving out the iCCP bomb memory test.
- A Rust benchmark is a test marked `#[ignore = "benchmark"]` whose name starts with `bench_`; a
  TypeScript benchmark is a `*.bench.ts` file.
- The toolchain test's messages, exactly:
  - "`<task>` has no `cache.input`: list the files it reads, so `ready` reruns it when they change."
  - "`ready` runs `<task>`, but no CI job does: add it to a job in `.github/workflows/ci.yml`."
  - "Tests are never retried (toolchain decision): remove `<setting>` and fix the test that needed
    it."
  - "`<crate>` must set `doctest = false`: cargo-nextest does not run doctests."
- CI jobs `rust`, `typescript`, `browser-phone`, `browser-desktop`, `neovim` and `release`, each
  `vp run --no-cache <group>`, then the clean working tree check; `coverage` on pushes to `main`,
  uploading `coverage/` as the `coverage` artifact, kept 30 days; `timeout-minutes: 20` per job; a
  `concurrency` group per branch with `cancel-in-progress` for pull requests; a shared setup action
  `.github/actions/setup/action.yml` (Nix, the Rust cache, `pnpm install`); `Swatinem/rust-cache`
  with one shared key, saved from `main` only.
- `vp run coverage` writes `coverage/rust.lcov`, `coverage/typescript/lcov.info`, an HTML report for
  each, and a summary of lines covered per language; when the spawned `ura` is not counted, the
  summary says "The `ura` binary run by the CLI tests is not counted." under the Rust total.
- SC-001: CI under 8 minutes; SC-002: 10 CI passes in a row; SC-003: a `ready` with no change under
  15 seconds; SC-004: browser summed file time per size at most 180 seconds on CI; SC-005: no Rust
  or TypeScript test outside a benchmark sleeps for a fixed time or asserts a duration.

Existing guarantees to preserve:

- The binding is never built into the other crates' tests: the `rust:features` check
  ([`package.json`](/package.json)'s `cargo tree` guard) keeps passing.
- Generated files stay committed and unchanged by a run: napi's `index.js` and `index.d.ts`, and the
  theme's `built/` files.
- Every test's temporary folders are removed: `test-setup.ts`'s per-file `TMPDIR`,
  `temporaryFolder`'s exit hook, `TestRepo`'s `Drop`, and the browser turn's `rmSync`.

## Code read

- [`package.json`](/package.json): `ready` is 15 steps joined by `&&`; `test:nvim` runs
  `nvim --headless --noplugin -u tests/minimal_init.lua -c 'lua MiniTest.run()'` from
  `editors/nvim`; `dev`, `start`, `validate:claude` are not checks.
- [`vite.config.ts`](/vite.config.ts): no `run` block yet; `test.projects` lists binding, server,
  web, and `packages/web/vite.browser.config.ts`; `fmt` and `lint` ignore patterns.
- Vite Task's local docs, `node_modules/vite-plus/docs/config/run.md` and `guide/run.md`: tasks need
  a `command` (a shell string, `&&` split into cached sub-tasks); `dependsOn`; `cache.input` globs
  relative to the root package, here the workspace root; `cache.output: []` keeps outputs in place;
  `cache.untrackedEnv`; tasks get only `HOME`, `USER`, `PATH`, `SHELL`, `LANG`, `TZ`, Node, CI and
  colour variables, so `GIT_DIR` and the dev shell's variables are dropped; `--no-cache`, `-v`,
  `--last-details`; 4 tasks at once by default.
- [`vite.browser.config.ts`](/packages/web/vite.browser.config.ts): the instances are named `phone`
  and `desktop`, which `vp test --project phone` and `--project desktop` select (checked with
  `vp test list`); `takeRepo` builds `fixtureRepo()` per test, adds it to the list and reloads, and
  every test of both sizes takes its turn in one queue, for the one fake agent;
  `fileParallelism: false`.
- [`__browser__/setup.ts`](/packages/web/src/__browser__/setup.ts): sets `URAEDA_REPO` and
  `URAEDA_DATA_DIR` in the process, which the Node projects inherit while all projects share one
  `vp test` process ([`dev.test.ts:11`](/packages/server/src/__tests__/dev.test.ts) saves them).
- [`__browser__/helpers.tsx`](/packages/web/src/__browser__/helpers.tsx): `beforeEach` takes the
  repository, `afterEach` releases it; 21 `window.innerWidth` checks across the browser files make
  tests size-specific from inside their body.
- [`binding/test-utils.ts`](/packages/binding/test-utils.ts): `isolateGit()`, `temporaryFolder`,
  `fixture`, `git`, `fixtureRepo` (git init, 1 commit on `main`, 1 per branch of
  `fixtures/repo/branches/`: 4 today). [`test-setup.ts`](/packages/binding/test-setup.ts): `TMPDIR`
  per file.
- [`binding.ts`](/packages/server/src/binding.ts): `SOURCES` is exported; `checkBinding()` throws
  when a source is newer than the `.node` file; the web configs call it in `configureServer`.
- [`web/vite.config.ts`](/packages/web/vite.config.ts) and [`env.ts`](/packages/server/src/env.ts):
  `devServer(loadEnv(root))` and `devHandler(root)` read `<root>/.env`, the environment winning; the
  web project's `testTimeout` is 20 s; [`server/vite.config.ts`](/packages/server/vite.config.ts)
  has the 5 s default.
- [`live.test.ts`](/packages/server/src/__tests__/live.test.ts): duration checks at lines 140 and
  452, sleeps at 407 (`SESSION_UPDATE_MS`) and 465 (500 ms after a change, to show none arrives).
  [`repositories.test.ts`](/packages/server/src/__tests__/repositories.test.ts): duration check at
  491, sleep at 557, `HOME` stub restored outside a `finally` at 317-320.
- [`runner/cache.ts:276-311`](/packages/server/src/runner/cache.ts): prints "The runner's cache
  could not be opened…" and "…could not be read, so it starts empty…" on purpose, for error paths
  its tests exercise.
- Browser [`attach.test.tsx`](/packages/web/src/__browser__/attach.test.tsx): duration check at 280,
  sleeps at 295 and 346; [`round.test.tsx`](/packages/web/src/__browser__/round.test.tsx): the
  scroll offset polls that failed twice on CI.
- [`Cargo.toml`](/Cargo.toml): `default-members` without the binding;
  [`crates/core`](/crates/core/Cargo.toml) and [`crates/lsp`](/crates/lsp/Cargo.toml) have no
  `[lib]` section; the binding's sets `test = false`, `doctest = false`. No `.config/`.
- [`lsp/tests/commands.rs:14-24`](/crates/lsp/tests/commands.rs): `on_2026_10_14()` sets `URA_TODAY`
  through a `Once`, called by `start()`, after helpers such as `with_priorities` have already
  spawned git; `requests_are_answered_while_a_command_runs` (858-871) uses a hook that sleeps 1 s.
- [`lsp/tests/common/mod.rs`](/crates/lsp/tests/common/mod.rs): `Session` runs the server on a
  thread over `Connection::memory()`, waits 2 s (`WAIT`) for diagnostics and requests with
  deadlines; `Drop` joins without one.
- Timing tests: [`lsp/tests/diagnostics.rs:137-157`](/crates/lsp/tests/diagnostics.rs)
  (`diagnostics_arrive_within_300_ms`),
  [`cli/tests/performance.rs`](/crates/cli/tests/performance.rs) (5 s bound),
  [`core/tests/images.rs:233-240`](/crates/core/tests/images.rs) (each bomb under 1 s, plus its
  refusal message).
- [`core/tests/document.rs:366-400`](/crates/core/tests/document.rs):
  `every_example_and_specs_file_parses` reads the example's specs and the repository's `specs/`.
- [`editors/nvim/tests/helpers.lua`](/editors/nvim/tests/helpers.lua) and `minimal_init.lua`:
  `helpers.git` and `helpers.repo` run git with the inherited environment; `minimal_init.lua` is
  loaded by the runner and by every child Neovim; `test_actions.lua:5,7` and `test_verdict.lua:6`
  set `URA_TODAY` and `URA_NOW` at load.
- [`ci.yml`](/.github/workflows/ci.yml): one job, `cachix/install-nix-action@v31`,
  `Swatinem/rust-cache@v2`, `nix develop --command pnpm install --frozen-lockfile --ignore-scripts`
  (scripts off: `prepare` rewrites AGENTS.md), `vp run ready`, the clean tree check, `dist plan`,
  the release size.
- [`flake.nix`](/flake.nix): the dev shell's packages and variables;
  [`rust-toolchain.toml`](/rust-toolchain.toml): `1.96.0`, `rustfmt`, `clippy`.
- [`README.md:236`](/README.md) and [`editors/nvim/README.md:77`](/editors/nvim/README.md): the
  commands that change.
- The test layouts: Rust integration tests in `crates/*/tests/`, sharing
  `crates/core/tests/common/`; Vitest files in `__tests__/` beside the code; browser tests in
  `packages/web/src/__browser__/`; Neovim tests in `editors/nvim/tests/test_*.lua`.

## Constitution check

| Principle                                  | Complies | Notes                                                                      |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | Only the approved toolchain change; each removed test is a ruling (task 6) |
| II. Git and plain text first               | yes      | Tasks, profiles, workflows and the audit are text in the repository        |
| III. Asynchronous by default               | yes      | The cache is local and disposable; CI never uses it                        |
| IV. Review effort matches impact           | yes      | The audit's outcome per file is in task 6                                  |
| V. Tools are optional                      | yes      | The workflow's files and `ura` are unchanged                               |
| VI. Code is checked and stays maintainable | yes      | No check dropped; scenario tests kept; no limit raised, no marker added    |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Toolchain](../decisions/toolchain.md): every rule, tasks 1, 3, 7, 8 and 9.
- [Code quality](../decisions/code-quality.md): no sleeps or duration checks outside benchmarks
  (tasks 2, 4, 5); the limits for the new test and config code.
- [UI checks](../decisions/ui-checks.md): layout and accessibility at both sizes, the audit's
  criteria (tasks 5 and 6).
- [Stack](../decisions/stack.md): the binding tested from TypeScript (task 3's `binding:build`
  before the TypeScript tests).

## Complexity tracking

| Abstraction or exception                      | Why it is needed                                                                                               | Simpler alternative rejected because                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| The toolchain test's four check functions     | The decision's rules a tool can read: inputs listed, CI covering `ready`, no retries, no doctests (tasks 3, 9) | Review only: the rules would drift as tasks and jobs are added                     |
| The shared environment list of the test tasks | One home for the dev shell's variables and the git isolation, used by every test task (task 3)                 | Repeating them per task: the next task would miss one                              |
| The browser size helper                       | One way for a browser test to declare its size, skipping before hooks run (task 5)                             | The `innerWidth` early returns: they still take a repository, so they save nothing |
| The browser repository template               | One fixture repository built per process, copied per test (task 5)                                             | Building it with git per test: about 20 git processes per test                     |
| The shared CI setup action                    | Nix, the Rust cache and `pnpm install`, identical in 7 jobs (task 9)                                           | Copying the steps per job: 7 copies to keep in step                                |

No function or file grows past a limit; no marker is added.

---

## Task 1: cargo-nextest runs the Rust tests

**Files:**

- Create: `.config/nextest.toml`
- Modify: `flake.nix` (`devShells.default.packages`), `rust-toolchain.toml` (`components`),
  `crates/core/Cargo.toml` and `crates/lsp/Cargo.toml` (a `[lib]` with `doctest = false`),
  `package.json` (`ready`: `cargo test` becomes `cargo nextest run`)

**Interfaces:**

- Produces: `cargo nextest run` and `cargo llvm-cov` in the dev shell; the nextest profiles
  `default`, `ci` and `coverage` (the last one completed in task 8); `llvm-tools-preview` in the
  toolchain.

- [x] **Step 1: Add `cargo-nextest` and `cargo-llvm-cov` to the dev shell's packages, and
      `llvm-tools-preview` to `rust-toolchain.toml`'s components**

- Run: `nix develop -c bash -c 'cargo nextest --version && cargo llvm-cov --version'`
- Expected: both print a version.

- [x] **Step 2: Write `.config/nextest.toml` with the profiles `default` and `ci` of the global
      constraints, and `doctest = false` in the core's and the LSP's `[lib]`**

- [x] **Step 3: Check that a hung test is stopped (US1.4)**

Add, temporarily, to `crates/core/tests/slug.rs`:
`#[test] fn hangs() { std::thread::sleep(std::time::Duration::from_secs(600)); }`.

- Run: `nix develop -c cargo nextest run -p uraeda-core --test slug`
- Expected (R1): after 2 minutes, `TIMEOUT` for `slug hangs`, the other slug tests passing, and a
  failed run. Then remove the test.

- [x] **Step 4: Replace `cargo test` with `cargo nextest run` in `ready`, and run every Rust test**

- Run: `nix develop -c cargo nextest run`
- Expected: PASS, every test of core, cli and lsp, the binding not built; the same count as
  `cargo test` minus its empty doctest passes (552 tests, 1 skipped as ignored).

- [x] **Step 5: Commit**

```bash
git add .config/nextest.toml flake.nix rust-toolchain.toml crates/core/Cargo.toml crates/lsp/Cargo.toml package.json
git commit -m "build(testing-review): Rust tests run with cargo-nextest"
```

## Task 2: Rust tests without races or timing checks

**Files:**

- Modify: `crates/lsp/tests/commands.rs` (`on_2026_10_14` callers;
  `requests_are_answered_while_a_command_runs`), `crates/lsp/tests/diagnostics.rs`
  (`diagnostics_arrive_within_300_ms`), `crates/cli/tests/performance.rs`,
  `crates/core/tests/images.rs` (the bombs' test), `crates/core/tests/document.rs`
  (`every_example_and_specs_file_parses`)

**Interfaces:**

- Produces: the benchmarks `bench_diagnostics_arrive_within_300_ms`,
  `bench_status_and_next_stay_fast_with_twenty_feature_branches` and `bench_bombs_are_refused_fast`,
  each `#[ignore = "benchmark"]`, which task 3's `bench` task runs with
  `cargo nextest run --run-ignored only -E 'test(/^bench_/)'`.

- [x] **Step 1: Make the LSP tests set `URA_TODAY` before any git runs**

Every helper of `commands.rs` that creates a `TestRepo` (`with_priorities`, `feature`, `with_draft`,
and any other) calls `on_2026_10_14()` first, so every thread has passed the `Once` before it spawns
git. Its SAFETY comment says so.

The break it prevents: under `cargo test`, a thread spawning git while another sets the variable,
reading a torn environment.

- [x] **Step 2: Rewrite `requests_are_answered_while_a_command_runs` without the sleep**

The hook waits for a file to exist
(`until [ -e "$(git rev-parse --git-common-dir)/go" ]; do sleep 0.01; done`); the test asserts the
command is not answered after `uraeda/fields` answered, then creates `go`, and reads the command's
response.

The break it catches: a server whose loop blocks on a running command, which never answers
`uraeda/fields` while the hook waits.

- [x] **Step 3: Turn the timing checks into benchmarks**

- `diagnostics_arrive_within_300_ms` becomes `bench_diagnostics_arrive_within_300_ms`, ignored as a
  benchmark; a new test keeps its behaviour without the clock: the changed `risk-tier` gives exactly
  one diagnostic.
- `status_and_next_stay_fast_with_twenty_feature_branches` becomes the benchmark
  `bench_status_and_next_stay_fast_with_twenty_feature_branches`; a test keeps its listing check (20
  features listed) without `timed`'s bound.
- The bombs' test keeps its refusal messages, without the duration; the durations move to
  `bench_bombs_are_refused_fast`.

- [x] **Step 4: Drop the repository's `specs/` from `every_example_and_specs_file_parses`**

It becomes `every_example_file_parses`, reading the example's specs only, since `specs:check` parses
`specs/` in `ready`. Its doc comment says so.

- [x] **Step 5: Run the Rust tests, then the benchmarks**

- Run: `nix develop -c cargo nextest run`
- Expected: PASS, with 3 more skipped (the benchmarks).
- Run: `nix develop -c cargo nextest run --run-ignored only -E 'test(/^bench_/)'`
- Expected: PASS, the 3 benchmarks.
- Run: `grep -rnE 'Instant::now|thread::sleep' crates/*/tests | grep -v bench_`
- Expected: only the LSP session's deadlines, which wait for a message, the watcher burst's 10 ms
  spacing between writes, which makes the burst the debounce must merge, and the lines inside the
  three benchmarks, which the filter does not hide (R6).

- [x] **Step 6: Commit**

```bash
git add crates/lsp/tests crates/cli/tests/performance.rs crates/core/tests/images.rs crates/core/tests/document.rs
git commit -m "test(testing-review): Rust tests without environment races or timing checks"
```

## Task 3: `ready` is a graph of cached tasks

**Files:**

- Modify: `vite.config.ts` (a `run` block), `package.json` (`ready` and `test:nvim` removed),
  `README.md` (line 236)
- Create: `packages/server/src/__tests__/toolchain.test.ts`

**Interfaces:**

- Consumes: task 1's nextest; task 2's `bench_` tests; `SOURCES` from
  `packages/server/src/binding.ts`.
- Produces: the tasks of the spec's [Data](spec.md#data) table, run with `vp run <task>`; the groups
  `ready:rust`, `ready:typescript`, `ready:browser-phone`, `ready:browser-desktop`, which task 9's
  CI jobs run; `binding:touch`, which the test tasks and `bench` depend on (R7);
  `toolchain.test.ts`'s pure checks `untracked(tasks: Record<string, Task>): Array<string>`,
  `retried(files: Record<string, string>): Array<string>`,
  `retriedTasks(tasks: Record<string, Task>): Array<string>` (R19) and
  `withDoctests(manifests: Record<string, string>): Array<string>`, each returning the messages of
  the global constraints, and its `readyTasks()`; task 9 adds
  `notInCi(tasks: Record<string, Task>, ci: string): Array<string>`.

- [x] **Step 1: Write the failing toolchain test**

Table-driven, one row per check: each check on a fixture that breaks it gives its exact message, and
on the repository's own files gives `[]`.

```ts
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
    [
      "Tests are never retried (toolchain decision): remove `retries` and fix the test that needed it.",
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
```

Two more rows: a Vitest config setting `retry`, and an uncached check next to a group (command
`true`) and a task that only touches files, of which only the check is reported. `untracked` skips
the groups and a single-string `touch` command, which read nothing (R7), and reports a task with an
`{ auto }` input. After review (R19): rows for a one-line `retry`, a task's `--retry` or
`NEXTEST_RETRIES`, an `{ auto }` input, a touch followed by a check, and a comment naming a setting;
the repository test also runs `retriedTasks` on every task. `readyTasks()` imports the root
`vite.config.ts` and returns every task `ready` depends on, transitively; `runnerConfigs()` reads
`.config/nextest.toml`, CI's workflow, the root's Vitest config and every
`packages/*/vite*.config.ts`; `libraryManifests()` reads the `Cargo.toml` of each crate with a
`src/lib.rs`, the binding included.

The break each test catches: a check that reports nothing, or the wrong text; a task added to
`ready` without inputs.

- [x] **Step 2: Run it to check it fails**

- Run:
  `nix develop -c vp test --project uraeda-server packages/server/src/__tests__/toolchain.test.ts`
- Expected: FAIL, on the repository's row: `ready` is not a task yet, so `readyTasks()` throws "no
  `ready` task in vite.config.ts".

- [x] **Step 3: Write the task graph**

In `vite.config.ts`'s `run.tasks`, every task of the spec's Data table, with its command, its
`dependsOn`, its inputs (`binding:build`'s from `SOURCES`, plus `packages/binding/package.json`),
and its outputs as the global constraints say, with the inputs R20 adds to the Data table's.
`ts:check`'s inputs are the files `vp check` formats or lints, by extension, outside `target/` and
`node_modules/`, so a Rust or Lua change does not rerun it; the group tasks and `ready` run `true`
and only depend on their tasks. The test tasks' commands start with
`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1` and their `cache.untrackedEnv` is the shared
list. `rust:test` sets `NEXTEST_PROFILE` from the environment through `cache.untrackedEnv`, so CI
picks `ci`. `ts:test` runs
`vp test --project uraeda-binding --project uraeda-server --project uraeda-web`; `browser:phone` and
`browser:desktop` run `vp test --project phone` and `vp test --project desktop`. `test:nvim`,
`bench` and `coverage` are not cached (`cache: false`); `coverage`'s command comes in task 8.
`package.json` loses `ready` and `test:nvim`. The README's line says
`vp run ready       # every check and test; CI also runs the Neovim tests`.

As built: Vite Task adds only the root's `node_modules/.bin` to `PATH` and runs a plain command
without a shell, so without expanding globs. `binding:build` runs `node_modules/.bin/napi build …`
with `cwd: "packages/binding"` (the package's `build` script, which a nested `vp run` would run
uncached), `web:theme` runs `node_modules/.bin/astryx theme build …` and `web:build` runs
`vp build`, both with `cwd: "packages/web"`; inputs and outputs stay relative to the root. The check
and test tasks declare `output: []` too; `web:build` restores `packages/web/dist/**`.
`binding:touch` (`cache: false`, `sh -c 'touch -c packages/binding/*.node'`) runs after
`binding:build`, and `ts:test`, the browser tasks and `bench` depend on it (R7). `test:nvim` runs
from `cwd: "editors/nvim"`; `bench` runs the Rust benchmarks, then `vp test bench --run`, both with
git's configuration ignored (`--project` matches no project in bench mode).

- [x] **Step 4: Run the toolchain test**

- Run:
  `nix develop -c vp test --project uraeda-server packages/server/src/__tests__/toolchain.test.ts`
- Expected: PASS.

- [x] **Step 5: Check the cache behaviour of US2, one change at a time**

- Run: `nix develop -c vp run -v ready` twice. Expected: the first run passes; the second has every
  task as a cache hit and ends in under 15 seconds (US2.1, SC-003). Record its time in the commit.
- Then for each change of US2.2 to US2.5 (a comment added to `packages/web/src/Shell.tsx`,
  `crates/cli/src/status.rs`, `skills/uraeda/references/plan.md`, a checkbox in this plan), run
  `vp run -v ready`, compare the summary's hits and misses with the scenario, and revert the change.
  Expected: exactly the scenario's tasks miss, and for the checkbox `ts:check` too, since `vp check`
  formats Markdown (R4).
- US2.6: the summary shows `binding:build` ending before `ts:test`, `browser:phone` and
  `browser:desktop` start, and Rust tasks overlapping TypeScript ones.
- Review focus 3: `rm packages/binding/*.node`, then `vp run ready`. Expected: `binding:build` is a
  hit that restores the file, and the web projects start without `checkBinding`'s error. If the
  restored file's time trips the check, `binding:build` lists no outputs and runs whenever its
  sources change instead, with a ruling. As run: the restore keeps the build's time, which a source
  saved since with the same content is newer than, so `binding:touch` marks the binding as built now
  (R7); then the web and desktop projects start without the error.
- Edge, exported `GIT_DIR`: `vp cache clean`, then `GIT_DIR=/nonexistent vp run ready`, so the tasks
  run cached and miss. Expected: PASS. `--no-cache` passes the whole environment, `GIT_DIR` included
  (R8).
- Edge, a missing input: remove `fixtures/**` from `ts:test`'s inputs, edit a fixture, and run
  `vp run -v ready`. Expected: `ts:test` is a hit (the stale result the edge case names), and
  `vp run --no-cache ts:test` runs it. Put the input back.
- Edge, a fresh start: `vp cache clean`, then `vp run -v ready`. Expected: every task misses, and
  the run passes.

- [x] **Step 6: Commit**

```bash
git add vite.config.ts package.json README.md packages/server/src/__tests__/toolchain.test.ts
git commit -m "build(testing-review): ready is a graph of cached tasks"
```

## Task 4: TypeScript tests without timing checks or leaks

**Files:**

- Modify: `packages/server/src/__tests__/live.test.ts`,
  `packages/server/src/__tests__/repositories.test.ts`, `packages/server/src/__tests__/dev.test.ts`
  (the saved variables), `packages/server/src/__tests__/env.test.ts`,
  `packages/server/src/__tests__/search.bench.ts` (its measure printed),
  `packages/server/src/env.ts` and `packages/server/src/dev.ts` (`Sources`),
  `packages/server/vite.config.ts` (`testTimeout`), `packages/web/vite.config.ts` (no `.env` under
  Vitest), `packages/server/src/runner/__tests__/cache.test.ts` and
  `packages/web/src/__tests__/repository-menu.test.tsx` (the expected errors captured),
  `packages/server/src/runner/__tests__/claude.test.ts` (its polls),
  `packages/web/src/__tests__/home.test.tsx` (the "Failed to fetch" at line 94),
  `packages/web/src/__tests__/document.test.tsx` and `links.test.ts`,
  `packages/web/src/__tests__/helpers.tsx` (the teardown's order, `quiet`, behind the unhandled
  server error of run 38515969774), `packages/web/src/__tests__/session.test.tsx` (`openTurn`,
  `thumbnails`), `crates/core/tests/git.rs` and `Cargo.toml` (gix's `parallel` feature),
  `crates/lsp/tests/commands.rs` (the hook's end), `vite.config.ts` (`isolatedGit`)
- Create: `packages/server/src/__tests__/live.bench.ts`,
  `packages/server/src/__tests__/live-stream.ts` (the live stream helpers and the two scenarios,
  shared by the test and the benchmark)

**Interfaces:**

- Consumes: task 3's `ts:test` and `bench` tasks.
- Produces: `loadEnv(root, environment, sources)`, `loadDataDir(root, environment, sources)` and
  `devHandler(root, { adapter, file })`, `sources` being `{ file?: boolean }`; the web tests'
  `quiet()`, which waits until the server answered every request the page sent, and the page drew
  the answers.

- [x] **Step 1: Turn the duration checks into benchmarks, and the sleeps into waits**

- `live.test.ts`: the commit's update (line 140) and SC-002's status change (line 452) keep their
  arrival checks, without durations; `live.bench.ts` measures both, and prints them. Both run the
  scenarios of `live-stream.ts`. The `SESSION_UPDATE_MS` sleep (407) becomes a jump of a running
  fake clock (R9); the 500 ms negative wait (465) switches the first repository's branch afterwards
  as a sentinel, waits for it, then asserts the first repository heard only the switch.
- `repositories.test.ts`: the duration check (491) goes, keeping its arrival check; the 300 ms sleep
  (557) waits for other hosts, open on the same list, to follow two changes (R9); the `HOME` stub
  (317-320) is restored in a `finally`. The waits' 1 s timeouts become 10 s.

The break each catches: an update never sent (arrival), an update sent to the wrong repository (the
sentinel), closed hosts still following the list.

- [x] **Step 2: Stop the web configs from reading `.env` under Vitest, and give the server tests the
      web tests' 20 s timeout**

Under Vitest (`process.env.VITEST`), `packages/web/vite.config.ts` gives `devServer` and
`uraedaServer` settings read from the environment only, through `loadEnv`'s and `devHandler`'s
`{ file: false }` (R10); `vp dev` and the build still read `.env`. `env.test.ts` checks that the
file is left out. `dev.test.ts`'s saving of `URAEDA_REPO` and `URAEDA_DATA_DIR` goes: the browser
setup now runs in its own process (task 3); the variables the tests set are `vi.stubEnv`'s, undone
after each.

- [x] **Step 3: Capture the expected errors, and fix the unexpected ones**

The runner cache tests that make it fail on purpose, and `repository-menu.test.tsx`'s unreadable
list, assert their message on a spy of `process.stderr.write` instead of printing it;
`home.test.tsx:94`'s "Failed to fetch" is React reporting the error its boundary caught, which the
test now asserts on a spy of `console.error`; the "suspended inside an `act` scope" warnings of
`home.test.tsx` and `document.test.tsx` go with an awaited `click`. `editor.test.tsx`'s unhandled
`FateRequestError` came from the teardown's order: Vitest runs `afterEach` hooks last registered
first, so the web helpers closed the hosts and the sessions before the page was unmounted, and the
requests the page still sent, or sent as it left, failed with no page to show it. One hook now
unmounts the page, waits for the server to answer every request (`quiet`'s wait), then closes the
hosts and the sessions (R12). `links.test.ts`'s 50 ms wait becomes `quiet()`, and `claude.test.ts`'s
polls `vi.waitFor` (R14).

- [x] **Step 4: Fix the session tests that fail under load (A, R11)**

`session.test.tsx`'s `Unable to find role="button" and name "Send"`, reproduced with 10 runs of the
file at once (3 failed): the composer was empty, the page drawn, Stop shown. A feature's session
view replaces its empty view, and its composer, once the first message's send answers; `openTurn`
went on once the agent got the message, so `send` could type into the composer being replaced, whose
input reached nothing, and no Send showed for an empty composer. `openTurn` now waits for the
message in the session's own transcript. `thumbnails` returns the buttons its wait saw: the page
that hides its content while it suspends (a hand-over's redirect) made the query after the wait find
none.

- [x] **Step 5: A status read of a deleted repository does not panic (B, R12)**

`crates/core/tests/git.rs`: a worktree on a branch with no commit, its repository's `.git/objects`
deleted, then `changed_files`, `staged_files` and `has_local_changes`. Without gix's `parallel`
feature, its status opens the object store again from disk, and panics on the missing folder
(`gix-0.89.0/src/status/index_worktree.rs:125`), which aborts the Node process holding the binding.
With it, the store already open is shared: the reads list nothing. The web tests' teardown (step 3)
no longer leaves reads going while the file's temporary folder is deleted.

- [x] **Step 6: The test tasks drop the git variables a hook exports (C, R13)**

`vite.config.ts`'s `isolatedGit` starts with
`env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR`, for every test task.

- Run: `GIT_DIR=/nonexistent nix develop -c vp run --no-cache ready:rust`
- Expected: PASS.

- [x] **Step 7: Run every TypeScript unit test with the scenario of US1.3, and the benchmarks**

- Run:
  `printf 'URAEDA_DATA_DIR=/tmp/elsewhere\nURAEDA_PORT=9999\n' > .env && nix develop -c vp run --no-cache ts:test; rm .env`
- Expected: PASS, no error printed by a test, and `/tmp/elsewhere` not created.
- Run: `nix develop -c vp run bench`
- Expected: the Rust benchmarks pass, and `live.bench.ts` and `search.bench.ts` print their
  measures.
- Run:
  `grep -rnE 'setTimeout\(resolve|performance\.now\(\)' packages/server/src packages/web/src --include=*.test.ts --include=*.test.tsx`
- Expected: none outside the browser tests, which task 5 fixes, but `editor.test.tsx`'s wait for the
  next task, of no duration (R14).

- [x] **Step 8: Commit**

```bash
git add Cargo.toml Cargo.lock crates/core/tests/git.rs
git commit -m "fix(testing-review): a status read of a deleted repository does not panic"
git add packages/server packages/web/vite.config.ts packages/web/src/__tests__ crates/lsp/tests/commands.rs vite.config.ts specs/2026-10-14-testing-review
git commit -m "test(testing-review): TypeScript tests without timing checks, leaked settings, or stray errors"
```

## Task 5: Browser tests at their size, on a copied repository

**Files:**

- Modify: `packages/web/src/__browser__/helpers.tsx` (the size helper),
  `packages/web/vite.browser.config.ts` (`takeRepo`), `packages/web/src/__browser__/setup.ts` (the
  template), every `packages/web/src/__browser__/*.test.tsx` with a `window.innerWidth` early
  return, `packages/web/src/__browser__/attach.test.tsx` (lines 280, 295, 346),
  `packages/web/src/__browser__/round.test.tsx`

**Interfaces:**

- Produces: `atSize(size: "phone" | "desktop" | "both"): void`, exported by
  `__browser__/helpers.tsx`, called at the top of a file or `describe` block: at another size, every
  test of that scope is skipped, and no hook of the file runs for it. Task 6 applies it.

- [x] **Step 1: Write the size helper's tests**

In a new `__browser__/sizes-helper.test.tsx`: a `describe` with `atSize("phone")` whose single test
asserts `window.innerWidth < 768`, and one with `atSize("desktop")` asserting `>= 768`; a counter in
`beforeEach` asserts, in an `afterAll`, that it ran only for the tests of this size. As built, a
third block with `atSize("both")` runs at each size, so the `afterAll` expects 2 hooks for 2 tests.

The break each catches: a helper that skips inside the test body (the counter counts it), or skips
at the wrong size (the width assertion).

- [x] **Step 2: Run them to check they fail**

- Run, from the root (R18):
  `nix develop -c vp test --project phone packages/web/src/__browser__/sizes-helper.test.tsx`
- Expected: FAIL, `atSize` is not exported by `./helpers.tsx`.

- [x] **Step 3: Implement `atSize`, copy the template repository in `takeRepo`, and replace every
      `window.innerWidth` early return with `atSize` on its test's scope**

`atSize` decides from the instance's viewport at collection time. As built (R15), it reads the
configured viewport (`server.config.browser.viewport`) and, at the other size, sets `skip` in its
block's options (`TestRunner.getCurrentSuite()`), which the tests declared after it inherit, as
`describe.skip` does: Vitest's `skipIf` cannot apply to a whole scope from a call inside it. The
global setup builds the fixture repository once, as the template, in `URAEDA_TEMPLATE_REPO`;
`takeRepo` copies it into a new temporary folder instead of calling `fixtureRepo()`. The early
returns become `atSize` in a `describe` around their tests, or at the top of a file whose tests are
all of one size (`round.test.tsx`, `task.test.tsx`).

- [x] **Step 4: Remove the timing checks of `attach.test.tsx`, and fix the scroll flake of
      `round.test.tsx`**

- Line 280's duration goes, keeping the link's arrival; lines 295 and 346 wait for what the sleep
  stood for: no save request sent once the debounce has passed, observed through the held upload or
  the save request count, not a clock.
- The offset polls that saw 326.7 instead of under 3: reproduce under `--project desktop` with the
  CPU loaded (`stress` or a parallel `vp run ready:rust`), find why the scroll does not land (a jump
  issued before the page settled, an animation cancelled), and fix the test's wait or the product,
  with a test when it is the product.
- As built: line 295 types under a fake clock and counts the save requests; line 346 pastes an image
  alone after it, as a sentinel, and counts the uploads (R17). The round's offsets were no flake:
  both CI failures were the test of a commit before 4b8de71, which expected the round to open at Q1
  after a1a0286 opened it on its intro, and that test fails with the same values on today's code;
  the current test passed 20 runs under load (R16), so its waits stay.

- [x] **Step 5: Run both sizes at once, as `ready` does (review focus 2)**

- Run, as two processes at once (R18): `nix develop -c vp run binding:touch`, then
  `nix develop -c vp run --no-cache --ignore-depends-on browser:phone` and
  `nix develop -c vp run --no-cache --ignore-depends-on browser:desktop` in parallel.
- Expected: PASS at both sizes, run at the same time, each on its own port.
- Run:
  `grep -rnE 'setTimeout\(resolve|performance\.now\(\)' packages/web/src/__browser__/ packages/web/vite.browser.config.ts`
  and, for the early returns,
  `grep -rlPz 'innerWidth\s*[<>]=?\s*\d+\)\s*\{\s*return;' packages/web/src/__browser__/*.test.tsx`
- Expected: none, except the `mouse` command's waits, which are part of a drag's gesture. The tests
  at both sizes that branch on `innerWidth` stay.

- [ ] **Step 6: Commit**

```bash
git add packages/web/vite.browser.config.ts packages/web/src/__browser__
git commit -m "test(testing-review): browser tests run at their size, on a copied repository"
```

## Task 6: The UI tests' audit

**Files:**

- Modify: every `packages/web/src/__browser__/*.test.tsx` (sizes, removals),
  `packages/web/src/__tests__/shell.test.tsx` (a test's name),
  `specs/2026-10-14-testing-review/rulings.md` (a ruling per removed test)

**Interfaces:**

- Consumes: task 5's `atSize`.

The audit's outcome, read for this plan from every UI test file against the specs in `specs/done/`
and the UI decisions. Line numbers are as of the plan's commit; the test names are the reference.

| Browser file            | Tests | Removed | phone / desktop / both | Why                                                                       |
| ----------------------- | ----- | ------- | ---------------------- | ------------------------------------------------------------------------- |
| `attach.test.tsx`       | 28    | 6       | 21 / 0 / 1             | Editor drops, pastes and cursor tracking exist only here; 6 repeat others |
| `layout.test.tsx`       | 48    | 0       | 1 / 3 / 44             | The UI checks decision's layout and axe checks, at both sizes             |
| `overlay.test.tsx`      | 3     | 0       | 2 / 0 / 1              | Sheet against dialog geometry; real history for Back                      |
| `priorities.test.tsx`   | 7     | 0       | 3 / 4 / 0              | Real mouse, touch and keyboard drags; real toast transitions              |
| `repositories.test.tsx` | 6     | 0       | 0 / 0 / 6              | Popover against sheet, with layout checks in both themes                  |
| `review.test.tsx`       | 8     | 0       | 8 / 0 / 0              | The phone's sheet geometry; folds across Back and hash links              |
| `round.test.tsx`        | 3     | 0       | 0 / 3 / 0              | Real scroll, focus and width of the desktop's index                       |
| `scroll.test.tsx`       | 2     | 0       | 2 / 0 / 0              | Real scroll position across Back and reload                               |
| `session.test.tsx`      | 3     | 0       | 0 / 0 / 3              | The pane's and the window's scrollers differ by layout                    |
| `sizes.test.tsx`        | 1     | 0       | 0 / 1 / 0              | The desktop's 19 px text and larger controls                              |
| `task.test.tsx`         | 2     | 0       | 0 / 2 / 0              | The task view beside home                                                 |

Every happy-dom file (`__tests__/`, 301 tests) is kept: each test guards a spec's scenario or a
decision's rule, and none repeats another. Four tests of `session.test.tsx` guard behaviour shipped
without a spec ("a message shows when it was sent", "a message's time has its date unless it was
sent today", "a running turn ends with what the agent does now, gone once it ends", "an activity's
time reads in seconds, then minutes"): they are kept, and the pull request names them for the human
to rule on.

The browser tests removed, all in `attach.test.tsx`:

1. "US2.1: two images pasted in the composer are thumbnails, sent with the message": happy-dom's
   `session.test.tsx` "US2.1: two pasted images show as removable thumbnails" and "US2.2: a message
   with images shows them above its text" cover it through the same server; the paste is a synthetic
   event either way.
2. "a file dropped anywhere on a session's page joins the message": happy-dom's `session.test.tsx`
   "an image dropped anywhere on the session page joins the message".
3. "a verdict waits for a comment holding an image to be added or cancelled": happy-dom's
   `review.test.tsx` "at %i px, the verdict's refusal is in the comment form", at 402 and 1440 px.
4. 'US1.3: "Add image" picks a file': happy-dom's `editor.test.tsx` "a draft that gets an image
   opens at its folder's proposal"; `userEvent.upload` opens no real picker either.
5. "a file dragged over the editor shows it is taken": `layout.test.tsx` "the editor with an image's
   link, a refusal, and the drop hint", at both sizes, and "a drop outside every field stays in the
   app".
6. "SC-002: a 1440×900 screenshot is linked within a second of its drop": its only assertion beyond
   US1.1's is the duration, which leaves the tests (US1.5); the browser has no benchmark runner, so
   SC-002 is measured nowhere, which its ruling records.

The single-size browser tests, by the size their scenario is about:

- **desktop**: `layout.test.tsx`'s three width changes (a comment keeps its text and focus when the
  window narrows; the task view keeps its address across 768 px; the folded navigation keeps ＋,
  Home and the repository menu); `priorities.test.tsx`'s mouse drag, Space ↓ ↓ Space, Escape
  cancelling a drag, and a live update during a drag; `round.test.tsx`'s three; `sizes.test.tsx`;
  `task.test.tsx`'s two.
- **phone**: `attach.test.tsx`'s 21 kept tests except "a chat whose last message has images opens at
  its end" (both); `layout.test.tsx`'s "the test server runs the fake agent"; `overlay.test.tsx`'s
  two history races; `priorities.test.tsx`'s touch press and the two toast closings;
  `review.test.tsx`'s eight; `scroll.test.tsx`'s two.
- **both**: every other test.

After the audit, the phone runs 92 tests and the desktop 68, against 111 each today.

- [ ] **Step 1: Remove the six tests, each with its ruling**

Each ruling, from R6 on, names what the test checked, the covering test, and why that is enough, as
above; R5 already covers the SC-002 test.

- [ ] **Step 2: Put every kept browser test under `atSize` at its size, and rename
      `shell.test.tsx`'s "no ＋ on a round or a review (US6 6)", which renders only a round, to
      "no ＋ on a round (US6 6)"**

- [ ] **Step 3: Run both sizes, and count**

- Run: `nix develop -c vp run --no-cache ready:browser-phone ready:browser-desktop`
- Expected: PASS; the phone runs 92 tests and skips 13, the desktop runs 68 and skips 37 (US4.1 to
  US4.3).
- Run: `nix develop -c vp run --no-cache ts:test`
- Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src specs/2026-10-14-testing-review/rulings.md
git commit -m "test(testing-review): browser tests trimmed to the scenarios only they guard"
```

## Task 7: The Neovim tests leave `ready`, isolated from the host's git

**Files:**

- Modify: `editors/nvim/tests/minimal_init.lua`, `editors/nvim/tests/test_actions.lua` (lines 5, 7),
  `editors/nvim/tests/test_verdict.lua` (line 6), `editors/nvim/README.md` (line 77)

**Interfaces:**

- Consumes: task 3's `test:nvim` task, out of `ready`.

- [ ] **Step 1: Ignore the host's git configuration in every Neovim the tests start**

`minimal_init.lua` (R2), which the runner and every child load, sets `GIT_CONFIG_GLOBAL=/dev/null`
and `GIT_CONFIG_NOSYSTEM=1`, and clears `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and
`GIT_COMMON_DIR`, so `helpers.git`, the child's `ura lsp` and its git all inherit it, however the
tests are started. `test_actions.lua`'s and `test_verdict.lua`'s dates are set in their files'
`pre_case` and restored in `post_case`, so each file's dates apply to its own cases only.

- [ ] **Step 2: Run them with a hostile git configuration (US5.3)**

- Run:
  `HOME=$(mktemp -d) && git config --file "$HOME/.gitconfig" commit.gpgSign true && git config --file "$HOME/.gitconfig" init.defaultBranch master && nix develop -c vp run test:nvim`
- Expected: `Fails (0)`, 81 cases.
- Run: `nix develop -c vp run -v ready`
- Expected: no Neovim test runs (US5.1); `lua:fmt` runs.

- [ ] **Step 3: Commit**

```bash
git add editors/nvim
git commit -m "test(testing-review): the Neovim tests ignore the host's git, and run on CI only"
```

## Task 8: `vp run coverage`

**Files:**

- Modify: `vite.config.ts` (the `coverage` task; `test.coverage`), `.config/nextest.toml` (profile
  `coverage`), `pnpm-workspace.yaml` and `package.json` (`@vitest/coverage-v8` at `5.0.1`, the
  bundled Vitest's version), `.gitignore` (`coverage/`)
- Create: `scripts/coverage-summary.ts`

**Interfaces:**

- Produces: `vp run coverage` writing `coverage/rust.lcov`, `coverage/rust/html/`,
  `coverage/typescript/lcov.info` and `coverage/typescript/index.html`, then printing the summary;
  task 9's `coverage` job runs it.

- [ ] **Step 1: Add the provider, the Vitest coverage settings, and the `coverage` profile**

`test.coverage`: provider `v8`, reporters `lcov`, `html` and `text-summary`, `reportsDirectory`
`coverage/typescript`, `include` the four packages' `src/**` and the binding's `*.ts`; no
`thresholds`. The nextest profile `coverage` leaves out
`test(an_iccp_bomb_is_read_in_bounded_memory)`.

- [ ] **Step 2: Write the `coverage` task and its summary**

The command runs
`cargo llvm-cov nextest --profile coverage --lcov --output-path coverage/rust.lcov`, then
`cargo llvm-cov report --html --output-dir coverage/rust`, then
`vp test --project uraeda-binding --project uraeda-server --project uraeda-web --coverage`, then
`node scripts/coverage-summary.ts`, which prints, from the two lcov files, `Rust: <n>% of lines` and
`TypeScript: <n>% of lines`, and under the Rust line "The `ura` binary run by the CLI tests is not
counted." when no line of `crates/cli/src/main.rs` is covered.

- [ ] **Step 3: Run it (US6.1, US6.3)**

- Run: `nix develop -c vp run coverage`
- Expected: the four outputs exist, and the summary prints both percentages; whether the spawned
  `ura` is counted is recorded in the commit body.
- Run: `nix develop -c vp run ready`
- Expected: PASS; no task depends on coverage.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts .config/nextest.toml pnpm-workspace.yaml package.json pnpm-lock.yaml .gitignore scripts/coverage-summary.ts
git commit -m "build(testing-review): vp run coverage reports the Rust and TypeScript coverage"
```

## Task 9: CI runs the groups in parallel jobs

**Files:**

- Create: `.github/actions/setup/action.yml`
- Modify: `.github/workflows/ci.yml`, `packages/server/src/__tests__/toolchain.test.ts` (`notInCi`)

**Interfaces:**

- Consumes: task 3's groups and `readyTasks()`; task 7's `test:nvim`; task 8's `coverage`.

- [ ] **Step 1: Add the failing CI rows to the toolchain test (US3.3)**

```ts
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
  expect(notInCi(readyGroups(), readFileSync(".github/workflows/ci.yml", "utf8"))).toEqual([]);
});
```

`readyGroups()` returns the tasks `ready` depends on directly.

- [ ] **Step 2: Run it to check it fails**

- Run:
  `nix develop -c vp test --project uraeda-server packages/server/src/__tests__/toolchain.test.ts`
- Expected: FAIL on the repository's row: today's `ci.yml` runs `vp run ready`, not the groups, so
  four messages are listed.

- [ ] **Step 3: Write the setup action and the jobs**

The setup action: `cachix/install-nix-action@v31`, `Swatinem/rust-cache@v2` with `shared-key: ci`
and `save-if: ${{ github.ref == 'refs/heads/main' }}`, and the existing
`nix develop --command pnpm install --frozen-lockfile --ignore-scripts`, with its comment. The jobs
of the global constraints, each: checkout, the setup action,
`nix develop --command vp run --no-cache <group>` (`NEXTEST_PROFILE: ci` in the `rust` job), and the
clean tree check printing `git status --porcelain`. `neovim` runs `vp run test:nvim`; `release` runs
the existing `dist plan` and release size steps; `coverage` runs `vp run coverage` on pushes to
`main` only and uploads `coverage/` with `actions/upload-artifact@v4`, `name: coverage`,
`retention-days: 30`. `timeout-minutes: 20` on each job; at the top,
`concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: ${{ github.ref != 'refs/heads/main' }} }`
(R3); and `workflow_dispatch:` in `on`, so task 10 can run CI on the branch before its pull request.

- [ ] **Step 4: Run the toolchain test, then `ready`**

- Run:
  `nix develop -c vp test --project uraeda-server packages/server/src/__tests__/toolchain.test.ts`
- Expected: PASS.
- Run: `nix develop -c vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github packages/server/src/__tests__/toolchain.test.ts
git commit -m "ci(testing-review): CI runs ready's groups in parallel jobs"
```

## Task 10: CI's time and stability, measured

**Files:**

- Modify: `specs/2026-10-14-testing-review/rulings.md` (the measures, when one misses its target)

**Interfaces:**

- Consumes: everything above.

- [ ] **Step 1: Run CI on the branch**

- Run:
  `git push -u origin 2026-10-14-testing-review && gh workflow run ci.yml --ref 2026-10-14-testing-review`
- Expected: the jobs `rust`, `typescript`, `browser-phone`, `browser-desktop`, `neovim` and
  `release` start at once and pass (US3.1, US5.2), with no `coverage` job (not a push to `main`).

- [ ] **Step 2: Measure SC-001 and SC-004**

- Run: `gh run view <id> --json jobs` and the browser jobs' logs.
- Expected: from the first job's start to the last job's end under 8 minutes; each browser job's
  summed file time at most 180 seconds. A miss is a ruling with the measure, the cause, and what
  would close it.

- [ ] **Step 3: Rerun it 10 times (SC-002, US1.1)**

- Run: `gh run rerun <id>` after each run ends, 10 times.
- Expected: 10 passes. A failure is investigated to its cause, fixed in this branch with a test, and
  the count starts again.

- [ ] **Step 4: Check the cancellation and the clean tree check (US3.2, US3.4)**

- Run: two `gh workflow run` on the branch in a row. Expected: the first run is cancelled once the
  second starts.
- Run: on a scratch branch `scratch/testing-review-stale-binding` from this one, a commit that edits
  `packages/binding/index.d.ts` by hand, pushed, then `gh workflow run ci.yml --ref` that branch;
  then delete the scratch branch, locally and on `origin`. Expected: its `typescript` job fails,
  printing ` M packages/binding/index.d.ts`.

US6.2, the `coverage` job's artifact, can only run on a push to `main`: the pull request's
description says it is checked on the first push after the merge.

- [ ] **Step 5: Commit**

```bash
git add specs/2026-10-14-testing-review/rulings.md
git commit -m "docs(testing-review): CI's time and stability, measured"
```
