---
status: awaiting-human
revision: 2
clarifications: 2
risk-tier: high
plan-review: false
---

# Spec: Fix testing

> [!IMPORTANT]
>
> Spec to review, about 10 minutes.
>
> - You approve retaining useful focused tests, repairing costly boundaries, and keeping a few
>   whole-app journeys alongside a deliberately partial fast check.
> - Since approval: no blanket replacement or ban on exact values. Human text, protocol values,
>   security bounds, and required counts remain testable.
> - Changed: Toolchain. Fast checks affected focused and boundary behavior; it names broader
>   journeys and browser checks deferred to ready.
> - Speed is unproven: Composer and core/binding pilots come first. The one-minute local and
>   five-minute CI targets remain requirements.
> - Coverage diagnoses lost protection, without a percentage gate. Each deletion needs evidence
>   about behavior, beyond an old-file mapping.
> - Main keeps changing: integrate it regularly and before the pull request, preserving newly added
>   behavior and tests.
> - Risk remains high; the plan does not wait for review. Constitution VI already contains the
>   approved amendment; no further amendment is needed.

Uraeda's tests should catch meaningful regressions quickly and survive changes that preserve
behavior. The discarded all-flow rebuild lost useful protection while retaining expensive whole-app
imports. This revision repairs test boundaries and setup, keeps valuable tests, and separates local
feedback from complete delivery checks. See the [proposal](proposal.md), [review](discovery-02.md),
and [answered round 02](clarifications-02.md).

## Decisions

- **Changed: [Toolchain](../decisions/toolchain.md)**. Fast checks affected focused tests and
  boundary checks, explicitly deferring broader application journeys and browser checks to ready.

Relied on:

| Decision                                                                                                                 | What it means for this spec                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [Stack](../decisions/stack.md)                                                                                           | Workflow logic stays in Rust; binding contracts supplement core tests rather than copying their complete case matrix.         |
| [Git](../decisions/git.md) and [repositories](../decisions/repositories.md)                                              | Real git checks protect work, hooks, committed state, and repository isolation, including the current rules for inbox writes. |
| [Sign-in](../decisions/sign-in.md), [settings](../decisions/settings.md), and [attachments](../decisions/attachments.md) | Security boundaries, refusal side effects, and human-owned data remain protected.                                             |
| [UI checks](../decisions/ui-checks.md) and [preview](../decisions/preview.md)                                            | Ready keeps the required page matrix and Storybook build; stories do not become tests.                                        |
| [Agents](../decisions/agents.md) and [benchmarks](../decisions/benchmarks.md)                                            | Ordinary tests use a fake adapter and never start chargeable benchmark runs.                                                  |
| [Code quality](../decisions/code-quality.md)                                                                             | Existing limits and isolation hold; controlled clocks replace elapsed-time dependencies in unit tests.                        |

## User stories

### US1: Keep useful protection at affordable boundaries (P1)

You run ready and get focused behavioral checks plus a small set of complete application journeys.
Existing tests remain when they provide distinct protection; duplication and incidental expectations
are repaired or removed with evidence.

Key scenarios:

1. **Given** a home heading changes from "Needs you" to "Waiting on you", **When** validation runs,
   **Then** unchanged feature actions still pass.
2. **Given** settings contain comments inside a multiline host array, **When** a host is removed,
   **Then** remaining comments and unrelated bytes are preserved.
3. **Given** a feature at a human gate, **When** its action is opened and answers submitted,
   **Then** one commit records them and reload shows the resulting step.

More scenarios:

1. **Given** a merged revision and a squash-merged revision, **When** their previous reviews are
   read, **Then** the merged revision quotes its previous review and the squash-merged revision has
   none.
2. **Given** a preview frame, **When** another window sends a pick message, **Then** no comment is
   created; a trusted pick still persists.

### US2: Get fast feedback with an explicit limit (P1)

After a task, you run `vp run fast` for formatting, lint, types, affected focused tests, and
affected boundary checks. Its output names selected checks and broader checks deferred to ready;
success does not mean the complete affected application passed.

Key scenarios:

1. **Given** only `Composer.tsx` changes, **When** fast runs, **Then** it checks related focused UI
   behavior without selecting every page through App or running Rust tests.
2. **Given** core Rust changes, **When** fast runs, **Then** affected Rust tests and real binding
   contract checks run; broader binding-loading journeys are explicitly deferred.
3. **Given** fast passes, **When** the branch is ready to push, **Then** ready runs all required
   checks and any failure is resolved before pushing.

More scenarios:

1. **Given** a declaration, fixture, skill, root configuration, or deleted source changes, **When**
   fast selects checks, **Then** it accounts for affected non-import dependencies conservatively.
2. **Given** changed files cannot be determined, **When** fast runs, **Then** it fails with the
   cause instead of treating the error as an empty change.

### US3: Write behavioral tests without rebuilding the same problem (P2)

The skill assigns each important guarantee to its cheapest adequate boundary and uses complete
journeys to prove integration. Tests derive expected behavior from the spec, decisions, and human
intent, rather than reproducing implementation details.

Key scenarios:

1. **Given** a feature has main scenarios, high-risk edges, and success criteria, **When** its plan
   is written, **Then** those guarantees map to meaningful checks.
2. **Given** exact user text, permission scope, or a required commit count is the contract, **When**
   a check is written, **Then** it asserts that contract precisely.
3. **Given** a test conflicts with a direct human request, **When** the change is made, **Then** the
   request is preserved and the test change is reported.

More scenarios:

1. **Given** a test fails against the spec without a conflicting human request, **When** it cannot
   be fixed within scope, **Then** work reports the conflict rather than weakening the assertion.
2. **Given** a lifecycle rule depends on a timeout, **When** its unit check runs, **Then** a
   controlled clock exercises the boundary without sleeping for that duration.

### US4: See what protection changed (P2)

The final review and pull request separately list removed, skipped, and loosened tests, with their
rulings and preserved guarantees. Coverage reports help locate omissions; neither fewer tests nor a
percentage alone establishes adequate protection.

Key scenarios:

1. **Given** an old test is replaced, **When** deletion is reviewed, **Then** its important
   guarantees have owning assertions or an explicit justified disposition.
2. **Given** a timeout rises from 20,000 to 40,000 milliseconds, **When** final review runs,
   **Then** both values and the ruling appear in the test-change list.

## Architecture

Use [layered repairs](discovery-02.md#a-test-architecture-matched-to-this-application), as the
latest answers chose. A boundary is the interface where a behavior can be exercised and its effects
observed independently. Retain useful cases across all existing suites; the discarded rebuild is
evidence, not the implementation to restore wholesale.

- **Focused checks** exercise public core APIs, cohesive UI behavior, editing/storage logic, and
  adapter transformations with only their relevant real collaborators. They own detailed behavioral
  cases without whole-app imports or unnecessary git setup.
- **Boundary checks** use real git for history, hooks, writes, and cleanup; real binding output for
  serialization; isolated caches and fake adapters for sessions. Server request checks own
  authorization, repository scoping, bounded reads, and refusal side effects. A caller proves its
  mapping and integration, without repeating every case owned below it.
- **Application journeys** exercise the real UI, fate, server, binding, files, and git for
  answering, review, conflicts, runner control, and repository/authentication boundaries. They own
  the wiring between layers rather than every edge case.
- **Browser checks** own actual frame messaging/isolation, focus, keyboard, scrolling, and other
  browser behavior an emulator cannot establish. Ready also checks every governed page at phone and
  desktop sizes in both themes for accessibility and readability.
- **Fixtures and execution** reuse immutable setup while giving independent cases their own mutable
  repository, settings, sessions, and browser state. Each independent test passes alone; a necessary
  multistep journey stays one test. Waits observe the state needed for the next action, and teardown
  closes requests, watchers, and processes.
- **Fast selection** follows transitive dependencies within focused checks and routes changes to
  their affected boundary checks, including native and filesystem inputs. Selection precedes
  optional build prerequisites; tests consuming built output still receive that output. Shared edits
  do not select all application journeys through a common App harness. Full application journeys,
  browser checks, and required production builds remain in ready.
- **Skill guidance and review** express these rules together in the testing, planning,
  implementation, and change references, templates, and example. Main scenarios, high-risk edges,
  and success criteria require tests; other cases may share checks or be reviewed. A text, count, or
  size assertion is judged by the behavior it protects, not by its value's type. Incidental copy,
  fixture totals, and internal implementation expectations do not become contracts.

Before expanding repairs, a Composer pilot and core/binding probe must demonstrate the selected
boundaries and measure complete command time. If their timing or adequacy misses the approved
requirements, resolve it or return the conflict before extending the rewrite. Do not delete
protection to fit a timing sample.

For every area, compare coverage with consistent product exclusions and explain lost execution at
the behavioral level. Security, git, and file-writing replacements must fail for a plausible defect
in the guard they claim to protect. A refusal caused by another invalid input is insufficient
evidence. The record maps every old test file to retained checks, moves, replacements, or justified
removals, and names important guarantees inside changed files. These records implement Constitution
VI without adding a permanent coverage gate or a separate test for every sentence.

Refresh remote main and integrate the latest main regularly during implementation and before
creating the pull request. After integration, reconcile changed decisions, scenarios, and new tests
against the updated base and rerun affected validation. No concurrent product change is discarded to
preserve an obsolete test inventory.

Tradeoffs:

- Fast deliberately defers some integration failures until ready; its output makes that limit
  visible.
- More useful existing tests may survive than in the discarded rebuild; there is no test-count or
  line-count target.
- Coverage cannot prove assertion strength, and focused fault checks cannot establish every possible
  behavior.
- Fixture and task-boundary changes need their own correctness evidence; faster setup must not
  introduce shared mutable state or stale cached passes.
- Concurrent development can require repeated integration and validation; the approved scope does
  not assume development is paused.

## Edge cases

| Importance | Situation                                                                              | What happens                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| High       | A required decision rule or unique old behavior loses its only guard                   | The record identifies its owning assertion or justified disposition; important missing protection blocks final review.              |
| High       | A replacement passes for an unrelated refusal or always returns the accepted result    | A targeted faulty implementation must make the relevant high-risk check fail.                                                       |
| High       | A test depends on an earlier test's writes                                             | Its preconditions become independent, or the necessary sequence becomes one journey; sharing mutable setup is not the optimization. |
| High       | Skill, fixture, declaration, configuration, or native inputs bypass JavaScript imports | Selection and cache dependencies account for them; uncertain selection broadens checks instead of silently omitting them.           |
| High       | Fast defers integration checks                                                         | Output names the deferred families; ready retains every required check before pushing.                                              |
| High       | Main adds or changes behavior during the rewrite                                       | Integrate regularly, reconcile the inventory and decisions, and validate against the latest base before creating the pull request.  |
| Normal     | A readiness condition occurs before the next action is possible                        | Await the action's actual required state; do not raise a timeout or add retries to conceal the race.                                |
| Normal     | A test legitimately conflicts with a requested product change                          | Preserve the human's request, update the expectation, and report the conflict and change.                                           |
| Niche      | Neovim is unavailable locally                                                          | Keep its main-action smoke against real LSP in CI, as previously agreed.                                                            |

## Success criteria

- **SC-001** (CI under 5 minutes): Three consecutive successful CI runs each finish within 5
  minutes, including setup and builds.
- **SC-002** (fast under 1 minute): Complete fast-check command time after a one-file edit is under
  1 minute on the development machine. Measure Composer, a leaf, a shared helper, core Rust, skill,
  fixture, declaration, configuration, deletion, and documentation changes. Report startup,
  prerequisites, lock waits, execution, and cleanup; distinguish cold and warm state without waiving
  a failed sample.
- **SC-003** (stable): The same commit passes five complete CI runs in a row, without retries.
- **SC-004** (decisions kept): Every active rule requiring tests has an owning meaningful check in
  the plan's test map and final review.
- **SC-005** (protection accounted for): Every old test file has a disposition, and important
  guarantees affected by removal or weakening have behavioral replacement evidence.
- **SC-006** (contract assertions): Incidental copy changes pass; incorrect human text, protocol
  values, security bounds, and required side effects fail their owning checks.
- **SC-007** (independent checks): Changed independent cases pass individually and in their suite
  without depending on earlier tests' mutations.

Timing and stability evidence identify the measured commit, machine, input changes,
selected/deferred checks, and cache state in the review record. Unmet criteria remain unmet; the
final record does not silently relax them.

## Assumptions

The settled points of [round 02](clarifications-02.md#settled-without-the-human) hold. They
supersede round 01's complete replacement and blanket assertion exclusions. Earlier choices remain
where unchanged: Neovim main-action smoke, decision-backed tooling/benchmark checks, fake adapters,
and no new mutation-testing tool. Settled while writing this spec:

- **Scope** covers testing and the validation workflow, not unrelated product fixes or a new paid
  service.
- **Data and constitution** remain unchanged. Constitution VI already holds the behavior-based
  amendment; this feature does not amend any constitution.
- **Pilot evidence** is not yet available. The plan starts with representative measurements before
  expanding changes, as the answered settled point requires.
- **Rebasing** follows the human's note in round 02. Newly active decisions and tests are read again
  after each integration.
- **Plan review** stays false, as previously approved; the high risk tier does not introduce another
  gate by itself.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

No exception is proposed. Behavioral evidence, visible test changes, and selective fault checks
implement the current Constitution VI.

## Risk tier

**High**: changes to test protection and selection can hide security, data-loss, or integration
regressions even when local checks pass.

## History

> [!NOTE]
>
> Revision 1 was approved on 2026-10-19. Its implementation was rejected after coverage losses,
> insufficient speed, and failed CI. Round 02 was answered on 2026-10-20: retain useful focused
> tests and explicitly defer broad journeys from fast to ready.

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve replacing every test suite with a small set of flows that guard behaviour that
>   matters, a fast check after each task, and testing rules that stop agents bending a product to a
>   test.
> - Changed: Toolchain. A fast check runs after every task, and `ready` runs before a push and in
>   CI.
> - Your constitution amendment comes first: the plan stops until the constitution holds it. Its
>   proposed text is in the architecture.
> - Rust and Neovim are rebuilt too: "all suites" in your answer overrides the settled point that
>   kept Rust whole.
> - Everything old is deleted, and the new flows are the only guard. I show what each area no longer
>   exercises, from the coverage report, in the record.
> - The time budgets in the success criteria are mine: change them if they are wrong.
> - Risk tier `high`, as one change replaces every guard. The plan does not wait for your review.
