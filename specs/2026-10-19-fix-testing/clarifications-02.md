---
status: answered
---

# Clarifications, round 02: Fix testing

> [!NOTE]
>
> Answered on 2026-10-20.
>
> - Verdict: not as proposed. The all-flow rebuild lost distinct protections while keeping the
>   dependency graph that makes shared edits slow.
> - Suite architecture: retain useful focused tests and permit exact values when they are the
>   required behavior.
> - Fast-check guarantee: decide which broader checks may wait until ready, explicitly reported on
>   each run.
> - Deletion evidence follows the existing behavioral-test rule: review what each replacement
>   actually asserts.
> - Existing speed targets, browser page checks, fake runners, and no-retry rules remain. No
>   constitution change is proposed.

## Context

### Since the last round

You [approved replacing every suite with flows](clarifications-01.md), then rejected the result
because coverage fell without enough speed improvement. The
[discarded pull request](https://github.com/mrtolkien/uraeda/pull/48) also failed its TypeScript and
desktop-browser checks. This worktree is reset to the approved spec, with the original tests and no
plan.

The review found a third option beyond relaxing the speed budget or skipping indirect importers:
change where tests exercise behavior. These questions revisit approved choices before another
rebuild. Your previous answers and approved spec remain intact until this round is answered.

### Goal

Get fast, trustworthy feedback while protecting Uraeda's important behavior and keeping tests
understandable and inexpensive to maintain.

### Today

Historical figures come from the
[discarded implementation's record](https://github.com/mrtolkien/uraeda/blob/a068a923/specs/2026-10-19-fix-testing/rulings.md).
They were not rerun in this review.

| Observation                                                                                   | Why it matters                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Rust execution fell from 17 to 4 seconds; line coverage fell from 93.6% to 84.5%.             | Many inexpensive boundary cases disappeared to save 13 seconds.                            |
| Server coverage was reported as 83.0% to 59.2%.                                               | Measurement exclusions need correction, but inspection independently confirms lost guards. |
| Web suite wall time fell from 222 to 81 seconds; a Composer fast check still took 90 seconds. | The rewrite retained whole-app imports, so a shared edit still selected nearly every page. |
| The failed TypeScript CI job took 9 minutes and had 15 failing tests.                         | Neither the five-minute target nor stability was demonstrated.                             |

Some replacement checks were weaker than their names suggested. An oversized-upload test supplied
invalid image bytes and accepted any refusal. It could pass without the size guard because image
decoding would also reject the input. Other losses included exact text preservation, permission
boundaries, merge-history differences, and real frame messaging. The
[full evidence](discovery-02.md#concrete-coverage-losses-and-weak-replacements) names the old and
replacement tests.

### Scope

This round asks about test architecture and the fast-check promise. It also records the evidence
needed before deletion. It keeps the original feature's scope, tools, speed targets, required
browser matrix, fake runner, and no-retry policy. It does not authorize unrelated product fixes, new
paid services, or benchmarks that spend usage.

### Sources

- The current tests, discarded implementation, and
  [failed CI run](https://github.com/mrtolkien/uraeda/actions/runs/39332744979).
- Google's [testing overview](https://abseil.io/resources/swe-book/html/ch11.html), Vitest's
  [profiling guidance](https://vitest.dev/guide/profiling-test-performance), and
  [research on coverage and fault detection](https://www.cs.ubc.ca/~rtholmes/papers/icse_2014_inozemtseva.pdf).
- The full investigation and proposed ownership of each test family are in
  [discovery round 02](discovery-02.md).

## Q1: Should we replace the all-flow rebuild with layered repairs that retain useful existing tests?

The approved spec replaces every test suite with flows through real systems. The attempted flows
still imported the complete app, server, and binding. That preserved expensive selection while
removing cheap, precise checks of data preservation and security boundaries.

Layered testing gives each guarantee a focused test where it belongs. Core APIs protect parsing and
git writes; server tests protect requests and sessions; component tests protect local interactions.
A small set of complete journeys proves those pieces work together. Real browsers remain responsible
for browser behavior and the required page checks. This follows the
[testing literature](https://abseil.io/resources/swe-book/html/ch11.html) without prescribing a
percentage of each test type.

The approved spec also broadly bans wording, counts, and sizes. That would exclude exact user text,
protocol values, resource bounds, and duplicate-commit checks. Option A replaces that blanket ban
with a distinction between required contracts and incidental values. See
[assertion meaning](discovery-02.md#what-assertions-should-mean).

The existing suite also contains weak tests, so retaining everything unchanged is not the goal. For
example, its installation rollback check fails before partial installation and cannot prove later
cleanup. More in [the architecture comparison](discovery-02.md#the-suite-architecture).

Why it matters: this revises both the approved complete replacement and its blanket assertion
exclusions. It determines which behavior the next suite can protect.

- **A (recommended). Retain useful focused tests and a few whole-app journeys; allow exact values
  for required contracts, while removing incidental assertions.**
  - [pro] preserves distinct protections while removing unnecessary setup and duplication.
  - [con] needs careful case-by-case review; the final test count is not predetermined.
  - Why recommended: the evidence identifies costly boundaries and valuable cheap cases, so deletion
    alone targets the wrong problem.
- **B. Repair the discarded all-flow rebuild, restoring missing cases inside its flow suites.**
  - [pro] keeps the previously approved replacement approach and reuses its completed work.
  - [con] restoring cases and making flows independently runnable still needs substantial redesign;
    broad app imports remain costly.
- **C. Keep the current test behavior and optimize only setup, imports, and task scheduling.**
  - [pro] minimizes immediate loss of protection.
  - [con] preserves redundant or weak assertions and does not complete the requested testing reform.

**Answer:** A

## Q2: May the fast check defer broad application journeys while running affected focused tests and boundary checks?

The approved fast check runs formatting, lint, types, and tests of the changed area. Its attempted
implementation selected every transitively related non-browser test. Because their harness imported
App, both Composer and even a leaf component reached almost the whole UI suite. Rust changes
selected the binding-loading application suites too.

With the layered architecture in the previous question, fast can run all related focused tests and
affected boundary checks. Examples include Composer behavior, core workflow tests, binding
contracts, and relevant request tests. Broader app journeys and browser checks would wait until
ready, with the deferred suites named in fast's output. Ready remains mandatory before pushing and
runs every required check.

This is an explicitly partial check, not a claim that indirect consumers cannot break. The
alternative is running all affected application tests locally too, which requires making that entire
affected set fit the same time budget. More in
[the fast-check comparison](discovery-02.md#the-fast-checks-guarantee).

Why it matters: this sets the assurance of every future local check and whether a small shared edit
must run broad application coverage immediately.

- **A (recommended). Run affected focused and boundary tests in fast, and explicitly defer broad
  journeys and browser checks to ready.**
  - [pro] gives a plausible path to the one-minute budget without hiding the work still required
    before pushing.
  - [con] a cross-layer regression may be found at ready rather than immediately after the edit.
  - Why recommended: focused tests can catch relevant failures cheaply while the complete check
    still protects delivery.
- **B. Run every transitively affected non-browser test in fast, including all affected whole-app
  journeys.**
  - [pro] gives stronger local integration assurance after each task.
  - [con] shared components and core changes may still select almost the entire application; the
    one-minute budget remains unproven.

**Answer:** A

## Settled without the human

### Check these

- **Speed evidence** starts with a Composer pilot and a core/binding probe before expanding the
  rebuild. Keep the approved targets; report any conflict before continuing. See
  [speed evidence](discovery-02.md#the-speed-budgets-need-representative-evidence).

### Under the hood

- **Deletion evidence** identifies each important guarantee, its owning assertion, and why a removed
  check adds no distinct protection. This implements Constitution VI and the approved high-risk
  fault checks; it adds no new permanent percentage gate. Comparable coverage reports locate
  omissions for review. See [deletion evidence](discovery-02.md#evidence-before-deleting-tests).
- **Independent fixtures** reuse immutable templates and give independent cases their own mutable
  state. One test may contain a necessary sequence; separate tests must pass alone. See
  [fixture reuse](discovery-02.md#setup-reuse-introduced-dependencies-between-tests).
- **Controlled waits** observe the state the next action needs; injected clocks test time-dependent
  rules without sleeping. Keep worktree isolation, cleanup, and no retries. See
  [readiness findings](discovery-02.md#readiness-was-weakened-while-wording-was-removed).
- **Review boundary** leaves the constitution, product behavior, previous answers, and approved spec
  unchanged in this round. The next spec revision follows these answers. See
  [why this round](discovery-02.md#why-this-round).

**Notes:** Btw there'll be a big rebasing work at the end because I work on features at the same
time today. Make sure you pull main regularly during the testing rewrite and before creating the PR
