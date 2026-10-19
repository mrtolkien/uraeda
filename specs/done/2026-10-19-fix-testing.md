---
kind: feature
finished: 2026-10-20
pull-request: https://github.com/mrtolkien/uraeda/pull/48
---

# Record: Fix testing

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-20, in [its pull request](https://github.com/mrtolkien/uraeda/pull/48). Its full files are
> in git: `git log -- specs/2026-10-19-fix-testing/`. The mapping of every old test file to the flow
> that replaced it or the rule that dropped it, with the breaks run by hand and the coverage before
> and after each area, is
> [the rulings file](https://github.com/mrtolkien/uraeda/blob/a068a923/specs/2026-10-19-fix-testing/rulings.md)
> at the last commit before finishing.

## What and why

The tests were 77,700 lines, took 12 to 16 minutes in CI, and failed 15 of the last 20 finished
runs, mostly on text, counts, and sizes the product had changed, while agents bent products to pass
them. This feature rebuilds every suite as a small set of flows that guard behaviour that matters,
gives agents a fast check for after each task, and rewrites the skill's testing rules. It is for the
human and the agents building Uraeda.

## Behaviour

- Every system is checked by a few flows through real components (real git, real files, the real
  server, the real app): Rust 1,039 tests became 204, the server's 895 became 204, the web UI's 991
  became 287, the browser's two projects became page checks and a few interaction flows, the Neovim
  tests became a five-case smoke, the benchmarks' 97 became 50, and the tooling tests kept only the
  rules of active decisions. Each active rule ending "Checked by ... tests" keeps a flow.
- No flow asserts a heading, a label, a count, or a size the product may change, except a page
  check's accessibility rules; no flow sleeps, retries, or depends on elapsed time.
- `vp run fast` is the check after each task: formatting, lint, types, and the tests of what the
  change touched, with the TypeScript tests that load the binding added for any Rust, skill,
  fixtures, or Cargo change. `vp run ready` runs before every push and in CI.
- The skill tells agents to test the behaviour that matters from the spec, with real objects, a
  failing test first for a bug, and the hand-made break only for risky tasks and for code that
  writes files, touches git, or guards security. A test that conflicts with the human's request is
  changed after telling them; a test that fails with no request makes the agent stop and report.
- The final review lists every test removed, skipped, or changed in what it expects, apart from the
  product's diff, each with its ruling, and the pull request's description repeats it.
- Constitution VI (2.0.0, amended by the human) requires tests of the behaviour that matters: each
  story's main scenarios, the `high` edge cases, and the success criteria.

## Design

The rebuild went area by area, a flow suite built first and the old tests deleted after in a commit
of their own, so every area was guarded at each commit. The old tests were read as an inventory of
behaviour and never copied. Flows live in `__flows__/` folders
([server](/packages/server/src/__flows__), [web](/packages/web/src/__flows__),
[benchmarks](/packages/benchmarks/src/__flows__)), `tests/flows/` of each crate
([core](/crates/core/tests/flows), [CLI](/crates/cli/tests/flows), [LSP](/crates/lsp/tests/flows)),
[the browser's](/packages/web/src/__browser__) and [Neovim's](/editors/nvim/tests/test_smoke.lua)
smoke. The fast check is [`scripts/fast-check.ts`](/scripts/fast-check.ts), whose pure `select`
turns the changed files into steps, run as the `fast` task of [`vite.tasks.ts`](/vite.tasks.ts). The
skill's rules live in [code quality](/skills/uraeda/references/code-quality.md), with the
[plan](/skills/uraeda/references/plan.md) and
[implementation](/skills/uraeda/references/implementation.md) steps linking to them.

## Questions

### Round 01

#### Q1: Should the constitution still require a test for every acceptance scenario?

**Answer:** A: amend it, and the human advised what to change: tests of the behaviour that matters.

#### Q1.A: Which scenarios besides the main ones need a test?

**Answer:** A: main scenarios, `high` edge cases, and success criteria; the rest only as a line in a
test that exists.

#### Q2: How much should the cull remove, and by what rule?

**Answer:** C: delete all suites and write a small set of flows: "as clean as possible", with no
other development meanwhile.

#### Q3: Should an agent run a fast command after each task, and the full check only before pushing?

**Answer:** A.

#### Q4: Which browser tests should stay?

**Answer:** A: the page checks at both sizes and in both themes, and no browser test that happy-dom
covers or that measures pixels.

#### Q5: Which tests of tooling, Neovim, and benchmarks stay?

**Answer:** A: tooling tests only where they enforce an active decision, and Neovim as a smoke.

#### Q6: How should the skill's testing wording change?

**Answer:** A.

#### Q7: Should the final review check test changes separately from the product's?

**Answer:** A.

#### Q8: Should the cull be approved before it is deleted?

**Answer:** A: the agent deletes by the criteria, with the record listing what went.

## Decisions

- [Toolchain](../decisions/toolchain.md): a fast check runs after every task, and `ready` runs
  before a push and in CI.

## Changes after approval

- Rust is rebuilt too, not kept whole: the answer "all suites" overrode the settled point.
- The Neovim smoke has five cases, and the test of `SKILL.md`'s length is gone.
- `vp run fast` checks the working tree against the last commit (`vp run fast main` the whole
  branch), and builds the web UI first.
- SC-002 is not met: after a change to a file most pages import, `vp run fast` takes about 90
  seconds, and a Rust change runs all the binding-loading TypeScript tests.
- Small accessibility attributes were added so flows can assert state: the comment form's and the
  save status's errors are alerts, and the port field names its note.
- A final review's findings were fixed: the sign-in cookie's attributes now have a flow,
  `ura check`'s severities have a CLI flow, and fixed sleeps in the web flows wait on conditions.

## Follow-ups

- The success criteria SC-001 (CI under 5 minutes) and SC-003 (five stable runs) are measured on CI
  after the push, and recorded in the pull request.
- SC-002 stays unmet for a change to a widely imported web file: the human decides whether to relax
  the budget or select by direct importers only, which would skip tests that matter.
- The inbox holds the deferred findings, including the skill template's constitution still saying
  "tests covering the spec's acceptance scenarios", and three product findings the flows found: "Try
  again" on the server error does not recover without a reload, a priorities row loses focus after
  Enter, and the phone navigation drawer is not a history entry.
