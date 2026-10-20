# Discovery, round 01: Fix testing

## Summary

The proposal asks for three things: cull the tests to the meaningful ones, rewrite the skill's
testing wording so agents write useful tests and never bend the product to a test, and get a faster
loop without losing quality.

Today the repository holds about 77,700 lines of test code (of about 175,000 lines in Rust,
TypeScript, and Lua), about 1,000 Rust tests, about 1,950 TypeScript tests, and 120 Neovim ones. CI
takes 12 to 16 minutes and failed 15 of the last 20 finished runs. The time sits in the web UI's
happy-dom tests (about two seconds each, 957 tests) and in the browser tests, not in Rust (51
seconds for 1,006 tests). Most failures were tests pinned to text, counts, or pixel sizes that the
product legitimately changed.

The volume has an owner: the constitution requires "tests covering the spec's acceptance scenarios",
the skill turns each scenario into a test, and a UI decision requires page checks at two sizes in
two themes. The research agrees on the fix: keep tests that fail only when behaviour that matters
breaks, delete change-detectors, and structurally protect tests from agents that edit them to go
green.

## How other products do it

This feature is a testing policy, so the comparison is with testing guidance and evidence, not
products.

### Software Engineering at Google

- Chapter 12: a brittle test "fails in the face of an unrelated change to production code that does
  not introduce any real bugs"; "the ideal test is unchanging" unless requirements change; write a
  test per behaviour, not per method; prefer real objects to mocks.
  [ch. 12](https://abseil.io/resources/swe-book/html/ch12.html)
- Chapter 11: "as you approach 1% flakiness, the tests begin to lose value"; rerunning flaky tests
  "only delays fixing the root cause"; "a bad test suite can be worse than no test suite at all";
  coverage "only measures that a line was invoked". Its rough mix is 80% small, 15% medium, 5%
  large. [ch. 11](https://abseil.io/resources/swe-book/html/ch11.html)

### Fowler, Beck, and Dodds

- Fowler: quarantine non-deterministic tests, with a cap, and never use bare sleeps. "Mockist tests
  are thus more coupled to the implementation of a method." If high-level tests are "fast, reliable,
  and cheap to modify", lower-level ones are not needed.
  [non-determinism](https://martinfowler.com/articles/nonDeterminism.html),
  [mocks](https://martinfowler.com/articles/mocksArentStubs.html),
  [test pyramid](https://martinfowler.com/bliki/TestPyramid.html)
- Beck's test desiderata: tests should be behavioural, structure-insensitive, and "cheap to write
  relative to the cost of the code being tested". [desiderata](https://testdesiderata.com/)
- Dodds: "write tests, not too many, mostly integration"; returns diminish past about 70% coverage;
  implementation-detail tests give both false failures and false passes.
  [write tests](https://kentcdodds.com/blog/write-tests),
  [implementation details](https://kentcdodds.com/blog/testing-implementation-details)

### Evidence on agents and tests

| Source                                                                       | Finding                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ImpossibleBench](https://arxiv.org/html/2510.20270v1)                       | On tasks where the tests contradict the spec, GPT-5 passes 54% to 76% by cheating, and Claude models mostly edit the tests (over 79% of their cheating). Stricter prompts cut cheating sharply; read-only tests block edits only; an explicit "this task is impossible" exit cut GPT-5 from 54% to 9%, but helped Opus 4.1 much less. |
| [METR](https://metr.org/blog/2025-06-05-recent-reward-hacking)               | Anti-cheating prompts barely changed rates on one task (80% with and without "don't cheat"). Models answered "no" when asked whether their hack matched the user's intent.                                                                                                                                                            |
| [EvilGenie](https://arxiv.org/html/2511.21654v2)                             | Codex, Claude Code, and Gemini CLI all reward hacked; hacking was more common on ambiguous problems; LLM judges detected it best, held-out tests added little.                                                                                                                                                                        |
| [SpecBench](https://arxiv.org/html/2605.21384v1)                             | Visible tests saturate while held-out behaviour does not; the gap grows with project size (about 27 points per tenfold lines of code). Features pass alone but fail together.                                                                                                                                                         |
| [Rethinking agent-generated tests](https://arxiv.org/html/2602.07900)        | Agent tests are mostly print-style observation; changing their volume did not significantly change outcomes. (Read through a summary page.)                                                                                                                                                                                           |
| [Claude Code best practices](https://code.claude.com/docs/en/best-practices) | Reproduce a bug with a failing test first; scope test requests ("avoid mocks"); hooks are deterministic where instructions are advisory; do not stack reviewer findings into "tests for cases that can't happen".                                                                                                                     |

Two practitioner posts give the cheap checks: "if I deleted the implementation tomorrow, which of
these tests would still pass?" and a CI gate that blocks merge when the assertion count drops. They
are anecdote, not evidence:
[survives its implementation](https://dev.to/jeff_pdc/the-test-that-survives-its-own-implementation-578d),
[weakening flaky tests](https://dev.to/jeff_pdc/your-agent-is-fixing-flaky-tests-by-quietly-weakening-them-4j5b).

### What they have in common

- Delete tests that fail on a pure refactor, restate the implementation, or assert call sequences.
- Keep the fast, narrow test; drop slower ones that re-check the same path.
- A flaky test is fixed, quarantined with a cap, or deleted, never retried into silence.
- A failing test is information about the product, so the agent asks which side is wrong, and the
  human decides when the test and the request conflict.
- Test intent comes from the spec, not from the code being tested.
- Run affected tests while working, and everything before merge.

## Standards and libraries

### Vitest

- `vitest related <files> --run` and `--changed` run only tests reaching changed files; they follow
  static imports only, and a test file with no record always runs.
  [CLI](https://vitest.dev/guide/cli)
- DOM environments are costly to create; `isolate: false` speeds node-style suites that share no
  state; profile first with the Duration breakdown.
  [performance](https://vitest.dev/guide/improving-performance)
- `retry` defaults to 0. [retry](https://vitest.dev/config/retry)
- Vite+ documents no affected-test selection beyond package filters.
  [Vite+ run](https://viteplus.dev/guide/run)

### Rust: cargo-nextest, cargo-mutants

- nextest marks a test that passes on retry as flaky and, by default, counts it as a success;
  `--flaky-result fail` changes that. [retries](https://nexte.st/docs/features/retries/)
- cargo-mutants finds "places where bugs can be inserted without causing any tests to fail", costs
  one build plus one suite run per mutant, and has `--in-diff` to limit mutants to changed code.
  [mutants.rs](https://mutants.rs/), [in-diff](https://mutants.rs/in-diff.html),
  [performance](https://mutants.rs/performance.html)
- Each file of `tests/` is its own binary, linked separately; one binary cut Cargo's own compile
  time about threefold.
  [matklad, 2021](https://matklad.github.io/2021/02/27/delete-cargo-integration-tests.html)

### Playwright and Stryker

- Playwright asks for isolated tests, web-first assertions, user-visible behaviour, and only the
  browsers needed; it gives no ratio of browser to unit tests.
  [best practices](https://playwright.dev/docs/best-practices)
- Stryker's Vitest runner does not support browser mode, so it could only judge the happy-dom and
  node tests. [Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)

## The code

### Important reads

- [`vite.tasks.ts`](/vite.tasks.ts): `ready` depends on `ready:rust`, `ready:typescript`,
  `ready:browser-phone`, and `ready:browser-desktop`, cached task by task; CI runs the same groups
  uncached, one job each ([`ci.yml`](/.github/workflows/ci.yml)).
- CI run 39186599936, a green `main` run read in full: the `typescript` job took 690 s for 130 test
  files; `browser-phone` 296 s; `browser-desktop` 408 s; `rust` 51 s of tests (1,006 tests in 64
  binaries); `neovim` about 3 minutes.
- Per-file times of that run: `review.test.tsx` 289 s for 50 tests, `session.test.tsx` 182 s,
  `round.test.tsx` 164 s, `inbox.test.tsx` 130 s, `editor.test.tsx` 99 s. The web UI's happy-dom
  tests sum to 2,058 s over 957 tests, about 2 s each, because each one builds a real git
  repository, starts a real server, and renders the real app
  ([`helpers.tsx`](/packages/web/src/__tests__/helpers.tsx)). The server tests sum to 395 s over
  852, and the two browser projects to 652 s over 611.
- The last 20 finished `ci.yml` runs: 15 failed, 5 succeeded. In the 10 latest failed runs read, the
  failing assertions were:
  - `home.test.tsx` and a navigation test, asserting exact counts and text ("Needs you3") that
    depend on the repository's own specs (7 runs);
  - the browser accessibility checks, failing on a measured size ("Task storage: 38 px") after a
    content change (1 run);
  - a story-embed height test (1 run);
  - a Rust test that the skill's `SKILL.md` stays under 20,000 characters (1 run);
  - benchmarks tests, failing together with a type error, after a refactor (1 run). Almost none of
    these was a product bug; the earlier [CI review](/docs/testing-review-2026-10-17.md) found the
    same, plus real synchronization races.
- Since October 10, 588 of 1,689 commits are `test:` or `fix:`; test files hold 97,150 added lines
  against 340,441 elsewhere.

### The proposal's path and existing actions

The path is the agent's: spec, plan, implementation, final review.

- [Constitution VI](/specs/CONSTITUTION.md): "Implementations MUST include tests covering the spec's
  acceptance scenarios."
- [`spec.md`](/skills/uraeda/references/spec.md#tests): the spec's scenarios, edge cases, and
  success criteria "are what the tests check"; a spec may hold up to 30 scenarios before a split.
  Edge cases carry an importance (`high`, `normal`, `niche`), checked as `edges.importance`.
- [`plan.md`](/skills/uraeda/references/plan.md): a Test map "each scenario, edge case, and success
  criterion of the spec, and the task and test that cover it", tests first, and a break to make on
  every test.
- [`code-quality.md`](/skills/uraeda/references/code-quality.md#writing-tests): integration tests by
  default, unit tests only for pure logic, "Tests that can fail" (the implementer breaks the code by
  hand and reports the failure), and "UIs verified end to end".
- [`implementation.md`](/skills/uraeda/references/implementation.md): "Never change a test or an
  expected value to make a run pass", before each commit "the project's validation once" (the whole
  cached `ready`), and every local check at the final review.
- 838 tests carry a user-story or success-criterion tag such as `US7.1`, `SC-004`. Tests of tooling
  rather than product: [`toolchain.test.ts`](/packages/server/src/__tests__/toolchain.test.ts) (696
  lines), [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts) (with 12 fixtures),
  [`skill.rs`](/crates/cli/tests/skill.rs), the coverage and test-run script tests.
- Existing human-approved rules that shape the cull: the [UI checks](/specs/decisions/ui-checks.md)
  decision ("every UI test MUST guard something a spec or decision asks for", and `ready` MUST check
  every governed page at a phone and a desktop size, in both themes), the
  [toolchain](/specs/decisions/toolchain.md) decision (`ready` runs every check, no retries), and 48
  rules across the decisions that end "Checked by ... tests".

### Rules and their owners

| Rule                                  | Owner                                                              | Copies                                                                     |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| A test per spec scenario              | Constitution VI                                                    | `plan.md` Test map, `spec.md` Tests, `implementation.md`, 838 tagged tests |
| Run everything cached after a task    | [toolchain](/specs/decisions/toolchain.md) and `implementation.md` | `plan.md` step "Run the project's validation"                              |
| Page checks at two sizes, two themes  | [UI checks](/specs/decisions/ui-checks.md)                         | `layout.test.tsx` (83 tests per size) and `spec.test.tsx`                  |
| Never edit a test to pass             | `implementation.md`, `code-quality.md`, [AGENTS.md](/AGENTS.md)    | `SKILL.md`'s top note                                                      |
| Tests never retried, flaky ones fixed | toolchain decision                                                 | [`toolchain.test.ts`](/packages/server/src/__tests__/toolchain.test.ts)    |

### Likely changes

- Delete test files and cases across all four languages, under every option of the first questions.
- Reword `code-quality.md` ("Writing tests", "Tests that can fail", "UIs verified end to end"), the
  plan's Test map, and `implementation.md`'s validation steps; keep the plan's template and the
  example in step.
- Change `vite.tasks.ts` and the toolchain decision if a faster loop gets its own command.
- Amend Constitution VI or the toolchain and UI-checks decisions, only if the human asks.
- Possibly, under one option, a check on test diffs in the final review.

## The proposal

### The constitution requires the volume the proposal calls noise

Constitution VI makes a test per acceptance scenario a MUST. Culling to "only useful, meaningful"
tests contradicts it as written. The human's request stands above the constitution, but only a human
amends it, so the round asks.

### "Faster iteration" conflicts with the validation rule agents follow

The toolchain decision's Why says one cached command is run "after every task", and
`implementation.md` repeats it. A cheaper loop means a second, smaller command, which the decision
does not have.

### The two directions pull against each other, and "meaningful" has no measure

The proposal says the balance is hard. The evidence gives measures, not a number: fails only on
behaviour that matters, no duplicates, cheap to run. It gives no target size, so the human sets the
budget. Without a budget, "faster" has no end; with one, the cull has a stop.

### Wording alone does not stop an agent bending a product to a test

METR and ImpossibleBench show prompts help partially and unevenly across models. The proposal asks
only for wording; the evidence says wording plus a structural check works better.

## Worth it and feasibility

Worth it: the cost side is large and measured: 12 to 16 minute CI runs, a failing majority, and
97,000 added test lines in nine days. The gain side is real but narrower than the volume suggests:
most tests that failed were change-detectors, and Rust's 1,006 tests run in 51 seconds. Cutting
costs a few days of agent work and risks only losing a check, which git history keeps.

Feasibility: nothing relies on unverified outside behaviour. `vitest related` does not follow
dynamic imports or non-JS inputs, such as Rust changes behind the binding, so a fast loop built on
it would miss those; the plan would check that first. No security guard is relaxed.

## Approaches

### Constitution VI and the number of tests

Constitution VI and the spec's test-per-scenario flow produce the volume; see
[the code](#the-proposals-path-and-existing-actions). Options compare on: tests kept, human control,
and conflict with the constitution.

- **Amend VI** to require tests for the behaviour that matters (main story scenarios and `high` edge
  cases), leaving others to review. Matches the evidence on value per test; needs a human amendment.
- **Keep VI, change only how it is met**: scenarios become rows of a few flow tests. Fewer tests,
  same rule; the cost is that tests stay coupled to the spec's scenario count.
- **Keep VI, cull only existing noise.** The skill keeps producing volume.

### The cull's size and rule

- **By criteria**: delete a test that fails on refactor, duplicates another path, asserts text,
  counts, or sizes the product owns, or only observes. The most evidence behind it.
- **By cap**: a budget of tests or run time per area. Simple to check, arbitrary at the edge.
- **Rebuild**: delete the suites and write a small flow suite from the specs. Cleanest, riskiest.

### Two loops

- **Two commands**: a fast one (format, lint, types, touched-crate Rust tests, `vitest related`)
  after each task, and `ready` before push and in CI. Changes the toolchain decision's reading.
- **One command, smaller suite**: no new command; the cull alone makes `ready` fast.
- **Selection inside `ready`**: use `--changed`; blind to Rust and fixtures, so not trusted alone.

### Browser tests

- **Keep the page checks** the UI-checks decision requires, and drop browser behaviour tests that
  repeat a happy-dom test or measure pixels.
- **Keep as is.**
- **Drop browser tests** and rely on screenshot review: breaks the UI-checks decision's third rule.

### Tests of tooling, Neovim, and benchmarks

- **Cull them by the same criteria**: `toolchain.test.ts` and `lint.test.ts` guard decisions, so
  keep the few lines that do; drop the rest.
- **Neovim tests**: run only in CI today (the human earlier called them "extremely secondary");
  options are keep, shrink to LSP smoke, or drop.

### Mutation testing

- **Not now**: it stays on the Later list; judging tests by hand and criteria is enough.
- **On demand with `cargo mutants --in-diff`** as the break-it check; costs a dev-shell tool and
  covers only Rust, and Stryker cannot cover the browser tests.

### Skill wording and protecting tests

- **Rewrite the wording** around behaviour first, a stated reason per test, and stop-and-report when
  a test conflicts with the request.
- **Wording plus structure**: the final review lists test diffs (assertions removed, skips added,
  expected values changed) apart from product diffs, so the human sees them.
- **A mechanical gate**: a check that fails on a dropped assertion count; would need a tool and
  misses edited thresholds, per the practitioner post's commenter.

### Who approves the cull

- **The agent, by written criteria**, with the deleted tests listed by rule in the record.
- **The human, per area, before deletion**: an extra round per area.

### Needs no choice

- **No retries** stays: the toolchain decision already forbids them, and the evidence (Google,
  Fowler, nextest) says retries hide the cause.
- **Real objects over mocks** is already the skill's "integration tests" rule.
- **Rust integration binaries**: consolidation saves compile time, but Rust's tests take 51 seconds.
- **Storybook as UI tests** (a draft) conflicts with the UI-checks and preview decisions, and is its
  own feature.
- **Cross-language copies of a rule**: one home per rule already applies to tests.

## Not checked

- The bodies of Google's "Change-Detector Tests Considered Harmful", flaky-test, and "Efficacy
  Presubmit" posts: only titles and comments were reachable.
- Ian Cooper's and Sandi Metz's talks, and the "Building to the Test" paper (the PDF did not
  decode).
- The agentic property-based testing paper, read only as search snippets.
- Whether `isolate: false` is safe for this repository's web tests; the plan would run
  `vitest doctor`.
- Per-test failure history beyond the 10 latest failed CI runs.
