---
kind: feature
finished: 2026-10-15
pull-request: https://github.com/mrtolkien/uraeda/pull/18
---

# Record: Testing review

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-14, finished on
> 2026-10-15, in [its pull request](https://github.com/mrtolkien/uraeda/pull/18). Its full files are
> in git: `git log -- specs/2026-10-14-testing-review/`.

## What and why

`vp run ready` runs after every task of a plan, and took about 2 minutes locally, rerunning every
step one after the other: over a feature, an hour or more lost. CI took up to 15 minutes in one job,
and failed about half the time, when "a CI failure MUST mean that there is an IMPORTANT bug to fix".
The human asked for tests that are "useful AND fast AND accurate": only the checks a change can
affect rerun, what can run in parallel does, tests are isolated and reproducible, coverage is
measured, and every test, flaky ones above all, pulls its weight.

## Behaviour

- **A red CI means a bug.** No runner retries a test: nextest's profiles set no `retries`, no Vitest
  config sets `retry`, and the toolchain test fails on either, or on a retry flag in a task or CI. A
  test that fails without a bug is fixed or rewritten in the pull request that finds it. Every test
  task ignores the host's git configuration and the `GIT_DIR`-like variables a hook exports, and the
  web configs read no `.env` under test. A hung Rust test is stopped after 2 minutes and a leaked
  process fails it. No Rust or TypeScript test outside a benchmark sleeps for a fixed time or
  asserts a duration: those checks are benchmarks, run only by `vp run bench`.
- **`ready` reruns only what a change can affect.** `ready` is a graph of cached Vite Task tasks in
  `vite.tasks.ts`, each listing its inputs in `cache.input`, never automatic tracking; independent
  tasks run in parallel, and four groups, `ready:rust`, `ready:typescript`, `ready:browser-phone`,
  and `ready:browser-desktop`, are the units CI runs. A test reading a new folder needs it added to
  its task's inputs; a missing input replays a stale pass locally, which CI's uncached run catches.
  A `specs/` edit reruns `specs:check` and `ts:check` (Markdown is formatted); a skill edit rebuilds
  the binding and reruns the Rust and TypeScript tests. `binding:touch`, uncached, marks a restored
  binding as built on every run. `ts:test` and `coverage` select the Vitest projects by exclusion
  (`--project '!phone' --project '!desktop'`), and the toolchain test fails when a project of
  `test.projects` is run by no task of `ready`.
- **CI runs the checks in parallel jobs.** `rust`, `typescript`, `browser-phone`, `browser-desktop`,
  `neovim`, and `release` start at once, each through the shared setup action (Nix, the Rust cache
  saved from `main` only, `pnpm install`), each running `pnpm exec vp run --no-cache <task>` in the
  dev shell, then failing if its checks left the working tree changed; `timeout-minutes: 20` per
  job; a newer run cancels an older one on any branch but `main`, and CI can be started by hand. The
  toolchain test fails when `ready` runs a task no CI job runs. The release plan and the binary's
  size run in `release`. No Nix store cache and no path filters. Measured once: 6 min 7 s, against
  up to 15 before.
- **The browser tests pull their weight.** The layout and accessibility checks run at 402 × 874 and
  at 1440 × 900; each behaviour test runs at the size its scenario is about, declared with `atSize`
  at the top of its file or `describe`, and at both only where the two layouts behave differently;
  at the other size its tests are reported skipped. The fixture repository is built once per run
  with git and copied for each test. The audit removed six WebKit tests that repeated a happy-dom
  test or a layout check, each by a ruling.
- **The Neovim tests run on CI only**, in the `neovim` job, out of `ready`, and stay runnable with
  `vp run test:nvim`, which builds `ura` itself; they ignore the host's git configuration and its
  inherited `GIT_*` variables.
- **Coverage is reported, never enforced.** `vp run coverage` writes `coverage/rust.lcov`,
  `coverage/typescript/lcov.info`, an HTML report of each, and a summary of lines covered per
  language; the spawned `ura` is counted. CI's `coverage` job, on pushes to `main` only, uploads
  `coverage/` as the `coverage` artifact, kept 30 days. Nothing fails on a drop.
- **Benchmarks** are Rust tests marked `#[ignore = "benchmark"]` named `bench_…`, the TypeScript
  `*.bench.ts` files, and the package's smoke test with `--timed` (the run-ui feature's first page
  within 2 seconds), all under `vp run bench`; `ready`'s `ui:smoke` runs the smoke test untimed, and
  the npm release gate passes `--timed`.

## Design

The map of what a change can break, which existed nowhere, lives in the tasks' inputs, and the
toolchain test keeps `ready`, CI, and the runners' settings in step by reading them. CI pays a dev
shell setup per job for parallelism, and runs uncached, so a stale local result never merges.

- The task graph, its inputs, `isolatedGit`, and the dev shell's variables passed to the tests, in
  [`vite.tasks.ts`](/vite.tasks.ts), given to Vite Task as `run.tasks` by
  [`vite.config.ts`](/vite.config.ts), which also holds the Vitest projects and the coverage
  settings; the binding's sources come from `SOURCES` in
  [`packages/server/src/binding.ts`](/packages/server/src/binding.ts).
- nextest's profiles `default`, `ci` (`fail-fast = false`), and `coverage` (without the iCCP bomb's
  memory test) in [`.config/nextest.toml`](/.config/nextest.toml); `cargo-nextest` and
  `cargo-llvm-cov` pinned by [`flake.nix`](/flake.nix); library crates set `doctest = false`.
- CI in [`.github/workflows/ci.yml`](/.github/workflows/ci.yml), with its setup in
  [`.github/actions/setup/action.yml`](/.github/actions/setup/action.yml).
- The toolchain test, [`toolchain.test.ts`](/packages/server/src/__tests__/toolchain.test.ts):
  inputs listed, no retries, `doctest = false`, every task and Vitest project of `ready` run
  somewhere, each failure saying its fix.
- The browser tests: `atSize` in [`helpers.tsx`](/packages/web/src/__browser__/helpers.tsx), tested
  by [`sizes-helper.test.tsx`](/packages/web/src/__browser__/sizes-helper.test.tsx); the named
  `phone` and `desktop` instances and `takeRepo`, copying the template repository the global setup
  builds, in [`vite.browser.config.ts`](/packages/web/vite.browser.config.ts) and
  [`setup.ts`](/packages/web/src/__browser__/setup.ts).
- The Neovim tests' git isolation in
  [`editors/nvim/tests/minimal_init.lua`](/editors/nvim/tests/minimal_init.lua).
- The coverage summary in [`scripts/coverage-summary.ts`](/scripts/coverage-summary.ts), tested by
  [`coverage-summary.test.ts`](/packages/server/src/__tests__/coverage-summary.test.ts).
- The benchmarks in [`crates/cli/tests/performance.rs`](/crates/cli/tests/performance.rs),
  [`crates/core/tests/images.rs`](/crates/core/tests/images.rs),
  [`crates/lsp/tests/diagnostics.rs`](/crates/lsp/tests/diagnostics.rs),
  [`live.bench.ts`](/packages/server/src/__tests__/live.bench.ts), and
  [`smoke.ts`](/packages/uraeda/scripts/smoke.ts)'s `--timed`.
- Product fixes found by the tests: following the end of a session in
  [`packages/web/src/following.ts`](/packages/web/src/following.ts), and the web configs' settings
  readers' `{ file: false }`.

## Questions

### Round 01

#### Q1: What does this feature cover?

**Answer:** A: reliability, speed, parallel runs, and coverage reports for Rust and the TypeScript
unit tests, with "Lua tests can be skipped by default tbh, it's extremely secondary and rarely
touched. Not worth 46 seconds.", read as out of `ready` but still on CI; and "Create a 'Later' line
in priorities for Cargo mutants".

#### Q1.A: What does coverage do once it is measured?

**Answer:** A: a report only, written by `vp run coverage` and kept by CI as an artifact; nothing
fails on a drop.

#### Q2: What happens when a test fails without a bug?

**Answer:** A: no retries anywhere; a test failing without a bug is fixed or rewritten in the pull
request that finds it, and wall-clock checks become benchmarks run on demand.

#### Q3: Should some tests leave the default run?

**Answer:** A: one tier, every test in `ready` and on CI, made faster rather than left out.

#### Q4: How does a task skip the work its change cannot affect?

**Answer:** A: `ready`'s steps become cached Vite Task tasks with explicit inputs, run in parallel;
the skill keeps "every test" after each task.

#### Q5: How should CI run the checks?

**Answer:** A: parallel jobs, each in the dev shell, with no path filters.

#### Q6: Should Rust tests run with cargo-nextest?

**Answer:** A: cargo-nextest, pinned by the flake, with a CI profile; `cargo test` keeps working.

#### Q7: Should every browser test run at both sizes?

**Answer:** A: layout and accessibility checks at both sizes, behaviour at its own, with a question:
"I'm not convinced they are pulling their weight compared to the run time, complexity, and
maintenance burden. Are those tests really _useful_?", answered in the spec: they had found 8 real
races, so they were trimmed and audited rather than dropped.

## Decisions

- [Toolchain](../decisions/toolchain.md), changed: `ready` is a graph of cached tasks with listed
  inputs, CI runs them uncached in parallel jobs, the Rust tests run with cargo-nextest, no runner
  retries a test, coverage is reported and never enforced, and the Neovim tests run on CI only.

## Changes after approval

- The Neovim tests' git isolation lives in `minimal_init.lua`, which the runner and every child
  Neovim load, not in `helpers.repo` (R2).
- CI cancels an older run on any branch but `main`, and has a `workflow_dispatch` trigger (R3).
- A `specs/` edit also reruns `vp check`, which formats Markdown (R4).
- The image attachments' SC-002, a screenshot linked within a second, is measured nowhere: its
  browser test was removed (R5).
- `binding:touch` marks a binding restored from the cache as built, so `checkBinding` accepts it
  (R7).
- The web configs leave `.env` out of the tests through a `{ file: false }` option of `loadEnv`,
  `loadDataDir`, and `devHandler` (R10).
- Every test task drops `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_COMMON_DIR`, so an
  uncached run is isolated too (R13).
- `atSize` reads the instance's configured viewport and skips through its scope's options, called at
  the top of a file or `describe`, and throws when called after a test (R15, R28).
- The audit removed the browser tests of two pasted images in the composer, a drop on the session
  page, a verdict held back by a comment's image, "Add image", and the editor's drop hint, each
  covered by a happy-dom test or the layout checks (R21–R25).
- `@uraeda/ui`'s build and smoke test, added on `main` meanwhile, are the tasks `ui:build` and
  `ui:smoke` in `ready:typescript`, and `ts:test` runs its project after `web:build` (R29).
- `useFollowEnd` takes the window's position as the human's only once the place is put back after a
  width class change, so a resize across 768 px no longer throws a reader to the end (R35); it
  follows once more as a session stops working, so the failed run's banner stays in view (R38).
- CI's jobs run `vp` through `pnpm exec`, with `actions/checkout@v6` and
  `actions/upload-artifact@v7` and read-only permissions (R36).
- CI was measured on one run, at the human's request: no 10 reruns, no cancellation check, no
  scratch branch for the clean tree check (R37).
- `ts:test` and `coverage` select the Vitest projects by exclusion, and the toolchain test checks
  every project is run (R39).
- The smoke test asserts no duration in `ready`; `--timed`, passed by `vp run bench` and the release
  gate, keeps the run-ui feature's SC-002 (R40).

## Follow-ups

- `packages/web/dist/**` in `ts:test`'s inputs is dead: `!**/dist/**` wins.
- `ts:check`'s and `specs:check`'s globs include git-ignored generated files (`coverage/`,
  `.vitest/`, `packages/uraeda/{dist,plugin,web}`), so they rerun or miss without cause.
- `ts:check` does not depend on `binding:build`: a stale `index.d.ts` is possible locally once.
- `flake.lock` is in no task's inputs, `web:theme` lacks `pnpm-lock.yaml`, and `ui:smoke` lacks
  `Cargo.toml` and `packages/binding/index.js`.
- The spec's "default phone" size is not built: a browser test without `atSize` runs at both sizes.
- The Rust benchmarks print no measure, and `main`'s `branch_changes_takes_under_100_ms`
  (`crates/core/tests/branch_changes.rs`) breaks the `bench_` convention.
- The `rust-cache` shared key is raced by 7 jobs; `notInCi` counts `echo` and `name` lines; the
  binding's `test-utils` imports `vite-plus/test` at its top level.
- US6.2, the `coverage` artifact, is unchecked until the first push to `main`.
- SC-002's 10 reruns, US3.2's cancellation, and US3.4's clean tree failure are untested (R37).
- On the phone, the undo toast covers Commit and Discard (R28): the human's to decide.
- `PRIORITIES.md` can be read empty while it is written, by a live view too (R30).
- Four `session.test.tsx` tests guard behaviour shipped without a spec.
- Temporary test folders were seen leaked in `/tmp`.
- Mutation testing with cargo-mutants, in the priorities' Later section.
