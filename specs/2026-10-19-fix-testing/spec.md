---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Fix testing

> [!IMPORTANT]
>
> Spec to review, about 15 minutes.
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

The tests are 77,700 lines, take 12 to 16 minutes in CI, and failed 15 of the last 20 finished runs,
mostly on text, counts, and sizes the product had changed. This feature rebuilds them as a small
suite of flows across systems, gives agents a fast loop, and rewrites the skill's testing rules. It
is for you and the agents building Uraeda. See the [proposal](proposal.md), the
[discovery](discovery-01.md), and the [answers](clarifications-01.md).

## Decisions

- **Changed: [Toolchain](../decisions/toolchain.md)**. A fast check runs after every task, and
  `ready` runs before a push and in CI, where it ran after every task.

Relied on:

| Decision                                     | What it means for this spec                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [UI checks](../decisions/ui-checks.md)       | Every page keeps its check at a phone and a desktop size, in both themes, and a UI test still guards something a spec asks for. |
| [Code quality](../decisions/code-quality.md) | New tests stay within the limits, and no test depends on elapsed time.                                                          |
| [Agents](../decisions/agents.md)             | Tests of the runner use a fake adapter.                                                                                         |
| [Git](../decisions/git.md)                   | The tests that check its rules are rebuilt, not dropped.                                                                        |

## User stories

### US1: The suites are rebuilt as flows (P1)

You run `ready` and every system is checked by a few flows through real components: real git, real
files, the real server, the real app. Each active decision rule that ends "Checked by ... tests"
keeps a test. No test pins a text, a count, or a size the product may change.

Why this priority: it removes the slowness and the failures, and the other stories rely on a suite
that is small.

Key scenarios:

1. **Given** the home page's heading "Needs you" is renamed "Waiting on you", **When** `ready` runs,
   **Then** no test fails, since no test asserts the heading's words.
2. **Given** a feature at a gate in the fixture repository, **When** the home page renders, **Then**
   it lists that feature with its Answer action, and opening the action reaches the round.
3. **Given** the rule "a branch is read only from its latest commit", **When** `ready` runs,
   **Then** a flow in the core fails if the branch's step is read from an earlier commit.

More scenarios:

1. **Given** an old test file with no flow covering its behaviour and no rule to drop it by,
   **When** the final review reads the record, **Then** the file is listed under the area as an
   unplaced test, which fails the review.

### US2: A fast check after each task (P1)

An agent finishes a task and runs the fast check, not `ready`. It gets formatting, lint, types, and
the tests of what the task touched, and moves on. Before pushing it runs `ready`.

Key scenarios:

1. **Given** a task that changes `packages/web/src/Composer.tsx` only, **When** the agent runs the
   fast check, **Then** it runs the formatter, the linter, the types, and the web tests that reach
   that file, and no Rust test.
2. **Given** a task that changes a file under `crates/core/`, **When** the agent runs the fast
   check, **Then** it also runs the core's Rust tests and the TypeScript tests that load the
   binding.
3. **Given** a branch with every task checked, **When** the agent is about to push, **Then** it runs
   `ready`, and a red `ready` is fixed before the push.

### US3: Agents write tests that guard behaviour (P2)

The skill tells an agent to test the behaviour that matters, from the spec and not from its own
code, and to stop and report when a test and your intent differ.

Key scenarios:

1. **Given** a spec with 5 scenarios, of which 2 are `normal` edge cases, **When** the plan is
   written, **Then** its test map covers the main scenarios, the `high` edge cases, and the success
   criteria, and the `normal` edge cases only as lines of tests that exist.
2. **Given** you ask for the "Needs you" count to read "Waiting 3", and a test asserts "Needs you3",
   **When** the agent makes the change, **Then** it changes the test and tells you in the same
   response.
3. **Given** an implementation that fails a test of the spec, with no request from you, **When** the
   agent cannot fix the code within the spec, **Then** it stops and reports, and does not edit the
   test or the product to make them agree.

### US4: Test changes are visible in review (P2)

The final review lists every test removed, skipped, or changed in what it expects, apart from the
product's diff, with the ruling that explains it. The pull request's description repeats the list.

Key scenarios:

1. **Given** a task that raises a test's timeout from 20,000 to 40,000 ms, **When** the final review
   runs, **Then** the list names the test, the old and new values, and the ruling.
2. **Given** a feature that only adds tests, **When** the final review runs, **Then** the list says
   no test was removed, skipped, or loosened.

## Architecture

The rebuild goes area by area, as
[the answers](clarifications-01.md#q2-how-much-should-the-cull-remove-and-by-what-rule) chose: a
flow suite for each system replaces the old tests, built first and deleted after, so every area is
guarded at each commit. Areas do not share files, so they build in parallel waves. The fast check
and the skill's wording follow the discovery's
[evidence](discovery-01.md#evidence-on-agents-and-tests).

- **The core, CLI, and LSP flows** run the real `ura` binary and the core on temporary git
  repositories, one flow per command family or workflow step, and an LSP flow per protocol feature.
  They own the rules the git, repositories, and agents decisions end with "Checked by ... tests".
- **The server flows** go through the routes and the fate protocol with a fake runner, and own the
  sign-in, host guard, preview, and streaming rules.
- **The web flows** render the real app against the real server in happy-dom, one flow per page
  (home, priorities, inbox, decisions, round, spec, review, session, settings, editor). They assert
  behaviour, never wording or counts.
- **The browser flows** keep every page check at both sizes and in both themes, and a few
  interaction flows that need a real layout. A browser flow that happy-dom already covers, or that
  measures pixels, is dropped.
- **The Neovim smoke** runs the plugin's main actions against the real `ura lsp`, in CI only.
- **The tooling and benchmarks tests** keep a test only where it enforces an active decision's rule.
- **The fast check** is a cached task of the task graph that runs the checks above for what a task
  touched, through the tools' own selection. It owns the rule that a Rust or skill change also runs
  the tests loading the binding, which selection by imports misses.
- **The skill's testing rules** are `code-quality.md`'s "Writing tests", "Tests that can fail", and
  "UIs verified end to end", the plan's Test map, the implementation's validation steps and final
  review, the change's tests-first rule, the templates, and the example, kept in step. They own the
  rules in US3 and US4.
- **The constitution's test rule** is amended by you. The proposal below is advice, since only a
  human edits it.

> [!NOTE]
>
> Proposed amendment of Constitution VI, a major version, 2.0.0, as it redefines a MUST:
>
> - Implementations MUST include tests of the behaviour that matters: each story's main scenarios,
>   the edge cases marked high, and the success criteria. Other scenarios MAY be checked by review.
> - A test MUST fail when behaviour that matters breaks, and MUST NOT fail when a change keeps it.
> - A test MUST NOT be loosened, skipped, or deleted to make a run pass, except at a human's request
>   or with a ruling the review lists.

The rebuild's rule for what a flow guards, and what is deleted without a replacement, is the
criteria of the answers: a test goes if it fails on a refactor, duplicates a faster path, asserts
text, counts, or sizes, or only observes. The old tests are read as an inventory of behaviour, never
copied.

Tradeoffs:

- Nothing but the new flows guards the product after the deletion, and a gap shows only as a later
  regression. The coverage report, run before and after each area, shows what the area no longer
  runs.
- The pull request is huge, and it conflicts with any branch that edits a test. You said no other
  development takes place while it runs.
- The fast check can pass where `ready` fails, which the push then finds.
- Test selection by imports misses dynamic imports, and the Rust code behind the binding.

## Edge cases

| Importance | Situation                                                                                  | What happens                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| High       | An active decision's rule ends "Checked by ... tests" and its test went with the old suite | The plan lists every such rule with its new flow, and the final review fails on one with none.                     |
| High       | A behaviour guarded only by an old test no spec records                                    | The inventory names it, and it gets a flow if it passes the criteria, or is listed as dropped with its rule.       |
| High       | A new flow passes whatever the code does                                                   | A flow of an area that writes files, touches git, or guards security is shown to fail with a break its step names. |
| High       | A task changes Rust or the skill and the fast check skips the TypeScript tests             | It runs them, since they load the binding.                                                                         |
| Normal     | A test fails on a change you asked for                                                     | The agent changes the test, after telling you, never the request.                                                  |
| Normal     | A new flow fails without a bug                                                             | It is fixed in the pull request, with no retry, as the toolchain says.                                             |
| Normal     | The fast check passes and `ready` fails before the push                                    | The agent fixes it before pushing, and a red CI still means a bug.                                                 |
| Niche      | Neovim is not installed on the machine                                                     | The smoke runs in CI only, as today.                                                                               |

## Success criteria

- **SC-001** (CI under 5 minutes): Three consecutive CI runs of the branch each finish in under 5
  minutes.
- **SC-002** (fast check under 1 minute): After a one-file change, the fast check finishes in under
  1 minute on the development machine.
- **SC-003** (stable): The same commit passes five CI runs in a row.
- **SC-004** (decisions kept): Every active rule ending "Checked by ... tests" has a test, listed in
  the plan's test map.
- **SC-005** (nothing unplaced): The record maps every old test file to the flow that replaces its
  behaviour, or to the rule that dropped it.
- **SC-006** (no wording pins): No test asserts a heading, label, count, or size the product may
  change, except a page check's accessibility rules.

These are measured on CI logs and the development machine, and recorded in the pull request, not
asserted in a test.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there, except that Rust is rebuilt too, as your answer chose all suites. Settled while
writing this spec:

- **The Neovim smoke** keeps the plugin's main actions, and the test of `SKILL.md`'s length goes, as
  nothing guards a decision.
- **A conflict between a test and the spec, with no request from you,** stops the agent. A request
  from you is done, and the test changed, as the workflow's top rule already says.
- **Success criteria budgets** are mine, since your answer set no number.
- **No new decision** holds the testing rules: they live in the skill and the constitution, as you
  did not ask for one.
- **The constitution is amended before the implementation.** The plan's first task checks it and
  stops if it is not.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ⚠️               |

VI: the spec narrows "tests covering the spec's acceptance scenarios" to the behaviour that matters,
which the current text forbids until you amend it. You accepted the amendment in your answer, and
the plan stops until the constitution holds it.

## Risk tier

**High**: one change replaces every test and the validation loop, so a gap guards nothing until a
regression shows it.
