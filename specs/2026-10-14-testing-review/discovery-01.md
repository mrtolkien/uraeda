# Discovery, round 01: Testing review

## Summary

A testing review of a polyglot repository usually covers five parts: what makes tests fail without a
bug (shared state, time, leaked processes, the host's configuration), how a run skips work that
cannot have changed (caching, or selecting the "affected" packages from a git diff), how a run uses
the machine (parallel processes and parallel CI jobs), how coverage is measured, and how a team
judges whether a test is worth its cost (tiers of slow tests, mutation testing). Established
practice differs most on flaky tests: Google and the test runners offer retries and quarantine,
while Google's own data and Martin Fowler warn that both hide real races.

The [proposal](proposal.md) asks for all five: tests relevant to a change only, parallel runs, no
flaky failures on CI ("a CI failure MUST mean that there is an IMPORTANT bug"), coverage of the
whole code base, and tests that pull their weight, maybe with non-critical ones behind a flag.

Today, `vp run ready` is one `package.json` script of 15 steps joined by `&&`: it runs them one
after the other, and Vite Task never caches it. On CI, the job takes up to 15 minutes, and 8.5 of
them are `vp test`, whose WebKit browser tests are the critical path. The Rust tests take under a
minute, the Neovim tests 46 seconds. Of the last 100 CI runs, 43 failed; the recurring failures are
web tests waiting on the page or asserting wall-clock times. The toolchain decision requires `ready`
to run every check and CI to run `ready`, which several approaches would change.

## How other products do it

### Google

- About 1.5% of test runs are flaky, and almost 16% of tests have some flakiness; 84% of
  pass-to-fail transitions involve a flaky test
  ([Flaky Tests at Google and How We Mitigate Them, 2016](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html)).
- Mitigations: rerunning failed tests, a "flaky" mark that only fails after three failures in a row,
  and automatic quarantine. The post calls the mark "hardly a perfect solution", and says quarantine
  "could easily mask a real race condition" (same source).
- Larger tests are flakier: 0.5% of small tests, 1.6% of medium, 14% of large. Binary size and
  memory use predict flakiness better than the tool used. "If the root cause is nondeterminism in
  the production code, ignoring the test means ignoring a production bug"
  ([Where do our flaky tests come from?, 2017](https://testing.googleblog.com/2017/04/where-do-our-flaky-tests-come-from.html)).

### Spotify

- A grid of test results over time tells flakiness (scattered failures) from broken infrastructure
  (whole columns). Publishing a table of each test's speed and flakiness alone cut flakiness from 6%
  to 4% in two months
  ([Test Flakiness, 2019](https://engineering.atspotify.com/2019/11/test-flakiness-methods-for-identifying-and-dealing-with-flaky-tests/)).

### Martin Fowler

- Non-deterministic tests are quarantined, and "fixed quickly", with a cap on how many or how long.
  The causes he lists: lack of isolation, asynchronous behaviour ("never use bare sleeps", poll with
  one generous timeout), remote services, the clock, and leaked resources
  ([Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html)).

### Turborepo and Nx

- Turborepo's `--affected` runs the packages changed between `main` and `HEAD`, and their
  dependents. A shallow clone makes every package count as changed
  ([Turborepo run reference](https://turborepo.dev/docs/reference/run)).
- `nx affected -t test` does the same from git and the project graph; a lockfile change affects
  everything, and CI needs the full history (`fetch-depth: 0`)
  ([Nx affected](https://nx.dev/docs/features/ci-features/affected)).
- Both only know the dependencies declared between packages, not files a test reads at run time.

### Neovim plugins

- mini.nvim gates its test job with `dorny/paths-filter` and a job-level `if:`, then runs
  `make test` on a matrix of Neovim versions, with `timeout-minutes: 15` (its
  `.github/workflows/quality-control.yml`, read through `gh`).
- lazy.nvim runs its tests through a shared workflow with `timeout-minutes: 10`; nvim-lspconfig on a
  matrix of Ubuntu and macOS, with `concurrency` cancelling older runs of a pull request (their
  workflow files, read through `gh`).

### What they have in common

- **A CI failure is investigated, not retried away**: every source above treats a rerun pass as a
  symptom. Retries, when used, are reported as flaky rather than counted as passes.
- **Slow and large tests are the flaky ones**, and they get their own tier, timeout, or job.
- **Work that cannot have changed is skipped**, by caching or by an affected-packages selection,
  with the full suite still run somewhere (on `main`, or nightly).
- **A per-test or per-job timeout** guards against hangs.
- **Visibility**: a table or report of slow and flaky tests.
- **Coverage is reported per language and merged by a service**, usually without blocking merges.

## Standards and libraries

### cargo-nextest

- Version 0.9.148 ([releases](https://github.com/nextest-rs/nextest/releases)). Each test runs in
  its own process: global state and environment variables are isolated, and a hung test can be
  killed ([why process per test](https://nexte.st/docs/design/why-process-per-test/)).
- Retries (`retries = 2`) report tests that pass on retry as flaky; `flaky-result = "fail"` makes
  them fail the run anyway ([retries](https://nexte.st/docs/features/retries/)).
- `slow-timeout = { period, terminate-after }` kills a test after a time, per test or per profile
  ([slow tests](https://nexte.st/docs/features/slow-tests/)). Leaked subprocesses can fail a test
  ([leaky tests](https://nexte.st/docs/features/leaky-tests/)).
- Profiles hold a `default-filter`, for example to leave slow tests out locally and run them on CI
  ([selecting tests](https://nexte.st/docs/selecting/)). Filtersets include `rdeps(crate)`, the
  crate and its dependents, but nextest has no change detection of its own
  ([filtersets](https://nexte.st/docs/filtersets/reference/)).
- Archives build the tests once and run them in other CI jobs, split with `--partition`
  ([archiving](https://nexte.st/docs/ci-features/archiving/),
  [partitioning](https://nexte.st/docs/ci-features/partitioning/)).
- Doctests are not run ([running](https://nexte.st/docs/running/)). This repository has none (see
  [the Rust tests](#the-rust-tests)).

### Vite Task

- Tasks defined in `vite.config.ts` are cached by default, `package.json` scripts are not
  (`node_modules/vite-plus/docs/config/run.md`, `run.cache` defaults to
  `{scripts: false, tasks: true}`; [cache guide](https://viteplus.dev/guide/cache)).
- Inputs are tracked automatically from the files a task reads, or given as globs in `cache.input`;
  environment variables only count when listed in `cache.env`. Tasks run in a clean environment that
  passes `PATH`, `HOME`, `CI` and a few others only (`docs/guide/cache.md`, "Environment
  Variables"). The dev shell's `MINI_TEST`, `PLAYWRIGHT_BROWSERS_PATH`, `FONTCONFIG_FILE` and
  `__EGL_VENDOR_LIBRARY_DIRS` would have to be passed explicitly (judgement, from that list).
- `dependsOn` orders tasks, and up to 4 tasks run at once by default (`--concurrency-limit`).
  Commands joined by `&&` run in order (`docs/guide/run.md`, "Concurrency", "Compound Commands").
- There is no "affected" or "changed since" selection: caching is the documented way to skip work
  (same pages).
- Restoring the cache on GitHub Actions is marked experimental; the guide says to measure, since
  transfer can cost more than it saves
  ([GitHub Actions cache](https://www.viteplus.dev/guide/github-actions-cache)).
- vite-plus 1.2.0, released on 2026-10-14, shows the cache hit rate and why a task missed
  (`vp run --last-details`), and caches `vp test` tasks
  ([releases](https://github.com/voidzero-dev/vite-plus/releases)). The repository is on 1.0.0.

### Vitest

- The repository runs Vitest 5.0.1 through vite-plus. Its defaults: one process per test file,
  `maxWorkers` the number of cores minus one, a 5 s test timeout, no retries
  (`vitest/dist/chunks/index.DzobfTyw.js:16490`).
- `--changed` runs the tests whose imports changed, from Vite's module graph; `forceRerunTriggers`
  lists files that rerun everything, such as a built `dist/` the graph cannot see
  ([CLI](https://vitest.dev/guide/cli),
  [forceRerunTriggers](https://vitest.dev/config/forcereruntriggers)). The native binding, the
  fixtures and the skill are read through `fs` or Rust, so `--changed` would miss them (judgement).
- `--shard=i/n` splits test files across CI jobs, merged with `--merge-reports`
  ([improving performance](https://vitest.dev/guide/improving-performance)).
- `retry: { count, delay, condition }` retries failed tests, without a flaky report
  ([retry](https://vitest.dev/config/retry)). Test tags (`--tags-filter`) and projects
  (`--project '!browser'`) select subsets ([tags](https://vitest.dev/guide/test-tags),
  [projects](https://vitest.dev/guide/projects)).

### GitHub Actions

- A public repository's `ubuntu-latest` runner has 4 vCPUs and 16 GB; larger runners need a paid
  plan
  ([hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)).
  This repository is public (`gh repo view`).
- A workflow skipped by `paths:` leaves a required check pending, which blocks the merge; a job
  skipped by `if:` reports success
  ([required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)).
  `dorny/paths-filter@v4` computes per-filter outputs for such `if:`s
  ([paths-filter](https://github.com/dorny/paths-filter)).

### CI caches

- `Swatinem/rust-cache@v2`, already used, caches dependencies but not the workspace's own crates,
  and keys on the job ([rust-cache](https://github.com/Swatinem/rust-cache)).
- The Nix store is not cached today. `nix-community/cache-nix-action@v7` saves `/nix` in the Actions
  cache (10 GB per repository), and warns it "may slow workflows"
  ([cache-nix-action](https://github.com/nix-community/cache-nix-action)). Magic Nix Cache came back
  in June 2025 on an undocumented API that "could break"
  ([Determinate Systems](https://determinate.systems/blog/bringing-back-magic-nix-cache-action)).
- sccache cannot cache incremental crates or crates that link, such as the binding's `cdylib`
  ([sccache](https://github.com/mozilla/sccache)).

### Coverage tools

- **Rust**: `cargo llvm-cov nextest` runs the tests under coverage and writes lcov; it needs the
  `llvm-tools-preview` component, absent from [`rust-toolchain.toml`](/rust-toolchain.toml).
  `--fail-under-lines` sets a threshold
  ([cargo-llvm-cov](https://github.com/taiki-e/cargo-llvm-cov),
  [nextest integration](https://nexte.st/docs/integrations/test-coverage/)). Whether it covers the
  `ura` binary spawned by the CLI tests was not confirmed (see [Not checked](#not-checked)).
- **TypeScript**: Vitest's v8 provider is the default and as accurate as istanbul since 3.2, but
  runs on Node and Chromium only, so not in the WebKit browser tests; istanbul instruments any
  runtime. `thresholds.autoUpdate` raises the thresholds as coverage grows, a built-in ratchet
  ([coverage guide](https://vitest.dev/guide/coverage),
  [config](https://vitest.dev/config/coverage)).
- **Lua**: luacov writes its own format, lcov through a separate reporter
  ([luacov](https://github.com/lunarmodules/luacov)). No established setup with mini.test was found:
  its child Neovims would each have to load luacov (judgement).
- **Merging**: Codecov takes one upload per language, tagged with a flag; `carryforward` keeps a
  flag's last value when it did not run, and `informational: true` statuses never block
  ([flags](https://docs.codecov.com/docs/flags),
  [status](https://docs.codecov.com/docs/commit-status)). It is an outside service receiving the
  code's coverage.

### Mutation testing

- cargo-mutants 27.1.0 finds code that can change without a test failing; `--in-diff` limits it to a
  pull request's changes ([mutants.rs](https://mutants.rs/),
  [in-diff](https://mutants.rs/in-diff.html)).
- StrykerJS's Vitest runner does not support browser mode
  ([Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)).

### mini.test

- No parallel execution, by design; no per-case timeout; `n_retry` per test set; `run_file` runs one
  file
  ([mini-test.txt](https://raw.githubusercontent.com/nvim-mini/mini.nvim/main/doc/mini-test.txt),
  [TESTING.md](https://github.com/nvim-mini/mini.nvim/blob/main/TESTING.md)). Running one headless
  Neovim per file from an outside runner is possible, but documented nowhere (judgement).

### git

- `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1` ignore the user's and system's
  configuration, "useful for reproducible tests" ([git](https://git-scm.com/docs/git)).
- `git init` defaults to `master` until Git 3.0, unless `init.defaultBranch` or `-b` says otherwise
  ([git-init](https://git-scm.com/docs/git-init)). Git is not pinned by [`flake.nix`](/flake.nix):
  tests use the host's.

## The code

### Important reads

- [`package.json`](/package.json) `ready`: 15 steps joined by `&&`, so nothing runs in parallel and
  nothing is cached; CI prints `⊘ cache disabled`. `test:nvim` is a script too.
- [`vite.config.ts`](/vite.config.ts) `test.projects`: binding, server, web, and web in WebKit, all
  run by one `vp test` at once, with no retries and no coverage.
- [`.github/workflows/ci.yml`](/.github/workflows/ci.yml): one job, `nix develop` then
  `vp run ready`, then the release plan and a release build of `ura` for its size.
- [`specs/decisions/toolchain.md`](/specs/decisions/toolchain.md): `ready` MUST run every check; CI
  MUST run `ready` in the dev shell; Rust MUST pass `cargo test`; checks too slow for every local
  run MAY run on CI only.
- [`specs/decisions/code-quality.md`](/specs/decisions/code-quality.md): unit tests MUST NOT sleep
  for a fixed time or assert how long something took; benchmarks of a spec's success criteria are
  exempt.
- [`specs/decisions/ui-checks.md`](/specs/decisions/ui-checks.md): `ready` MUST run the layout and
  accessibility checks in WebKit at 402 × 874 and 1440 × 900; every UI test MUST guard a spec's
  scenario or a UI decision's rule. It does not require behaviour tests at both sizes.
- [`skills/uraeda/references/implementation.md`](/skills/uraeda/references/implementation.md) step
  3: after each task, "Run the project's validation: formatter, linter, type checker, and every
  test". This is why `ready` runs at every task.

### Where the time goes

- **CI**, run 38559076985 on 2026-10-14 (14 min 44 s): setup and caches 40 s, `nix develop` and
  `pnpm install` 1 min 18 s, `ready` 11 min 29 s, release plan and release build 57 s (`gh run view`
  and its log). Inside `ready`: format, clippy and the Rust build 42 s (rust-cache warm),
  `cargo test` 49 s, the binding build 15 s, theme, format and lint 8 s, **`vp test` 8 min 30 s**,
  Neovim 46 s, web build 4 s.
- Of the last 100 CI runs (from 2026-10-11), successful runs took 2.2 to 14.8 minutes, median 6.2.
  `vp test` grew from about 207–262 s on 2026-10-13 to 510–555 s on 2026-10-14, when the image
  attachments' browser tests landed (CI logs).
- **`vp test` by project** (run 38568195432, summed file times): WebKit about 364 s per viewport,
  web unit 388 s, server 68 s, binding 5 s. With 4 vCPUs, Vitest uses 3 workers, and the browser
  project runs its files one at a time (`fileParallelism: false`,
  [`vite.browser.config.ts:222`](/packages/web/vite.browser.config.ts)).
- **Slowest files**: browser `layout.test.tsx` (48 tests, about 152 s per viewport) and
  `attach.test.tsx` (28 tests, about 115 s per viewport); web `review.test.tsx` (94 s),
  `session.test.tsx` (58 s), `editor.test.tsx` (30 s), `commit-actions.test.tsx` (27 s),
  `lint.test.ts` (19 s, 12 `vp lint` processes in a row). Every browser test costs 2.3 to 3.4 s,
  even trivial ones: each one takes a fixture repository built with git (`takeRepo`,
  [`vite.browser.config.ts:66-106`](/packages/web/vite.browser.config.ts)), judgement from the
  timings.
- **Rust**: 552 tests in 44 test binaries; `images.rs` takes 20 of the 49 s. Each integration file
  is its own binary linking the whole core (gix, image, libwebp, notify), so linking is much of the
  build (judgement).
- **Neovim**: 81 cases in 12 files, one after the other, each in a new child Neovim with a new
  `ura lsp`. About 28 of the 38 s locally wait out timeouts the tests expect to run out
  ([proposal](proposal.md#notes), checked in [the Neovim tests](#the-neovim-tests)).
- **Locally**, `ready` took about 2 minutes on the human's machine ([proposal](proposal.md)), which
  has 32 cores (`nproc`).

### What fails on CI

- 43 of the last 100 runs failed, and no commit was run twice (0 of 98 commits has both a failure
  and a success), so failures were fixed by new commits, never by a rerun (`gh run list`).
- Of the 16 most recent failures, 14 are Vitest failures, 1 is `ura check specs`, 1 is formatting;
  none is Rust or Neovim (CI logs, read with `gh run view --log-failed`).
- Recurring Vitest failures:
  - web `session.test.tsx`, `Unable to find role="button" and name "Send"` in `send()`
    ([`session.test.tsx:44-48`](/packages/web/src/__tests__/session.test.tsx)): 4 runs, 4 different
    tests, and still present on `main`. The code-quality feature already noted "US1.3 … is flaky
    under load" ([record](/specs/done/2026-10-14-code-quality-in-the-skill.md)).
  - `fate.test.ts` "20 feature branches in under 500 ms" (4 runs) and `search.test.ts` SC-003 (1
    run): wall-clock checks, removed from `vp test` by commit `ece1127`, which says they "measured
    the CI runner's load more than the server".
  - browser `round.test.tsx` desktop, a scroll offset "expected 326.7 to be less than 3": 2 runs.
  - browser `attach.test.tsx` US3.1 on both viewports: 2 runs, on the image attachments' branch,
    maybe a real bug fixed before merge (judgement).
  - an unhandled `FateRequestError: Internal server error` from `editor.test.tsx` failed run
    38515969774 although all 678 tests passed.
- CI logs also print errors that fail nothing: "The runner's cache could not be opened … database is
  locked" and `TypeError: Failed to fetch` from `home.test.tsx:94` (run 38559076985).

### The Rust tests

- 552 tests: core 297, cli 168, lsp 68, inline 19; one `#[ignore]` (`core/tests/images.rs:511`), no
  doctests, no retries. `tempfile` is the only test dependency.
- Isolation is mostly good: `TestRepo` sets local git identity, no signing and its own hooks, and
  runs git with `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`
  ([`core/tests/common/repo.rs`](/crates/core/tests/common/repo.rs)). CLI tests run `ura` with a
  temporary `HOME`, `URA_TODAY` and `NO_COLOR`
  ([`cli/tests/common/mod.rs:58-90`](/crates/cli/tests/common/mod.rs)). No test writes to
  `fixtures/` or the repository, uses a port or the network.
- Hazards found:
  - `lsp/tests/commands.rs:16-20` sets `URA_TODAY` with `set_var` while other test threads may
    already be spawning git: a data race under `cargo test`, which a process per test removes.
  - The core's own git calls (`core/src/git.rs:578`), run in-process by core and LSP tests, inherit
    the host's global git configuration and any `GIT_DIR` or `GIT_INDEX_FILE` exported by a calling
    hook.
  - `api::next_step` and `ura status` run the host's `gh` (`core/src/steps.rs:270`).
  - `today()` reads the local date and time zone where `URA_TODAY` is not set (core API tests).
  - Wall-clock assertions: `lsp/tests/diagnostics.rs:137` (300 ms, SC-001),
    `cli/tests/performance.rs` (5 s), `core/tests/images.rs:233` (1 s per bomb); a hook sleeping 1 s
    in `lsp/tests/commands.rs:858-871`, whose assertion fails if the test stalls a second; the
    watcher tests' 800 ms quiet windows (`core/tests/watch.rs:167-202`), already loosened once in
    `07a63ee`.
  - No timeout in `cli/tests/lsp.rs` or in the LSP session's shutdown: a hung server hangs the run.
  - `cli/tests/install.rs:782` passes without testing when run as root.
- Several tests read files outside `crates/` at run time: the example's specs, the skill's files,
  `fixtures/`, and the repository's own `specs/` (`core/tests/document.rs`
  `every_example_and_specs_file_parses`), so a spec edit can fail a Rust test. The skill is also
  compiled into the core (`core/build.rs:3`, `core/src/embedded.rs:7`).

### The TypeScript tests

- 948 tests: binding 17, server 366, web unit 343, browser 111 per viewport.
- Each test file gets its own temporary folder as `TMPDIR`
  ([`binding/test-setup.ts`](/packages/binding/test-setup.ts)); `isolateGit()` ignores the global
  git configuration ([`binding/test-utils.ts:15-22`](/packages/binding/test-utils.ts)); servers run
  in process on a temporary data folder. No test was found writing to `~/.local/share/uraeda`.
- Hazards found:
  - Wall-clock assertions and fixed sleeps, against the code-quality decision:
    `server/live.test.ts:140,452` (under 2000 and 1000 ms), `:407,465` (sleeps);
    `server/repositories.test.ts:491` (under 1000 ms), `:557` (sleep); browser `attach.test.tsx:280`
    (under 1000 ms), `:295,346` (sleeps of 1000 and 500 ms).
  - The browser setup's `URAEDA_REPO` and `URAEDA_DATA_DIR` leak into the Node projects' workers
    (`server/dev.test.ts:11` saves and restores them for that reason).
  - The repository's own `.env` is read by the web and browser configs (`web/vite.config.ts:20,90`,
    `server/src/env.ts:47-55`): a developer's settings reach the tests.
  - `repositories.test.ts:317-320` restores a stubbed `HOME` outside a `finally`.
  - The server tests keep Vitest's 5 s timeout while doing the same git work as the web tests, which
    raised theirs to 20 s ([`web/vite.config.ts:109`](/packages/web/vite.config.ts)).
- Every project needs the built native binding, a debug napi build absent from a fresh checkout; the
  web projects fail at start when any of its sources, the skill included, is newer than the `.node`
  file ([`server/src/binding.ts:14-55`](/packages/server/src/binding.ts)).
- Past fixes: `07a63ee` (wait for the page, not for time; git isolation; repositories taken in
  turn), `d4003c2` (product races the tests hid), `ece1127` (timing checks out of `vp test`), and
  several raised timeouts for CI's slower WebKit (`f36da05`, `c7a55bb`, `79e7451`).

### The Neovim tests

- The proposal's notes hold, with one correction: in `test_inline.lua`, the call that waits out its
  2 s is `inline(1)` at line 135, not `inline(0)`.
  - `test_client.lua:26-35` `command()` waits 5 s for a callback that `client.command` never calls
    on error (`lua/uraeda/client.lua:233-236,264-266`): 4 cases.
  - `test_jumps.lua:52-60` `jump()` waits 1 s three times to show the cursor did not move.
  - `test_actions.lua:195-224`: a hook sleeping 1 s, run for each commit, plus a fixed 200 ms wait;
    fixed waits also at `test_client.lua:133` and `test_verdict.lua:330`.
- Not isolated: `helpers.repo` does not ignore the global git configuration nor clear inherited
  `GIT_*` variables, unlike the Rust and TypeScript helpers; `URA_TODAY`, `URA_NOW` and
  `URAEDA_TEST` are set when the files load and never restored
  ([`helpers.lua`](/editors/nvim/tests/helpers.lua), `test_actions.lua:5,7`, `test_verdict.lua:6`).
- They use `target/debug/ura` without checking it is fresh, the example's specs in 8 of 12 files,
  `fixtures/images`, and mini.test from the flake's `MINI_TEST`.

### The proposal's path and existing actions

- **An agent finishes a task**: it runs `vp run ready` (skill, step 3), which rebuilds and reruns
  everything, whatever the task touched. With caching, unchanged steps would be skipped; with a
  narrower rule in the skill, the agent would run fewer tests, and the rest would run at the final
  review and on CI.
- **A pull request is pushed**: CI installs the shell and dependencies, then runs `ready` in one
  job. Split into jobs, the slowest job sets the time; the merge needs every required check to
  report.
- **A test fails on CI**: today the run fails and the author pushes a fix, since no commit was ever
  rerun. With retries, a test passing on retry would be reported, and pass or fail by policy.
- **A test is slow or flaky**: today it stays in `vp test` until someone removes it, as `ece1127`
  did. With tiers, it could leave the default run.
- **A spec, the skill, or a fixture is edited**: the Rust tests, the binding, the web tests (through
  the binding's freshness check) and the Neovim tests can all break, so any selection by path has to
  follow these links (see [Rules and their owners](#rules-and-their-owners)).

### Rules and their owners

- **What `ready` runs**: [`package.json`](/package.json), under the
  [toolchain decision](/specs/decisions/toolchain.md). Copied in spirit by
  [`ci.yml`](/.github/workflows/ci.yml), which only calls it.
- **What a change can break**, today nowhere: the crate graph (core ← lsp ← cli; core ← binding),
  the skill embedded by `core/build.rs`, the binding's sources listed in
  [`server/src/binding.ts:14-24`](/packages/server/src/binding.ts), the files tests read at run
  time. An affected selection would be a new owner of this map.
- **Which tests may wait or measure time**: the
  [code-quality decision](/specs/decisions/code-quality.md), checked by review only.
- **What an agent runs after a task**: the skill's
  [implementation reference](/skills/uraeda/references/implementation.md), shared by every project
  using Uraeda.

### Likely changes

- [`package.json`](/package.json) and [`vite.config.ts`](/vite.config.ts): `ready` and `test:nvim`
  become `run.tasks`, with inputs, environment and `dependsOn`, under every option of
  [skipping unchanged work](#skipping-unchanged-work).
- [`.github/workflows/ci.yml`](/.github/workflows/ci.yml): jobs and caches, with options B or C of
  [CI layout](#ci-layout).
- [`flake.nix`](/flake.nix) and [`rust-toolchain.toml`](/rust-toolchain.toml): cargo-nextest, and
  `llvm-tools-preview` and cargo-llvm-cov with Rust coverage.
- A new `.config/nextest.toml`, with option A of [the Rust runner](#the-rust-runner).
- [`specs/decisions/toolchain.md`](/specs/decisions/toolchain.md): a proposed change, with nextest,
  tiers, or CI jobs; [`code-quality.md`](/specs/decisions/code-quality.md) with coverage thresholds.
- The skill's implementation reference, its example and templates, with option B of
  [skipping unchanged work](#skipping-unchanged-work).
- Test files under every option: the hazards listed in the three sections above, the Neovim waits,
  and `packages/web/src/__browser__/` and `vite.browser.config.ts` for the browser tests' cost.

### Other features in flight

- `2026-10-14-session-view` changes [`binding/test-utils.ts`](/packages/binding/test-utils.ts) and
  `vite.browser.config.ts` (an `addPlan` command), and its commit `14f77b5` makes "the column's
  tests wait on what they need, not on time": it may fix or move the `session.test.tsx` failures.
- `2026-10-14-text-inputs` adds `fixtures/settled-comments/`. Neither touches `package.json`,
  `vite.config.ts`, CI or `flake.nix` (`git diff --stat main...<branch>`).

## The proposal

### Selecting tests by change, and the skill's rule

The proposal asks to "only run tests relevant to code changes". `vp run ready` runs at every task
because the skill asks for "every test" after each task, a rule for every project using Uraeda, not
only this one. Selecting by change can happen in this repository (caching, so `ready` skips what has
not changed) or in the skill (a narrower rule per task). Vite Task has no affected selection, and
Vitest's `--changed` cannot see Rust, fixtures or the skill (see [Vitest](#vitest)).

### CI failures are not only flakes

The proposal says CI fails "~50% of the time" from flaky tests. 43% of the last 100 runs failed, but
some were real: `ura check specs`, formatting, and maybe the attachments' US3.1. No commit was ever
rerun, so there is no direct measure of flakiness (see [What fails on CI](#what-fails-on-ci)). The
recurring flaky ones are wall-clock assertions and web tests waiting on the page.

### "A CI failure MUST mean an important bug"

Formatting and `ura check` failures fail CI too, and they are not bugs. Read literally, the rule is
about tests: no failure without a defect in the code or the test. Wall-clock checks of success
criteria break it by design, since they measure the runner.

### Parallel runs and the toolchain decision

The proposal asks to run Rust, TypeScript and Lua in parallel. Inside `ready`, Vite Task can run
independent tasks at once (4 by default). Splitting CI into several jobs conflicts with the
toolchain decision's "CI MUST run `vp run ready`", which would need a proposed change.

### Non-critical tests behind a flag

The proposal suggests isolating "non-critical" tests. The toolchain decision says `ready` MUST run
every check; a tier left out of `ready` needs a proposed change, or must run on CI only, which the
decision allows for "checks too slow for every local run". The proposal does not say which tests are
non-critical.

### Coverage of "all the code base"

Rust and TypeScript unit tests have established tools. The WebKit browser tests cannot use the v8
provider, and the Lua plugin has no established path with mini.test. Code reached through a spawned
`ura` or the Node binding may not be counted (see [Coverage tools](#coverage-tools)). The proposal
does not say whether coverage should block anything.

## Approaches

Criteria come from the [proposal](proposal.md) (fast, useful, accurate; a CI failure means a bug),
the [constitution](/specs/CONSTITUTION.md) (VI: tests cover the spec's scenarios, checks never go
back; III: everything recoverable from the repository; V: tools are optional), the
[toolchain decision](/specs/decisions/toolchain.md) (one `ready`, CI runs it, pinned tools), the
[UI checks decision](/specs/decisions/ui-checks.md) (layout checks at both sizes in `ready`), and
the [code-quality decision](/specs/decisions/code-quality.md) (no sleeps or timings in unit tests).

### Flaky test policy

What happens when a test fails without a bug. See [Google](#google),
[Martin Fowler](#martin-fowler), [What fails on CI](#what-fails-on-ci).

| Option                                                  | A CI failure means a bug     | Hides races             | Effort                        |
| ------------------------------------------------------- | ---------------------------- | ----------------------- | ----------------------------- |
| A. No retries: fix or rewrite each flaky test           | Yes, once fixed              | No                      | Each flake is fixed now       |
| B. Retries, flaky reported and failing (`flaky-result`) | Yes, with a clearer report   | No, but slower failures | nextest only; Vitest has none |
| C. Retries, flaky reported and passing                  | No: a race can pass on retry | Yes                     | Small                         |
| D. Quarantine list, run apart, with a deadline to fix   | Yes for the rest             | Inside the list         | A list to keep                |

### Test tiers

Whether slow or non-critical tests leave the default run. See
[non-critical tests behind a flag](#non-critical-tests-behind-a-flag).

| Option                                                                            | Decision change                 | Local speed          | Risk                          |
| --------------------------------------------------------------------------------- | ------------------------------- | -------------------- | ----------------------------- |
| A. One tier: every test in `ready`; timing checks become benchmarks run on demand | None                            | Through caching only | None new                      |
| B. Two tiers: `ready` without browser tests, CI runs them too                     | Toolchain and UI checks changes | Faster per task      | A layout bug found on CI only |
| C. A flag for non-critical tests, run nowhere by default                          | Proposed change                 | Fastest              | Tests that never run rot      |

### Skipping unchanged work

How a task's validation avoids rerunning what its change cannot affect. See [Vite Task](#vite-task),
[the skill's rule](#selecting-tests-by-change-and-the-skills-rule).

| Option                                                                                   | Skill change           | Accuracy                                                          | Effort                          |
| ---------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- | ------------------------------- |
| A. `ready`'s steps become cached Vite Task tasks, run in parallel where independent      | No                     | Exact when inputs are right; misses spuriously on a rebuilt `ura` | Inputs and environment per task |
| B. The skill runs the task's own tests per task, the full validation at the final review | Yes, for every project | Depends on the agent's choice                                     | Skill, templates, example       |
| C. A script mapping changed paths to affected tasks (`git diff`)                         | No                     | As good as its map, a second owner of the dependency graph        | A map to keep in sync           |

### CI layout

How CI uses its 4 vCPUs and its time. See [GitHub Actions](#github-actions),
[CI caches](#ci-caches), [Where the time goes](#where-the-time-goes).

| Option                                                                                    | Time                                      | Decision change | Risk                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- | --------------- | --------------------------------- |
| A. One job running `ready`, with tasks in parallel inside it                              | Bound by 4 vCPUs                          | None            | None new                          |
| B. Parallel jobs (Rust, TypeScript, each browser viewport, Neovim), each in the dev shell | About the slowest job, plus setup per job | Proposed change | More setup, Nix installed per job |
| C. B, with jobs skipped by path filters                                                   | Less on small changes                     | Proposed change | A wrong filter merges a break     |
| D. A or B, restoring Vite Task's cache                                                    | Less on cache hits                        | None            | Experimental; transfer cost       |

### The Rust runner

Whether cargo-nextest replaces `cargo test`. See [cargo-nextest](#cargo-nextest),
[the Rust tests](#the-rust-tests).

| Option                                           | Isolation                              | Hangs                    | Cost                                             |
| ------------------------------------------------ | -------------------------------------- | ------------------------ | ------------------------------------------------ |
| A. nextest, from the flake, with a CI profile    | A process per test                     | Killed by `slow-timeout` | A tool; the decision's `cargo test` rule changes |
| B. Keep `cargo test`, fix the races in the tests | Shared process, races fixed one by one | Hang the run             | None                                             |

### The browser tests' cost

The WebKit tests are the critical path: about 2.3 to 3.4 s per test, every test at two viewports.
See [Where the time goes](#where-the-time-goes).

| Option                                                                                                                       | Time          | Coverage of layouts                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------- |
| A. Layout tests at both viewports, each behaviour test at the size its scenario is about, plus a cheaper repository per test | About half    | Behaviour checked at one size, unless the layouts differ |
| B. Every test at both viewports, with a cheaper repository per test                                                          | Less per test | Unchanged                                                |
| C. Unchanged                                                                                                                 | Unchanged     | Unchanged                                                |

### Coverage

How coverage is measured, and whether it blocks. See [Coverage tools](#coverage-tools).

| Option                                                           | Languages             | Blocks             | Outside service |
| ---------------------------------------------------------------- | --------------------- | ------------------ | --------------- |
| A. A report, locally and as a CI artifact                        | Rust, TypeScript unit | Nothing            | No              |
| B. A, with thresholds that only go up (ratchet), failing `ready` | Rust, TypeScript unit | A drop in coverage | No              |
| C. Uploaded to Codecov, informational                            | Rust, TypeScript unit | Nothing            | Yes             |

Lua and the WebKit tests stay out of every option: no established tool (Lua) and no v8 provider
(WebKit).

### Measuring test value

How to know a test pulls its weight. See [Mutation testing](#mutation-testing), [Spotify](#spotify).

| Option                                         | What it shows                 | Cost              |
| ---------------------------------------------- | ----------------------------- | ----------------- |
| A. A report of the slowest and failing tests   | Cost, and flakiness over time | Small             |
| B. Mutation testing (cargo-mutants), on demand | Code no test checks           | A tool; long runs |
| C. Nothing beyond coverage                     | Lines run, not lines checked  | None              |

### Needs no choice

- **Isolation fixes**: the hazards listed in [the Rust tests](#the-rust-tests),
  [the TypeScript tests](#the-typescript-tests) and [the Neovim tests](#the-neovim-tests) are bugs
  in the tests under the constitution's principle VI and the code-quality decision.
- **Timeouts against hangs**: a CI job timeout, and timeouts in the LSP tests, whatever the runner.
- **Neovim tests' waits**: they wait for the result or the error, not for a timeout, as the proposal
  describes; running each file in its own Neovim, in parallel, is an implementation choice.
- **The report of what failed**: CI already prints each failing test; JUnit files are only useful
  with a service reading them.
- **Nix store caching**: measured, and kept only if faster, as `cache-nix-action` itself advises.

## Not checked

- Whether `cargo llvm-cov` counts the `ura` binary spawned by the CLI tests, and Rust code reached
  through the Node binding: its README does not say.
- An established luacov setup with mini.test: none found.
- Local timings of each step of `ready` on the human's machine: the machine was shared with two
  other worktrees' runs (load about 20 on 32 cores), so timings would have measured that load. CI's
  logs are used instead.
- Which of the 43 failed runs were real failures, beyond the 16 most recent: their logs were not
  read.
- Shopify's flaky-test practices: no source found. Coveralls, local lcov merging, sccache's GitHub
  Actions backend, and pnpm store caching: not read.
