---
status: awaiting-human
---

# Clarifications, round 01: Testing review

> [!IMPORTANT]
>
> 8 questions on the testing review, about 30 minutes.
>
> - Three choices change active decisions: splitting CI into parallel jobs and switching Rust to
>   cargo-nextest change the toolchain decision, and a tier of tests left out of `ready` would
>   change both the toolchain and the UI checks decisions.
> - The flaky test policy and the test tiers work together: they decide what a red CI means, and
>   whether some tests stop running on every change.
> - Skipping unchanged work can happen in this repository or in the skill: the skill's "every test
>   after each task" is why `ready` runs at every task, and changing it changes Uraeda for every
>   project.
> - The proposal's "~50% flaky" is partly real failures: 43 of the last 100 CI runs failed, and the
>   recurring flaky ones are web tests timing the runner or waiting on the page.
> - The WebKit browser tests are the critical path: 8.5 of CI's 15 minutes are `vp test`, and every
>   browser test runs at two sizes.
> - Ten points are settled without you, at the end, mostly test fixes: check them.

## Context

The [proposal](proposal.md) asks for tests that are fast, useful and accurate: run only what a
change can break, run in parallel, never fail on CI without an important bug, measure coverage, and
keep only tests that pull their weight.

Today, `vp run ready` is a single `package.json` script of 15 steps run one after the other and
never cached ([`package.json`](/package.json)), and CI runs it in one job
([`ci.yml`](/.github/workflows/ci.yml)). On CI's 4 vCPUs, the job takes up to 15 minutes: Rust
checks and tests about 1.5 minutes, the Neovim tests 46 seconds, and `vp test` 8.5 minutes, most of
it the WebKit tests at a phone size and a desktop size. 948 TypeScript tests, 552 Rust tests and 81
Neovim cases exist; no coverage is measured. An agent runs `ready` after every task, because the
skill's [implementation step](/skills/uraeda/references/implementation.md) asks for "every test".

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What does this feature cover?

The proposal lists five goals: fewer failures without a bug, skipping unchanged work, parallel runs,
coverage, and tests that pull their weight. Rust and TypeScript have established coverage tools; the
WebKit tests and the Lua plugin do not. Mutation testing (cargo-mutants) shows code that can change
without any test failing, a stronger measure of a test's value than coverage, but its runs are long.
More in [discovery](discovery-01.md#coverage-tools) and
[measuring test value](discovery-01.md#measuring-test-value).

Why it matters: it sets the size of this feature, and what waits for a later one.

- **A (recommended). Reliability, speed and parallel runs, plus coverage reports for Rust and the
  TypeScript unit tests. Lua coverage, WebKit coverage and mutation testing wait for a later
  feature.**
  - [pro] every goal of the proposal gets a first answer, with established tools only.
  - [con] the plugin's Lua and the browser tests stay unmeasured.
  - Why recommended: the flakes and the time are the urgent problems; coverage is cheap to add with
    the same changes, and the rest needs tools nobody has proven here.
- **B. A, plus cargo-mutants on demand for the Rust code.**
  - [pro] a first measure of which Rust tests actually check something.
  - [con] a new tool, and long runs to read and act on, in an already large feature.
- **C. Reliability, speed and parallel runs only: coverage and test value become their own
  feature.**
  - [pro] the smallest feature, done soonest.
  - [con] the proposal's coverage goal waits.

**Answer:**

### Q1.A: What does coverage do once it is measured?

Only if you picked A or B in Q1. Vitest can raise its thresholds as coverage grows
(`thresholds.autoUpdate`), and cargo-llvm-cov can fail under a threshold, so a ratchet like the
code-quality decision's is possible. Codecov merges reports per language, but it is an outside
service receiving the project's coverage. More in [discovery](discovery-01.md#coverage).

- **A (recommended). A report only: `vp run coverage` writes it locally, and CI keeps it as an
  artifact. Nothing fails on a drop.**
  - [pro] no new rule, no outside service, and the numbers are there to read.
  - [con] coverage can go down unnoticed.
  - Why recommended: a first measure shows where coverage stands before deciding a rule on it.
- **B. Thresholds that can only go up, failing `ready` when coverage drops, added as a rule of the
  code-quality decision.**
  - [pro] coverage never goes back, as the constitution asks of measured checks.
  - [con] a deleted dead branch or a refactor can fail `ready`, and coverage runs slow every
    `ready`.
- **C. Uploaded to Codecov on every pull request, as an informational status.**
  - [pro] coverage of the change shown on the pull request, merged across languages.
  - [con] an outside service, a token in CI, and the project's coverage published there.

**Answer:**

## Q2: What happens when a test fails without a bug?

No CI run was ever retried: every failure was fixed by a new commit. The recurring flaky failures
are wall-clock assertions, already removed once by commit `ece1127`, and web tests that did not find
a button in time. Google's data shows retries and quarantine "could easily mask a real race
condition"; nextest can report a test that passes on retry and still fail the run
(`flaky-result = "fail"`), Vitest cannot. How this combines with tiers is Q3. More in
[discovery](discovery-01.md#flaky-test-policy) and
[what fails on CI](discovery-01.md#what-fails-on-ci).

Why it matters: it decides whether a red CI always means "look at the code", as the proposal asks.

- **A (recommended). No retries anywhere: a test that fails without a bug is fixed or rewritten in
  the same pull request that finds it, and wall-clock checks leave the tests for benchmarks run on
  demand.**
  - [pro] a red CI always means a defect, in the code or in a test, and races are never hidden.
  - [con] a flaky test blocks merges until it is fixed.
  - Why recommended: it is the proposal's rule, and the flakes found so far all have causes that can
    be fixed.
- **B. Retries on CI, with a test that passes on retry reported as flaky and still failing the run
  (nextest's `flaky-result = "fail"`, a custom check for Vitest).**
  - [pro] the report says at once whether a failure is flaky.
  - [con] slower failing runs, and a custom check to write for Vitest.
- **C. Retries on CI, with a test that passes on retry passing the run.**
  - [pro] merges are never blocked by a flake.
  - [con] a real race passes on its second try, against the proposal's rule.
- **D. A quarantine list: flaky tests run in a separate, non-blocking step, each with a deadline to
  be fixed.**
  - [pro] merges are unblocked, and the flakes stay visible.
  - [con] a list to keep, and a bug in a quarantined area goes unnoticed until the deadline.

**Answer:**

## Q3: Should some tests leave the default run?

The proposal suggests putting "non-critical" tests behind a flag. The toolchain decision says
`ready` MUST run every check, and the UI checks decision that `ready` MUST run the layout and
accessibility checks in WebKit at both sizes. The decision does allow checks "too slow for every
local run" on CI only. Locally, `ready` took about 2 minutes on your machine. More in
[discovery](discovery-01.md#test-tiers).

Why it matters: a tier that does not run on every change is where failures are found late, or never.

- **A (recommended). One tier: every test runs in `ready` and on CI. Slow tests are made faster
  (Q7), and unchanged work is skipped (Q4).**
  - [pro] no decision changes, and every change is checked by every test.
  - [con] a change to the web UI still runs every browser test.
  - Why recommended: with no retries (A in Q2), a test that runs rarely is the one that breaks
    unnoticed; speed is better won by caching and cheaper tests.
- **B. Two tiers: `ready` leaves out the WebKit tests, which run on CI and in a separate
  `vp run ready:browser`.**
  - [pro] faster local runs for web changes.
  - [con] proposed changes to the toolchain and UI checks decisions, and a layout bug found only on
    CI.
- **C. A flag for non-critical tests, which run only when asked for, anywhere.**
  - [pro] the fastest runs.
  - [con] tests that never run rot, and someone has to say which tests are non-critical.

**Answer:**

## Q4: How does a task skip the work its change cannot affect?

`ready` reruns everything because it is a `package.json` script, which Vite Task never caches. As
cached tasks in `vite.config.ts`, with their inputs listed, a change to the web UI would skip the
Rust, Neovim and binding steps, and independent tasks would run in parallel. A narrower rule in the
skill would change Uraeda for every project. Neither Vite Task nor Vitest can see that a skill or
fixture edit breaks a Rust or Neovim test, so any selection by path needs this repository's map of
what reads what. More in [discovery](discovery-01.md#skipping-unchanged-work) and
[the skill's rule](discovery-01.md#selecting-tests-by-change-and-the-skills-rule).

Why it matters: this is the proposal's hour lost per feature.

- **A (recommended). `ready`'s steps become cached Vite Task tasks with explicit inputs, run in
  parallel where they are independent; the skill keeps "every test" after each task.**
  - [pro] the same command, and the skill unchanged; a task touching only Rust or only docs skips
    most of the run.
  - [con] a web change still reruns the whole `vp test`; a rebuilt `ura` that is not byte-identical
    causes spurious misses.
  - Why recommended: it keeps the one-command rule, and skipping is exact as long as the inputs are
    right.
- **B. The skill asks for the task's own tests after each task, and every test at the final review
  and on CI.**
  - [pro] the fastest per task, in every project using Uraeda.
  - [con] a break in another area is found at the end of the feature, and the agent chooses what to
    run; the skill, its templates and its example change too.
- **C. A script that maps the changed paths (`git diff`) to the tasks they affect.**
  - [pro] skips more than caching, such as a whole `vp test` for a Rust-only change that the binding
    does not see.
  - [con] a second home for the dependency map, wrong as soon as a test reads a new file.

**Answer:**

## Q5: How should CI run the checks?

CI runs `ready` in one job on a 4-vCPU runner, so the browser tests of both sizes and the unit tests
share 4 cores. Separate jobs run at once, each with its own 4 vCPUs, but each installs Nix and the
dependencies (about 1.3 minutes today) and rebuilds the binding. The toolchain decision says CI MUST
run `vp run ready`: options B and C need a proposed change saying CI runs every task of `ready`,
split across jobs. A job skipped by a path filter reports success, so a wrong filter merges a break.
More in [discovery](discovery-01.md#ci-layout).

Why it matters: this is the 15 minutes per run, and it lasts for every later feature.

These options combine: D can come on top of A or B.

- **A (recommended). Parallel jobs, each in the dev shell: Rust, TypeScript unit tests, the browser
  tests at each size, Neovim, and the release checks; no path filters.**
  - [pro] about the slowest job plus setup, likely under half of today's time; every check runs on
    every change.
  - [con] a proposed change to the toolchain decision, and several setups per run, which the Nix
    store cache only helps if it proves faster.
  - Why recommended: it is the largest saving without skipping any check.
- **B. One job, as today, with `ready`'s tasks running in parallel inside it (with A in Q4).**
  - [pro] no decision change, the simplest CI.
  - [con] still bound by 4 vCPUs, with the browser tests as the critical path.
- **C. A, with jobs skipped by path filters when their area did not change.**
  - [pro] the fastest on small changes.
  - [con] the filters copy the map of what reads what, and a wrong one merges a break.
- **D. Restoring Vite Task's cache on CI, so tasks whose inputs did not change are skipped there
  too.**
  - [pro] skips unchanged work on CI with no map to keep.
  - [con] experimental in Vite+, and its download can cost more than it saves.

**Answer:**

## Q6: Should Rust tests run with cargo-nextest?

The Rust tests take under a minute on CI, so speed is not the reason. cargo-nextest runs each test
in its own process, which removes the shared-environment race found in the LSP tests, kills a hung
test after a timeout, and reports slow tests. It is a new tool in the flake, and the toolchain
decision says Rust code MUST pass `cargo test`, which would change. More in
[discovery](discovery-01.md#the-rust-runner).

Why it matters: it decides how Rust tests are isolated and timed out from now on.

- **A (recommended). Run the Rust tests with cargo-nextest, pinned by the flake, with a CI profile
  that times out hung tests and fails on leaked processes; `cargo test` keeps working.**
  - [pro] isolation and timeouts for every future Rust test, and coverage through
    `cargo llvm-cov nextest`.
  - [con] a new tool, and a proposed change to the toolchain decision.
  - Why recommended: it fixes a class of races instead of one race, at little cost.
- **B. Keep `cargo test`, and fix the race and add timeouts in the tests themselves.**
  - [pro] no new tool, no decision change.
  - [con] the next test that sets the environment or hangs repeats the problem.

**Answer:**

## Q7: Should every browser test run at both sizes?

Every WebKit test runs at 402 × 874 and at 1440 × 900, and each costs 2.3 to 3.4 seconds, mostly
building its fixture repository with git. The UI checks decision requires the layout and
accessibility checks at both sizes, not the behaviour tests, such as dropping an image. Making the
repository cheaper applies to every option. More in
[discovery](discovery-01.md#the-browser-tests-cost).

Why it matters: the browser tests set CI's time, whatever the answer to Q5.

- **A (recommended). Layout and accessibility checks at both sizes; each behaviour test at the size
  its scenario is about, and at both only when the two layouts behave differently.**
  - [pro] about half the browser time, within the UI checks decision.
  - [con] a behaviour that breaks at one size only is missed when the test does not say so.
  - Why recommended: the two layouts differ in where things are, which the layout checks cover, more
    than in what they do.
- **B. Every test at both sizes, as today, only with a cheaper repository per test.**
  - [pro] nothing is checked less.
  - [con] the browser tests stay the critical path.

**Answer:**

## Settled without the human

- **Timing assertions** leave the unit tests, as the code-quality decision requires: the success
  criteria they measure (LSP diagnostics in 300 ms, `ura status` in 5 s, live updates, image bombs)
  become benchmarks in a `vp run bench` task, run on demand, as `ece1127` began. See
  [discovery](discovery-01.md#the-rust-tests).
- **Isolation fixes** are made in the tests: the LSP tests' environment race, the core's git calls
  ignoring the host's git configuration in tests, the Neovim tests' git isolation and environment,
  the browser setup's variables leaking into the Node projects, and the repository's `.env` no
  longer read by tests. See [discovery](discovery-01.md#needs-no-choice).
- **Tests that print errors without failing** ("database is locked", "Failed to fetch", an unhandled
  server error) are fixed, since one already failed a run whose tests all passed. See
  [discovery](discovery-01.md#what-fails-on-ci).
- **Hangs** are bounded: a `timeout-minutes` on every CI job, and timeouts in the LSP tests that
  have none. See [discovery](discovery-01.md#the-rust-tests).
- **The Neovim tests** wait for the result or the error, never for a timeout to run out, and each
  test file runs in its own headless Neovim, in parallel, from a small runner. See
  [discovery](discovery-01.md#the-neovim-tests).
- **The `session.test.tsx` failures** are checked again once `2026-10-14-session-view` merges, since
  that branch rewrites those tests' waits; only what still fails is fixed here. See
  [discovery](discovery-01.md#other-features-in-flight).
- **The root-only skip** in `cli/tests/install.rs` stays: CI does not run as root. See
  [discovery](discovery-01.md#the-rust-tests).
- **The Nix store cache** is added to CI only if a measured run is faster with it, as
  `cache-nix-action` itself advises. See [discovery](discovery-01.md#ci-caches).
- **vite-plus** is upgraded from 1.0.0 to 1.2.0 if the cached tasks need its cache report
  (`vp run --last-details`) to explain misses. See [discovery](discovery-01.md#vite-task).
- **A report of the slowest tests** comes from the runners' own output (nextest's slow-test report,
  Vitest's durations), with no new tool. See [discovery](discovery-01.md#measuring-test-value).

**Notes:**
