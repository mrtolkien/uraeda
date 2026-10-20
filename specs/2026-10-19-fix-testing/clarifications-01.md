---
status: answered
---

# Clarifications, round 01: Fix testing

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes. The cull and the faster loop are right. They conflict
>   with the constitution's test-per-scenario rule and the toolchain's "run everything after every
>   task".
> - The constitution's rule about tests is the root of the volume, and only you can amend it.
> - The speed budget and the cull's size work together: you set both.
> - The loop after each task changes the toolchain decision, which lasts beyond this feature.
> - Wording alone does not stop agents bending a product to a test: the evidence asks for a check
>   too.
> - Settled points to check: Rust tests are kept almost whole, and retries stay forbidden.

## Context

### Goal

You want a smaller suite of meaningful tests that checks the core behaviour and several systems at
once. You want skill wording that makes agents write such tests and never bend your intent to a
failing test. You want a fast loop that does not trade away quality. It is for you and the agents
that build Uraeda.

### Today

CI takes 12 to 16 minutes and failed 15 of its last 20 finished runs. The repository holds about
77,700 lines of tests.

| Area                                                              | Tests | Time in CI                             |
| ----------------------------------------------------------------- | ----- | -------------------------------------- |
| Web UI, happy-dom, each test builds a git repository and a server | 957   | 2,058 s summed, about 690 s of the job |
| Server                                                            | 852   | 395 s summed                           |
| Browser, phone and desktop                                        | 611   | 296 s and 408 s                        |
| Rust                                                              | 1,006 | 51 s                                   |
| Neovim                                                            | 120   | about 3 minutes, CI only               |

Most failures in the ten latest failed runs were tests pinned to text, counts, or pixel sizes that
the product had changed. Examples are a home page test asserting "Needs you3", an accessibility
check on a 38 px size, and a test that `SKILL.md` stays under 20,000 characters. The skill and the
constitution make this volume. They ask a test per spec scenario, a break made by hand for every
test, and page checks at two sizes. Details are in [the code](discovery-01.md#the-code).

### Scope

Covered: culling tests in all four languages, the skill's testing wording, and a faster loop. Left
out: new test tools, Storybook as UI tests (its own draft), and the product's behaviour.

### Sources

- [`vite.tasks.ts`](/vite.tasks.ts), [`ci.yml`](/.github/workflows/ci.yml), a full green CI log, and
  the 10 latest failed runs.
- The [constitution](/specs/CONSTITUTION.md), the [toolchain](/specs/decisions/toolchain.md),
  [UI checks](/specs/decisions/ui-checks.md), and [code quality](/specs/decisions/code-quality.md)
  decisions, and the skill's testing wording.
- Google's testing book, Fowler, Beck, Dodds, ImpossibleBench, METR, EvilGenie, SpecBench, Claude
  Code's best practices, Vitest, nextest, cargo-mutants, and Playwright documentation.
- The full investigation is in [discovery](discovery-01.md).

## Q1: Should the constitution still require a test for every acceptance scenario?

Constitution VI says "Implementations MUST include tests covering the spec's acceptance scenarios".
The skill turns that into a test per scenario and edge case, and 838 tests carry a story or
criterion tag. A spec may hold 30 scenarios, so one feature adds dozens of tests, each of which
later needs maintaining. Culling to meaningful tests contradicts this rule as written. Only you can
amend the constitution. Google's testing book and Fowler argue for tests per behaviour that matters,
and for dropping the rest. More in
[discovery](discovery-01.md#constitution-vi-and-the-number-of-tests).

Why it matters: the rule decides how many tests every future feature adds. Left alone, the skill
rewrite fights it, and the suite grows back.

- **A (recommended). Amend the constitution so tests cover the behaviour that matters: each story's
  main scenarios and the edge cases marked `high`. Other scenarios are checked by review or by
  sharing an existing test.**
  - [pro] tests grow with risk, not with the spec's length.
  - [pro] the spec already marks edge-case importance, so no new field.
  - [con] a normal edge case can lose its test, and regress unseen.
  - Why recommended: it matches the evidence on value per test. A missed normal case costs less than
    a failing suite.
- **B. Keep the rule, and meet it with fewer tests: scenarios become rows of a few flow tests.**
  - [pro] every scenario stays covered.
  - [con] flow tests grow long, and one failing row hides the others.
- **C. Keep the rule, and cull only the existing noise.**
  - [pro] no amendment.
  - [con] agents keep adding a test per scenario, so the suite grows back.

**Answer:** A: Advise me on what to change, let's improve the constitution

### Q1.A: Which scenarios besides the main ones need a test?

Only if you picked A in Q1. A spec marks each edge case `high`, `normal`, or `niche`. Success
criteria are checkable by a test or a benchmark.

Why it matters: it sets the line between tested and reviewed cases for every spec.

- **A (recommended). Main scenarios of every story, `high` edge cases, and success criteria.
  `normal` and `niche` edge cases get a test only as a line in a test that exists.**
  - [pro] clear to apply from the spec alone.
  - [con] a `normal` edge case seldom gets its own test.
  - Why recommended: it follows the importance the spec already carries.
- **B. Also every `normal` edge case; only `niche` cases are exempt.**
  - [pro] fewer unguarded cases.
  - [con] about twice the edge-case tests of A.

**Answer:** A

## Q2: How much should the cull remove, and by what rule?

Nothing measures a "useful" test yet, and "faster" has no end without a size. The evidence gives
rules. Keep a test only if it fails when behaviour that matters breaks. It must pass when structure
changes ([Google ch. 12](https://abseil.io/resources/swe-book/html/ch12.html),
[Beck](https://testdesiderata.com/)), and drop one that duplicates a faster test's path. In the
repository the clearest candidates are tests asserting exact text, counts, or pixel sizes. Others
test one scenario in several layers, or only observe. The Rust suite is fast (51 seconds), so the
weight is in the web UI and browser tests. More in
[discovery](discovery-01.md#the-culls-size-and-rule).

Why it matters: this sets how many tests go, and whether a test that is merely slow or tedious
survives.

- **A (recommended). Delete by written criteria, the same in every area and language. A test goes if
  it fails on a refactor, duplicates a faster test's path, asserts text, counts, or sizes, or only
  observes.**
  - [pro] the most evidence behind it, and each deletion has a stated reason.
  - [pro] the result is a size that follows from the rules, likely half of the web UI's tests.
  - [con] no fixed target, so the run time cannot be promised.
  - Why recommended: a cap would delete good tests as readily as bad ones.
- **B. Delete to a budget: CI under 5 minutes and the fast loop under 1 minute, trimming the slowest
  low-value tests until the budget holds.**
  - [pro] a measurable end.
  - [con] the edge of the budget is arbitrary, and a valuable slow test can go.
- **C. Delete all suites and write a small set of flows across systems from the existing specs.**
  - [pro] the cleanest result, built for the new rules.
  - [con] the riskiest: nothing guards the product while it is rewritten.

**Answer:** C: You'll be running all night and no other development will take place. Let's make it
as clean as possible.

## Q3: Should an agent run a fast command after each task, and the full check only before pushing?

The toolchain decision runs one cached command, `vp run ready`, "after every task", and
[`implementation.md`](/skills/uraeda/references/implementation.md) says to run it before each
commit. A cached rerun is fast only when a task touches few inputs; any change under `packages/`
reruns all TypeScript and both browser projects. Vitest's `related` and `--changed` run only tests
reaching changed files. Both miss dynamic imports and non-JavaScript inputs, such as the Rust code
behind the binding ([CLI](https://vitest.dev/guide/cli)). More in
[discovery](discovery-01.md#two-loops).

Why it matters: it changes the active toolchain decision, which lasts beyond this feature, and sets
how long every agent waits per task.

- **A (recommended). Add a fast command for after each task: formatting, lint, types, the touched
  crates' Rust tests, and the related TypeScript tests. `ready` runs before pushing and in CI.**
  - [pro] an agent waits seconds, not minutes, per task.
  - [con] a task can break a test that only `ready` finds, later and further from its cause.
  - Why recommended: CI keeps the full check, so nothing merges unchecked, and the cull then makes
    `ready` itself shorter.
- **B. Keep one command, `ready`, after every task, and rely on the cull alone to make it fast.**
  - [pro] nothing new to learn or maintain.
  - [con] still minutes per task if the suite stays large.
- **C. Make `ready` itself select tests with `--changed`.**
  - [pro] one command.
  - [con] a green `ready` could skip a test a change broke, so it stops meaning "everything passes".

**Answer:** A

## Q4: Which browser tests should stay?

The UI-checks decision requires `ready` to check every page at a phone and a desktop size, in both
themes, for readability and accessibility. The browser projects run 611 tests in WebKit and take 296
and 408 seconds in CI. `layout.test.tsx` alone has 83 tests per size. One failed run broke an
accessibility check on a measured 38 px size after content changed. Playwright's own guidance is to
test user-visible behaviour and run only the browsers needed, and gives no ratio. More in
[discovery](discovery-01.md#browser-tests).

Why it matters: browser tests are the slowest and the least stable layer, and keeping them as they
are keeps CI near 10 minutes.

- **A (recommended). Keep the page checks the decision requires, at both sizes and in both themes.
  Delete browser tests that repeat a happy-dom test, assert measured pixels, or drive a flow that
  happy-dom already covers. Browser tests run in CI and when a task changes layout, not after every
  task.**
  - [pro] the decision stays satisfied, and the slowest layer shrinks.
  - [con] a layout regression in a flow that left the browser suite is caught later or by review.
  - Why recommended: it keeps what needs a real layout, and nothing else.
- **B. Leave the browser tests as they are, and only cull the happy-dom ones.**
  - [pro] no risk to layout checks.
  - [con] CI stays slow and the pixel-pinned failures stay.
- **C. Drop the browser tests and rely on the screenshots the agent reviews.**
  - [pro] the fastest option.
  - [con] it breaks the UI-checks decision's page-check rule, and needs your amendment.

**Answer:** A

## Q5: Which tests of tooling, Neovim, and benchmarks stay?

Some tests guard the tooling, not the product: `toolchain.test.ts` (696 lines, the config's rules),
the lint fixtures, the skill-length test, and the test-runner script's tests. The 120 Neovim tests
run only in CI, about 3 minutes, and you earlier called them "extremely secondary" when scoping the
testing review. The benchmarks package has 97 tests of its own. More in
[discovery](discovery-01.md#tests-of-tooling-neovim-and-benchmarks).

Why it matters: these suites fail on legitimate changes the most, such as the 20,000-character test,
and guard the least.

- **A (recommended). Apply the criteria of the first question. Keep a tooling test only where it
  enforces an active decision's rule. Cut the Neovim tests to a smoke of the plugin's main
  actions.**
  - [pro] fewer failures of unrelated checks, and CI loses minutes.
  - [con] the plugin's rarer behaviours are no longer guarded.
  - Why recommended: the plugin is rarely touched, and its logic lives behind `ura lsp`, which Rust
    tests.
- **B. Apply the criteria to tooling and benchmarks, and leave Neovim whole.**
  - [pro] the plugin stays covered.
  - [con] keeps 3 minutes of CI for the least-used code.
- **C. Drop the Neovim tests entirely.**
  - [pro] the fastest.
  - [con] a plugin change can break the editor unseen.

**Answer:** A

## Q6: How should the skill's testing wording change?

Today the skill makes tests multiply. It asks a Test map line per scenario, a hand-made break
reported for every test, and a browser test per UI story. It also tells agents "never change a test
or an expected value to make a run pass". Research says wording helps, but not enough. Claude models
mostly cheat by editing tests (over 79% of their cheating in
[ImpossibleBench](https://arxiv.org/html/2510.20270v1)). An explicit "this task is impossible" exit
cut GPT-5's cheating from 54% to 9%. More in
[discovery](discovery-01.md#skill-wording-and-protecting-tests).

Why it matters: this is the lasting fix for what agents write. It also decides whether a test that
fails against your request makes the agent stop and ask.

- **A (recommended). Rewrite the testing rules around behaviour. Each test names the behaviour that
  matters. Tests come from the spec, with real objects over mocks. A bug starts with a failing test.
  A test that conflicts with the request makes the agent stop and report, never edit the test or
  bend the product. The hand-made break is only for risky tasks.**
  - [pro] fewer, sharper tests, and an explicit exit when a test and your intent differ.
  - [con] agents write fewer tests, so a gap depends on the rules being followed.
  - Why recommended: it covers every cause the evidence lists, in the workflow's own files.
- **B. Only add the guard: never edit a test to pass, and stop on a conflict. Keep the
  test-per-scenario flow.**
  - [pro] a small change.
  - [con] volume keeps growing.

**Answer:** A

## Q7: Should the final review check test changes separately from the product's?

Wording is advisory: METR found "don't cheat" prompts changed one task's rate not at all (80% with
and without). A checked step can be deterministic. A practitioner post proposes a CI gate that
blocks a merge when the assertion count drops, and a commenter notes it misses an edited threshold.
Anthropic's best practices say instructions are advisory and hooks are deterministic. More in
[discovery](discovery-01.md#skill-wording-and-protecting-tests).

Why it matters: this is how you find out, without reading every diff, that an agent loosened a test.

- **A (recommended). The final review lists, apart from the product's diff, every test removed,
  skipped, or changed in what it expects, with its ruling. The pull request's description repeats
  the list.**
  - [pro] no tool, and you see every weakened test in one place.
  - [con] relies on the reviewing agent reading the diff completely.
  - Why recommended: tools must stay optional, and this puts the check where you already look.
- **B. Wording only, as in Q6.**
  - [pro] nothing more to read.
  - [con] a loosened test is visible only if you open the diff.
- **C. Add a check to `ura` or to CI that fails when a test file loses assertions or gains a skip.**
  - [pro] deterministic.
  - [con] a new tool rule, easy to bypass by editing a threshold, and Constitution V says tools only
    enforce what agents can follow unaided.

**Answer:** A

## Q8: Should the cull be approved before it is deleted?

A cull of this size removes hundreds of tests across areas, and you cannot read each one. The plan
will list the criteria from Q2, and the implementation deletes by area.

Why it matters: it sets how much of your time the cull takes, and how much trust it gets.

- **A (recommended). The agent deletes by the approved criteria, one commit per area. The record
  lists what went by each rule, with counts, so you can sample any area.**
  - [pro] no extra round, and each deletion is a revertible commit.
  - [con] a good test could go unnoticed until a regression shows it.
  - Why recommended: git keeps every deleted test, and you approved the criteria.
- **B. You review the list of tests to delete per area, in a round of questions before the
  deletion.**
  - [pro] full control.
  - [con] hundreds of test names to read, and several rounds.

**Answer:** A

## Settled without the human

### Check these

- **Rust tests are kept almost whole.** Rust's 1,006 tests run in 51 seconds and make the central
  contract (real git, real files) testable; only tests matching the criteria go. See
  [discovery](discovery-01.md#the-code).
- **Retries stay forbidden.** The toolchain decision already says so, and Google, Fowler, and
  nextest's docs agree that retries hide the cause. See
  [discovery](discovery-01.md#needs-no-choice).
- **No mutation tool for this feature.** `cargo mutants` stays on the Later list; the cull uses the
  criteria, and Stryker cannot cover the browser tests. See
  [discovery](discovery-01.md#mutation-testing).
- **Tests of active decisions are kept.** A test that is the "Checked by" of an active decision's
  rule survives unless that decision changes; 48 rules end with such a check. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

### Behaviour

- **Storybook as UI tests** stays out: its draft conflicts with the UI-checks and preview decisions
  and is its own feature. See [discovery](discovery-01.md#needs-no-choice).

### Under the hood

- **Rust integration binaries** are not consolidated: the gain is compile time, and the run is 51
  seconds. See [discovery](discovery-01.md#needs-no-choice).
- **Test isolation** stays: the web tests keep per-file isolation, since sharing it would share
  global state. See [discovery](discovery-01.md#vitest).

**Notes:**
