---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Testing review

> [!NOTE]
>
> Approved on 2026-10-14.
>
> - One changed decision,
>   [toolchain](../decisions/toolchain.md#proposed-change-2026-10-14-testing-review): `ready`
>   becomes cached tasks run in parallel; CI runs them uncached in parallel jobs; cargo-nextest runs
>   the Rust tests; no test is retried; coverage is a report; the Neovim tests run on CI only.
> - Your Lua answer, read one way: the Neovim tests leave `ready` but still run on CI, in their own
>   parallel job, where they cost no waiting. Say so if you meant not running them on CI either.
> - Your question on the UI tests is answered in [the UI tests](#the-ui-tests): they found 8 real
>   races already, and they are the only checks of the web UI's scenarios, so this spec trims them
>   (one size for behaviour, a cheaper repository, an audit that removes what guards nothing) rather
>   than dropping them.
> - The audit deletes tests: each deletion is a ruling, and the plan lists every file's outcome.
>   Turn plan review on if you want to see that list before anything is deleted.
> - The time targets are estimates from CI's logs: under 8 minutes for CI (up to 15 today), and half
>   the browser time.
> - Risk tier `medium`: it changes CI, the toolchain, and many tests, but no data or interface.
> - cargo-mutants is in the priorities' Later section, as you asked.

The testing review makes the checks fast, parallel, and trustworthy, for the agents who run them
after every task and for anyone reading CI. `vp run ready` skips the checks a change cannot affect
and runs the others in parallel, CI splits them across parallel jobs, every test that failed without
a bug is fixed, and coverage is reported. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: A red CI means a bug (P1)

Every test gives the same result on every run, on a developer's machine and on CI: a test that
failed without a bug is fixed or rewritten, wall-clock checks become benchmarks run on demand, and
no runner retries a failed test.

Why this priority: the proposal calls it critical. With 43 of the last 100 CI runs failing, a red CI
says nothing today.

Acceptance scenarios:

1. **Given** the feature's last commit, **When** its CI run is rerun 10 times, **Then** every run
   passes.
2. **Given** a developer whose global git configuration sets `commit.gpgSign = true`,
   `init.defaultBranch = master`, and a `core.hooksPath`, **When** they run `vp run ready`, **Then**
   every test passes, and no test signs a commit or runs their hooks.
3. **Given** a repository `.env` holding `URAEDA_DATA_DIR=/tmp/elsewhere` and `URAEDA_PORT=9999`,
   **When** `vp run ready` runs, **Then** every test passes, and nothing is written to
   `/tmp/elsewhere`.
4. **Given** a Rust test whose LSP server never answers, **When** the Rust tests run, **Then**
   cargo-nextest stops that test after 2 minutes, reports it by name as timed out, and the other
   tests still run.
5. **Given** a test that asserts how long something took, such as LSP diagnostics within 300 ms,
   **When** `vp run ready` runs, **Then** it does not run; **When** `vp run bench` runs, **Then** it
   runs and reports its measure.
6. **Given** a test that fails once, **When** the tests run, **Then** the run fails at once: nothing
   reruns it.

### US2: `ready` only reruns what a change can affect (P1)

An agent finishing a task runs `vp run ready` as today, and only the checks whose inputs changed run
again, in parallel when they are independent; the others replay their last result.

Why this priority: it is the hour lost per feature, and the skill asks for `ready` after every task.

Acceptance scenarios:

1. **Given** `vp run ready` passed, **When** it runs again with no change, **Then** every check is a
   cache hit, and the run ends in under 15 seconds.
2. **Given** `vp run ready` passed, **When** only `packages/web/src/Shell.tsx` changes, **Then** the
   TypeScript format, lint, unit tests, browser tests and web build run again, and every Rust check,
   the binding build and `ura check` are cache hits.
3. **Given** `vp run ready` passed, **When** only `crates/cli/src/status.rs` changes, **Then** the
   Rust format, clippy and tests and `ura check` run again, and the binding build and every
   TypeScript check are cache hits, since the binding is not built from the CLI.
4. **Given** `vp run ready` passed, **When** only `skills/uraeda/references/plan.md` changes,
   **Then** the binding is rebuilt, and the Rust, TypeScript and browser tests run again, since the
   skill is compiled into the core.
5. **Given** `vp run ready` passed, **When** only a checkbox in a feature's `specs/.../plan.md`
   changes, **Then** only `ura check specs` runs again.
6. **Given** the Rust and TypeScript checks both need to run, **When** `vp run ready` runs, **Then**
   they run at the same time, and the binding build finishes before any TypeScript test starts.

### US3: CI runs the checks in parallel jobs (P1)

A pull request's CI runs the checks of `ready` split across parallel jobs, each in the dev shell,
without Vite Task's cache, plus the CI-only checks.

Why this priority: CI takes up to 15 minutes on one runner today.

Acceptance scenarios:

1. **Given** a pull request, **When** CI runs, **Then** these jobs start at once: Rust, TypeScript,
   browser at the phone size, browser at the desktop size, Neovim, and release.
2. **Given** a commit on a pull request whose CI is still running, **When** a newer commit is
   pushed, **Then** the older run is cancelled.
3. **Given** a change that adds a task to `ready` and no CI job running it, **When** `vp run ready`
   runs, **Then** the toolchain test fails with: "`ready` runs `<task>`, but no CI job does: add it
   to a job in `.github/workflows/ci.yml`."
4. **Given** a job whose checks rewrite a generated file, such as `packages/binding/index.d.ts`,
   **When** the job ends, **Then** it fails and prints the changed files.

### US4: The browser tests pull their weight (P2)

The WebKit tests keep the layout and accessibility checks at both sizes, run each behaviour test at
the size its scenario is about, build their repository faster, and lose the tests that guard nothing
a spec or a decision asks for.

Why this priority: they are CI's critical path, and you asked whether they are useful.

Acceptance scenarios:

1. **Given** a page a UI decision governs, **When** the browser tests run, **Then** its layout and
   accessibility checks run at 402 × 874 and at 1440 × 900.
2. **Given** a behaviour test declared at the phone size, such as a comment sheet sliding in,
   **When** the desktop instance runs, **Then** it is reported as skipped, not run.
3. **Given** a behaviour test declared at both sizes, because the two layouts behave differently,
   **When** the browser tests run, **Then** it runs at each size.
4. **Given** a UI test that guards no scenario of a spec and no rule of a UI decision, or one whose
   scenario is already guarded by a happy-dom test at the same depth, **When** the audit reaches it,
   **Then** it is removed, with a ruling naming what it checked and why that is covered or not asked
   for.

### US5: The Neovim tests run on CI only (P2)

The Neovim plugin's tests leave `ready`, run in their own CI job, and stay runnable with
`vp run test:nvim`.

Why this priority: you called the plugin "extremely secondary and rarely touched".

Acceptance scenarios:

1. **Given** any change, **When** `vp run ready` runs, **Then** no Neovim test runs.
2. **Given** a pull request, **When** CI runs, **Then** the Neovim job builds `ura` and runs every
   Neovim test.
3. **Given** a developer whose global git configuration sets `commit.gpgSign = true`, **When** they
   run `vp run test:nvim`, **Then** every case passes, and no commit is signed.

### US6: Coverage is reported (P3)

`vp run coverage` writes a coverage report of the Rust tests and the TypeScript unit tests, and CI
keeps the report of every push to `main`.

Why this priority: it measures; it changes no check.

Acceptance scenarios:

1. **Given** the repository, **When** `vp run coverage` runs, **Then** it writes
   `coverage/rust.lcov`, `coverage/typescript/lcov.info` and an HTML report for each, and prints a
   summary of lines covered per language.
2. **Given** a push to `main`, **When** CI runs, **Then** a coverage job uploads the `coverage/`
   folder as the `coverage` artifact, kept 30 days.
3. **Given** a change that lowers coverage, **When** `vp run ready` and CI run, **Then** nothing
   fails because of it.

## Edge cases

- **An input missing from a task's list**: `ready` replays a stale result locally; CI, which never
  uses the cache, still runs the check and fails if it breaks. The toolchain test checks that every
  task lists its inputs, not that the list is complete.
- **A fresh clone, or `vp cache clean`**: every check runs, as today.
- **A cache hit for the binding build** restores `packages/binding/*.node`, `index.js` and
  `index.d.ts` from the cache, so a deleted `.node` file is put back, not reported missing.
- **Rust checks running at once** wait on cargo's lock of `target/`: parallel in the graph, one
  after the other where cargo needs the build folder.
- **`ready` run outside the dev shell** fails at the first tool missing, as today; the tasks pass on
  the dev shell's `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`,
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`, `FONTCONFIG_FILE`, `__EGL_VENDOR_LIBRARY_DIRS` and
  `MINI_TEST`, which Vite Task would otherwise drop.
- **`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` or `GIT_COMMON_DIR` exported by a calling hook** do
  not reach the tests: Vite Task does not pass them to tasks.
- **A test that fails only under coverage instrumentation**, like the iCCP bomb's 40 MiB memory
  bound, is left out of the coverage run by name, in the coverage profile, and still runs in
  `ready`.
- **The `ura` binary spawned by the CLI tests** may not be counted in the Rust coverage; the report
  then says so in its summary, rather than the tests changing to run in process.
- **A flaky test found after this feature**, on any branch, fails that branch's CI, and is fixed in
  that pull request, as the toolchain decision now says.
- **A test reading a new folder**, such as a new fixture folder, needs that folder added to its
  task's inputs, in the same commit.
- **The session view branch merges first or later**: its `session.test.tsx` waits are rewritten
  there; this feature only fixes what still fails once both are on `main`.
- **Root user**: the install test that passes without testing as root stays; CI does not run as
  root.

## Success criteria

- **SC-001**: A pull request's CI run, from its first job's start to its last job's end, takes under
  8 minutes, measured on the feature's last commit.
- **SC-002**: The feature's last commit passes CI 10 times in a row.
- **SC-003**: `vp run ready` with no change since its last pass ends in under 15 seconds on the
  human's machine.
- **SC-004**: The browser tests' summed file time per size, on CI, is at most 180 seconds, half of
  today's 364.
- **SC-005**: No Rust or TypeScript test outside a benchmark sleeps for a fixed time or asserts a
  duration.

## Architecture

The work splits into four parts, each with one home.

**The task graph** lives in [`vite.config.ts`](/vite.config.ts)'s `run.tasks`: each check of `ready`
becomes a cached Vite Task task with its inputs listed, and `ready` becomes a task that only depends
on them ([skipping unchanged work](discovery-01.md#skipping-unchanged-work),
[Q4](clarifications-01.md#q4-how-does-a-task-skip-the-work-its-change-cannot-affect)). The map of
what a change can break, which existed nowhere, lives in these inputs. The binding's sources keep
their single list in [`packages/server/src/binding.ts`](/packages/server/src/binding.ts), already
exported as `SOURCES`, which the binding task's inputs import. Tasks group into the CI jobs' units,
so CI runs the same tasks: `ready:rust`, `ready:typescript`, `ready:browser-phone` and
`ready:browser-desktop`.

**CI** in [`ci.yml`](/.github/workflows/ci.yml) runs one job per group, plus `test:nvim` and the
release checks, each in the dev shell through a shared setup action, with `--no-cache`
([CI layout](discovery-01.md#ci-layout),
[Q5](clarifications-01.md#q5-how-should-ci-run-the-checks)). A test of the toolchain's configuration
keeps `ready` and CI in step, and checks the rules a tool can read: inputs listed, no retries, no
doctests.

**The runners**: cargo-nextest with a profile that times out hung tests
([the Rust runner](discovery-01.md#the-rust-runner),
[Q6](clarifications-01.md#q6-should-rust-tests-run-with-cargo-nextest)); Vitest as today, with the
browser project's two sizes as separate instances a task can pick; mini.test as today, out of
`ready`.

**The tests themselves**: the isolation and timing fixes found by the discovery, benchmarks moved to
`vp run bench`, and the browser tests' repository and sizes
([the browser tests' cost](discovery-01.md#the-browser-tests-cost),
[Q7](clarifications-01.md#q7-should-every-browser-test-run-at-both-sizes)).

Tradeoffs: the inputs are a second list to keep with the code, which a stale local result punishes;
CI pays a dev shell setup per job for parallelism; behaviour tests at one size can miss a
size-specific bug when the test does not declare it.

### The UI tests

You asked whether the UI tests are really useful. The evidence:

- **They found real bugs.** Commit `d4003c2`, "races and stale views the tests hid", fixed 8 product
  races and stale views that flaky UI tests exposed, such as a save overwriting a change made
  elsewhere, and a live subscription missing a change made before it started. Google measured that
  about one flaky test in six is a production bug ([discovery](discovery-01.md#google)).
- **They are the only checks of the web UI's scenarios.** The happy-dom tests render the whole app
  on a real in-process server, and the
  [constitution](../CONSTITUTION.md#vi-code-is-checked-and-stays-maintainable) requires tests
  covering each spec's scenarios; the [UI checks](../decisions/ui-checks.md) decision requires the
  layout and accessibility checks at both sizes.
- **They survive a redesign.** The UI checks decision has them find controls by role, label and
  text, never by markup, so the look-and-feel pass changes few of them; the layout checks will fail
  where it breaks a decision's sizes, which is their purpose.
- **They cost too much.** 343 happy-dom tests take 388 seconds of CPU on CI, and the WebKit ones 364
  seconds per size, at 2.3 to 3.4 seconds each, mostly building a git repository.

So this spec keeps them and trims them (US4): behaviour at one size, a repository built once and
copied, and an audit removing tests that guard no scenario or rule, or that repeat a happy-dom test
in WebKit without needing a real browser. Dropping them, or moving them out of `ready`, would change
the UI checks decision, which you kept in
[Q3](clarifications-01.md#q3-should-some-tests-leave-the-default-run).

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- Wall-clock assertions become benchmarks, run by `vp run bench` only (US1).
- The isolation fixes listed in [Testing](#testing) are made in the tests.
- Tests that print errors without failing are fixed: "database is locked", "Failed to fetch", and
  the unhandled server error.
- Hangs are bounded: `timeout-minutes: 20` on every CI job, and timeouts in the Rust LSP tests that
  have none.
- The `session.test.tsx` failures are checked again once the session view branch merges.
- The root-only skip in `cli/tests/install.rs` stays.
- The Nix store cache is added to CI only if a measured run is faster with it.
- vite-plus is upgraded to 1.2.0 only if its cache report is needed to explain misses.
- The report of the slowest tests comes from the runners' own output.
- Changed by your Q1 answer: the Neovim tests no longer get a parallel runner or faster waits, since
  they leave `ready`; only their git and environment isolation is fixed, so CI's Neovim job fails
  only on a bug.

Settled while writing this spec:

- Your Lua answer is read as "out of `ready`, on CI in its own job", which the toolchain decision
  already allows for checks too slow for every local run
  ([Q1](clarifications-01.md#q1-what-does-this-feature-cover)).
- Coverage runs on pushes to `main` only, in its own job, so a pull request never waits on
  instrumented tests; a pull request's author runs `vp run coverage` to see theirs.
- `core/tests/document.rs`'s check that every file of the repository's `specs/` parses is removed:
  `ura check specs` in `ready` already parses them all, and the test made every spec edit rerun the
  Rust tests. Its check of the example's files stays.
- Library crates set `doctest = false`: there are no doctests, and cargo-nextest would skip them
  silently ([cargo-nextest](discovery-01.md#cargo-nextest)).
- A behaviour test declares its size with a shared helper of the browser tests; without one, it runs
  at the phone size, the narrower layout, where most of the interactions changed by the
  [UI layout](../decisions/ui-layout.md) decision happen.
- The browser tests' repository is built once per run and copied for each test, instead of built
  with git for each test; if measuring shows the time goes elsewhere, the plan follows the
  measurement, with a ruling.
- CI's jobs share a `Swatinem/rust-cache` key, saved from `main` only, so pull requests reuse
  `main`'s build without filling the cache.
- The release plan and the release binary's size move to the release job, unchanged.
- The README's "every check and test, as CI runs them" line changes to say the Neovim tests run on
  CI only.

## Decisions

Changed, applied when this spec is approved:

- [Toolchain](../decisions/toolchain.md#proposed-change-2026-10-14-testing-review): `ready` is a
  graph of cached tasks with listed inputs; CI runs them uncached in parallel jobs; the Rust tests
  run with cargo-nextest; no runner retries a test; coverage is reported, never enforced; the Neovim
  tests run on CI only.

Relied on:

- [Code quality](../decisions/code-quality.md): no sleeps or duration checks in unit tests, which
  this spec enforces by moving them to benchmarks; benchmarks stay exempt.
- [UI checks](../decisions/ui-checks.md): the layout and accessibility checks keep running at both
  sizes in `ready`; behaviour tests are not required at both; every UI test guards a scenario or a
  rule, which the audit applies.
- [Stack](../decisions/stack.md): the binding is tested from TypeScript, and the crates keep their
  boundaries.

## Constitution check

| Principle                                  | Complies | Notes                                                                    |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | The toolchain change waits for this approval; test deletions are rulings |
| II. Git and plain text first               | yes      | Tasks, profiles and CI are text in the repository                        |
| III. Asynchronous by default               | yes      | The cache is a cache: a fresh clone runs everything                      |
| IV. Review effort matches impact           | yes      | One decision change; the audit's outcomes are listed in the plan         |
| V. Tools are optional                      | yes      | The workflow's own tools and artifacts are unchanged                     |
| VI. Code is checked and stays maintainable | yes      | No check is dropped: CI runs every check uncached; no limit goes up      |

## Risk tier

**Medium**: it changes CI, the toolchain decision, and many tests, but no stored data and no
interface of `ura`, the server, or the plugin.

## Details

### Data

No stored data changes. The task graph, in `vite.config.ts`'s `run.tasks`:

| Task                    | Command                                                                                       | Depends on                                                                  | Inputs                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `rust:fmt`              | `cargo fmt --check`                                                                           |                                                                             | `crates/**`, `rustfmt.toml`                                                                                     |
| `rust:clippy`           | `cargo clippy --workspace --all-targets -- -D warnings`                                       |                                                                             | Rust sources: `crates/**`, `Cargo.toml`, `Cargo.lock`, `clippy.toml`, `rust-toolchain.toml`, `skills/uraeda/**` |
| `rust:test`             | `cargo nextest run`, with git's global and system configuration ignored                       |                                                                             | Rust sources, `fixtures/**`, `.config/nextest.toml`                                                             |
| `rust:features`         | the `cargo tree` check that `ura` does not build napi                                         |                                                                             | `crates/*/Cargo.toml`, `Cargo.toml`, `Cargo.lock`                                                               |
| `specs:check`           | `ura check` of `specs` and of the example's specs, through `cargo run`                        |                                                                             | Rust sources, `specs/**`                                                                                        |
| `binding:build`         | the binding's napi build                                                                      |                                                                             | `SOURCES` of `binding.ts`, `packages/binding/package.json`                                                      |
| `web:theme`             | `astryx theme build ... --check`                                                              |                                                                             | `packages/web/src/theme/**`                                                                                     |
| `lua:fmt`               | `stylua --check editors/nvim`                                                                 |                                                                             | `editors/nvim/**`                                                                                               |
| `ts:check`              | `vp check`                                                                                    |                                                                             | every file `vp check` formats or lints: the repository without `target/`, `node_modules/` and its ignored paths |
| `ts:test`               | `vp test` of the binding, server and web projects                                             | `binding:build`                                                             | `packages/**`, `fixtures/**`, `skills/uraeda/**`, `vite.config.ts`, `pnpm-lock.yaml`                            |
| `browser:phone`         | `vp test` of the browser project's phone instance                                             | `binding:build`                                                             | as `ts:test`                                                                                                    |
| `browser:desktop`       | `vp test` of the browser project's desktop instance                                           | `binding:build`                                                             | as `ts:test`                                                                                                    |
| `web:build`             | the web UI's build                                                                            | `binding:build`                                                             | `packages/web/**`, `packages/server/**`, `vite.config.ts`, `pnpm-lock.yaml`                                     |
| `ready:rust`            | none                                                                                          | `rust:fmt`, `rust:clippy`, `rust:test`, `rust:features`, `specs:check`      |                                                                                                                 |
| `ready:typescript`      | none                                                                                          | `binding:build`, `web:theme`, `lua:fmt`, `ts:check`, `ts:test`, `web:build` |                                                                                                                 |
| `ready:browser-phone`   | none                                                                                          | `browser:phone`                                                             |                                                                                                                 |
| `ready:browser-desktop` | none                                                                                          | `browser:desktop`                                                           |                                                                                                                 |
| `ready`                 | none                                                                                          | the four `ready:*`                                                          |                                                                                                                 |
| `test:nvim`             | `cargo build -q -p uraeda-cli`, then the headless Neovim run, git configuration ignored       |                                                                             | not cached                                                                                                      |
| `bench`                 | the Rust benchmarks, then `vp test bench`                                                     | `binding:build`                                                             | not cached                                                                                                      |
| `coverage`              | `cargo llvm-cov nextest` (profile `coverage`), then `vp test --coverage` of the unit projects | `binding:build`                                                             | not cached                                                                                                      |

Rules of the table:

- Cargo tasks declare `output: []`: their build stays in `target/`, never archived by the cache.
  `binding:build` declares its three generated files as outputs, so a hit restores them.
- Every test task ignores the host's git configuration (`GIT_CONFIG_GLOBAL=/dev/null`,
  `GIT_CONFIG_NOSYSTEM=1`, set in its command), and passes the dev shell's variables listed in
  [Edge cases](#edge-cases) through `cache.untrackedEnv`, from one shared list.
- `dev`, `start` and `validate:claude` stay `package.json` scripts: they are not checks.

`.config/nextest.toml`:

- Profile `default`: `slow-timeout = { period = "30s", terminate-after = 4 }` (stopped after 2
  minutes), `leak-timeout = { period = "500ms", result = "fail" }`, no `retries`.
- Profile `ci`: the same, with `fail-fast = false`; CI sets `NEXTEST_PROFILE=ci`.
- Profile `coverage`: the default, with a `default-filter` leaving out the iCCP bomb memory test.

A Rust benchmark is a test marked `#[ignore = "benchmark"]` whose name starts with `bench_`; a
TypeScript benchmark is a `*.bench.ts` file, as `search.bench.ts` already is.

### Components

- **The task graph** ([`vite.config.ts`](/vite.config.ts)): the table above. `package.json` loses
  `ready` and `test:nvim`, which become tasks; `vp run ready` and `vp run test:nvim` keep working.
- **The browser instances** ([`vite.browser.config.ts`](/packages/web/vite.browser.config.ts)): the
  two instances get names, `phone` and `desktop`, that `browser:phone` and `browser:desktop` select.
- **The size helper** (in [`__browser__/helpers.tsx`](/packages/web/src/__browser__/helpers.tsx)): a
  behaviour test or file declares `phone`, `desktop` or `both`; at another size, its tests are
  skipped. The layout and accessibility checks always run at both.
- **The browser repository** (`takeRepo` in `vite.browser.config.ts`, and the global setup): the
  fixture repository is built once per run, then copied into a new folder for each test, instead of
  being built with git each time.
- **The toolchain test** (`packages/server/src/__tests__/toolchain.test.ts`, next to
  `stack.test.ts`): reads `vite.config.ts`, `.github/workflows/ci.yml`, `.config/nextest.toml` and
  the crates' `Cargo.toml`, and fails with a message saying the fix when:
  - a task under `ready` has no `cache.input`: "`<task>` has no `cache.input`: list the files it
    reads, so `ready` reruns it when they change.";
  - a task under `ready` is run by no CI job: "`ready` runs `<task>`, but no CI job does: add it to
    a job in `.github/workflows/ci.yml`.";
  - a Vitest config sets `retry`, or nextest's configuration sets `retries`: "Tests are never
    retried (toolchain decision): remove `<setting>` and fix the test that needed it.";
  - a library crate does not set `doctest = false`: "`<crate>` must set `doctest = false`:
    cargo-nextest does not run doctests."
- **CI** ([`ci.yml`](/.github/workflows/ci.yml)): a shared setup action
  (`.github/actions/setup/action.yml`: Nix, the Rust cache, `pnpm install`), then the jobs `rust`,
  `typescript`, `browser-phone`, `browser-desktop`, `neovim` and `release`, each running
  `vp run --no-cache <group>`, then the clean working tree check; `coverage` on pushes to `main`;
  `timeout-minutes: 20` per job; a `concurrency` group per branch with `cancel-in-progress` for pull
  requests.
- **The flake** ([`flake.nix`](/flake.nix)) adds `cargo-nextest` and `cargo-llvm-cov`;
  [`rust-toolchain.toml`](/rust-toolchain.toml) adds `llvm-tools-preview`; the Vitest v8 coverage
  provider matching the bundled Vitest is added to the catalog.
- **`.gitignore`** adds `coverage/`.
- **The README** ([`README.md`](/README.md)) and the plugin's README update their commands.

### Error handling

- **A check fails**: `vp run ready` stops at the failing task's output, as today; independent tasks
  already running finish.
- **A Rust test times out**: nextest prints `TIMEOUT` with the test's name and its output, and the
  run fails.
- **A Rust test leaks a process**: nextest prints `LEAK-FAIL`, and the run fails.
- **A cached result was stale** (an input missing): CI's uncached run fails on the real error; the
  fix adds the input, and `vp run --last-details` or `vp cache clean` help find it.
- **The toolchain test fails**: its message says what to change, as listed in
  [Components](#components).
- **Coverage cannot count the spawned `ura`**: the summary says "The `ura` binary run by the CLI
  tests is not counted." under the Rust total.

### Testing

The feature's checks run where they apply: the toolchain test in `ts:test`; the cache behaviour by
running `vp run ready` twice, and after each change of US2, reading Vite Task's hit and miss
summary; CI's behaviour on the pull request itself; the timings from CI's logs.

| What                               | Test                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| US1.1, SC-002                      | 10 reruns of CI on the last commit (`gh run rerun`)                                                    |
| US1.2, US5.3                       | `vp run ready` and `vp run test:nvim` with a `HOME` holding the listed git configuration               |
| US1.3                              | `vp run ready` with the listed `.env`; the web configs stop reading `.env` in tests                    |
| US1.4                              | a temporary test that never returns, run with the default profile, then removed                        |
| US1.5, SC-005                      | `vp run ready` and `vp run bench` outputs; a search of the tests for sleeps and duration assertions    |
| US1.6                              | the toolchain test (no `retry`, no `retries`)                                                          |
| US2.1–US2.6, SC-003                | `vp run ready` twice, then after each listed change, reading the run summary                           |
| US3.1, US3.2, US3.4, SC-001        | the feature's pull request runs: jobs, a cancelled older run, a deliberately stale `index.d.ts` commit |
| US3.3                              | the toolchain test, with a fixture config adding a task no job runs                                    |
| US4.1–US4.3, SC-004                | the browser runs at both sizes: skipped and run counts per instance; CI's summed file times            |
| US4.4                              | the plan's audit list, and a ruling per removed test                                                   |
| US5.1, US5.2                       | `vp run ready` output; the `neovim` CI job                                                             |
| US6.1–US6.3                        | `vp run coverage` locally; the `coverage` job on the first push to `main`                              |
| Edge: missing input                | a test task with a folder removed from its inputs: local hit, CI failure                               |
| Edge: fresh clone, binding restore | `vp cache clean`, then `ready`; deleting the `.node` file, then `ready`                                |
| Edge: exported `GIT_DIR`           | `GIT_DIR=/nonexistent vp run ready` passes                                                             |
| Edge: coverage-only failure        | the `coverage` profile's filter, and the iCCP test still in `rust:test`                                |

The isolation and timing fixes, each tested by its own test still passing under the conditions of
US1.2 and US1.3:

- Rust: the LSP tests stop setting `URA_TODAY` in the process environment while other threads run;
  timeouts on the LSP session's reads and shutdown and on `cli/tests/lsp.rs`; the timing tests of
  `lsp/tests/diagnostics.rs`, `cli/tests/performance.rs` and the bombs' durations in
  `core/tests/images.rs` become benchmarks, the bombs keeping their refusal check; the
  `requests_are_answered_while_a_command_runs` hook waits for a signal instead of sleeping.
- TypeScript: the wall-clock checks and sleeps of `server/live.test.ts`,
  `server/repositories.test.ts` and browser `attach.test.tsx` wait for conditions instead; the web
  and browser configs no longer read the repository's `.env` under test; the browser setup's
  variables no longer reach the Node projects; `repositories.test.ts` restores `HOME` in a
  `finally`; the server tests get the web tests' timeout for git work; the scroll offset check of
  browser `round.test.tsx` waits for the scroll to stop.
- Lua: `helpers.repo` ignores the global git configuration and clears inherited `GIT_*` variables;
  the variables set at file load are set per case and restored.
