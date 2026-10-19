---
status: auto-approved
spec-revision: 1
---

# Plan: Fix testing

**Goal:** Replace every test suite with a small set of flows that guard behaviour that matters, add
a fast check for after each task, and rewrite the skill's testing rules so agents stop bending a
product to a test.

**Architecture:** Each area (core, CLI and LSP, server, web, browser, Neovim, tooling and
benchmarks) gets a new flow suite that is built first, then the old tests of the area are deleted in
a commit of their own, so every area is guarded at each commit. The old tests are an inventory of
behaviour, read and never copied. The mapping of every old test file to the flow that replaces it,
or the rule that dropped it, is a ruling per area in [rulings.md](rulings.md): it is the record
SC-005 asks for. The fast check is a cached task of `vite.tasks.ts` over one script,
`scripts/fast-check.ts`, which owns the choice of what a change runs. The testing rules live in the
skill's reference files only. See the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **Constitution not amended.** The text of VI is 1.3.1 until a human edits it. Task 1 checks it
   and stops the build there. Task 1.
2. **A deleted test whose behaviour no flow covers.** Each area's ruling lists, per old test file,
   the flow or the dropping rule, and a file with neither fails the area's review. Tasks 4 to 9.
3. **A flow that passes whatever the code does.** Flows of areas that write files, touch git, or
   guard security each carry a break their step names, run by hand and reported. Tasks 4 to 7.
4. **The fast check skipping the TypeScript tests after a Rust or skill change.** The script runs
   every test loading the binding when a path under `crates/` or `skills/` changes. Task 3.
5. **A rule "Checked by ... tests" left with no test.** The test map lists all of them. Tasks 4
   to 9.
6. **A flow that pins text, a count, or a size.** The web and browser flows assert roles, state, and
   navigation, never wording. Tasks 6 and 7.
7. **Time budgets measured, not asserted.** Task 10 reads three CI runs and five repeats of one
   commit, and records them in the pull request.

## Global constraints

- Behaviour that matters is tested: each story's main scenarios, `high` edge cases, and success
  criteria. A `normal` edge case is a line in a test that exists, never a test of its own.
- A test MUST fail when behaviour that matters breaks, and MUST NOT fail when a change keeps it. No
  test asserts a heading, a label, a count, or a size the product may change, except a page check's
  accessibility rules (SC-006).
- Real components over mocks: real git, real files, the real server, the real app. The runner's
  tests use a fake adapter ([Agents](../decisions/agents.md)).
- Every page keeps its page check at a phone and a desktop size, in both themes
  ([UI checks](../decisions/ui-checks.md)).
- No test retries, no sleeps, no test depends on elapsed time
  ([Toolchain](../decisions/toolchain.md), [Code quality](../decisions/code-quality.md)).
- New tests stay within the limits of the [Code quality](../decisions/code-quality.md) decision, and
  warnings, size, complexity, and duplication do not go up (Constitution VI).
- Tests stay isolated, so runs in several checkouts do not collide, and are run by
  `scripts/test-run.ts` as today.
- A test that fails without a bug is fixed in the pull request. A flow that fails because the
  product is wrong is a finding: fix the product only when the spec allows, otherwise stop and
  report.
- Code marked `TEMPORARY:` is not built on. Run Rust inside `nix develop -c`.
- Deleted files are never copied into the new ones: a new flow is written from the spec, the
  decision rule, and the product's behaviour.
- A task ends with its area green on `vp run fast` (from Task 3 on), and the final task runs
  `vp run ready`.

## Code read

- [`vite.tasks.ts`](/vite.tasks.ts): `ready` groups `ready:rust`, `ready:typescript`,
  `ready:browser-phone`, `ready:browser-desktop`, cached by `cache.input`; `ts:test` runs
  `vp test --project '!phone' --project '!desktop'`; `test:nvim` is CI only.
- [`ci.yml`](/.github/workflows/ci.yml): one job per `ready:*` group, uncached, plus Neovim.
- [`crates/*/tests`](/crates): 18 CLI, 43 core, and 4 LSP test files, each its own binary, with
  `common/` helpers building temporary git repositories.
- [`packages/server/src/__tests__`](/packages/server/src/__tests__): 39 files, `toolchain.test.ts`
  among them reading `vite.tasks.ts`, the workflow, and the manifests.
- [`packages/web/src/__tests__`](/packages/web/src/__tests__),
  [`__browser__`](/packages/web/src/__browser__), [`__lint__`](/packages/web/src/__lint__): the
  happy-dom tests built on `helpers.tsx` (a real repository and server per test), the WebKit tests,
  and the lint fixtures.
- [`editors/nvim/tests`](/editors/nvim/tests): 15 mini.test files on the real `ura lsp`.
- [`packages/benchmarks/src/__tests__`](/packages/benchmarks/src/__tests__): the runner's tests.
- [`code-quality.md`](/skills/uraeda/references/code-quality.md),
  [`plan.md`](/skills/uraeda/references/plan.md),
  [`implementation.md`](/skills/uraeda/references/implementation.md),
  [`change.md`](/skills/uraeda/references/change.md), and the plan template and example: the testing
  wording to rewrite.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

VI: the human amended it to 2.0.0 before the build, so the narrowed test scope is allowed. Task 1
checked it.

## Complexity tracking

| Abstraction or exception          | Why it is needed                                                                                              | Simpler alternative rejected because                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `scripts/fast-check.ts`           | Selection must add the binding-loading tests after a Rust or skill change, which the tools' selection misses. | `vitest related` alone misses Rust and the skill, which the spec's edge case says it must. |
| Constitution VI amendment pending | The spec's narrowing of "tests covering the spec's acceptance scenarios" needs the human's amendment.         | Building before it breaks the constitution's own MUST.                                     |

## Test map

| Spec                                                      | Task   | Test                                                                                               |
| --------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| US1 1: renaming a heading breaks nothing                  | 6      | web home flow asserts the feature and its Answer action by role and link target, not the heading   |
| US1 2: a feature at a gate on the home page               | 6      | `packages/web/src/__flows__/home.test.tsx`: the feature, its Answer action, and the round it opens |
| US1 3: a branch read from its latest commit               | 4      | `crates/core/tests/flows/steps.rs`: an earlier commit's step is not read after a later commit      |
| US1 more 1: an unplaced old test fails the review         | 10     | final review reads the rulings: every old file has a flow or a rule                                |
| US2 1: a web-only change runs no Rust test                | 3      | `scripts/fast-check.test.ts`: the selection for `packages/web/src/Composer.tsx`                    |
| US2 2: a `crates/core` change adds Rust and binding tests | 3      | `scripts/fast-check.test.ts`: the selection for a core file                                        |
| US2 3: `ready` before pushing                             | 2      | `implementation.md`'s wording, read in the final review                                            |
| US3 1: the test map covers main, high, and criteria       | 2      | `plan.md` reference and template, read in the final review                                         |
| US3 2: a requested change changes the test, with a note   | 2      | `implementation.md` and `code-quality.md` wording, read in the final review                        |
| US3 3: stop and report on a conflict with no request      | 2      | `implementation.md` wording, read in the final review                                              |
| US4 1, 2: test changes listed apart in the final review   | 2      | `implementation.md`'s final review and the pull request section, read in the final review          |
| Edge: a rule's test went with the old suite (high)        | 4 to 9 | the area's flow named in its ruling; Task 10 checks the list below                                 |
| Edge: a behaviour only an old test guards (high)          | 4 to 9 | the area's ruling lists it with its flow or its dropping rule                                      |
| Edge: a flow that passes whatever the code does (high)    | 4 to 7 | each task's break, run by hand and reported                                                        |
| Edge: a Rust or skill change skips the TS tests (high)    | 3      | `scripts/fast-check.test.ts`: a `crates/` and a `skills/` path add the binding-loading tests       |
| SC-001, SC-002, SC-003                                    | 10     | measured on CI and the development machine, recorded in the pull request                           |
| SC-004                                                    | 4 to 9 | the rules below, each with its flow                                                                |
| SC-005                                                    | 4 to 9 | the rulings' mapping of old files                                                                  |
| SC-006                                                    | 6, 7   | the flows' assertions, read in each area's review                                                  |

Rules ending "Checked by ... tests", and the task that keeps each as a flow: toolchain
(configuration test, Task 8); notifications (notifier, Task 5); ui-layout, ui-behaviour, problems
UI, settings page (web and browser flows, Tasks 6 and 7); git, repositories core, settings core,
attachments core, problems core and CLI, cli (Task 4); distribution (package smoke, kept as is, Task
8); stack guard, preview proxy, runner, sign-in, repositories and attachments server, settings
server (Task 5); diagrams (Task 6); benchmarks (Task 9); agents (runner with the fake adapter, Task
5).

## Waves

1. Task 1: the gate: nothing else starts before the constitution holds the amendment.
2. Tasks 2 and 3: the skill's rules and the fast check, which touch the skill and the task graph,
   and no tests of an area.
3. Tasks 4, 5, 8, and 9: the Rust flows (core, CLI, LSP), the server flows, the tooling flows, and
   the benchmarks flows. They touch different crates and packages, and each only adds its own
   helpers.
4. Tasks 6 and 7: the web flows, then the browser flows (7 runs after 6 so it drops only what
   happy-dom covers), in sequence.
5. Task 10: the Neovim smoke, the final record, and the measurements.

Task 8 follows Task 3, as the configuration test reads the task graph. Task 5 and 6 are built on the
unchanged server, so a server flow and a web flow do not share code.

---

## Task 1: The constitution holds the amendment

**Files:**

- Read: `specs/CONSTITUTION.md`

**Interfaces:**

- Produces: the go-ahead of the build.

- [x] **Step 1: Check the constitution's rule VI**

Read `specs/CONSTITUTION.md`. The build continues only if rule VI requires tests of the behaviour
that matters (a story's main scenarios, `high` edge cases, and success criteria), forbids a test
that breaks on a change keeping the behaviour, and forbids loosening, skipping, or deleting a test
to pass without a human's request or a listed ruling, as the
[spec's proposed amendment](spec.md#architecture) says, and the version is 2.0.0 or higher.

- Run: `rg -n 'Version' specs/CONSTITUTION.md`
- Expected: a version of 2.0.0 or higher. Otherwise stop: tell the human the amendment is not made,
  and do not start Task 2. Never edit the constitution.

## Task 2: The skill's testing rules

**Files:**

- Modify: `skills/uraeda/references/code-quality.md` ("Writing tests", "Tests that can fail", "UIs
  verified end to end")
- Modify: `skills/uraeda/references/plan.md` (Test map, test steps, the validation step)
- Modify: `skills/uraeda/references/implementation.md` (the per-task check, the final review, the
  pull request)
- Modify: `skills/uraeda/references/change.md` (the tests-first rule)
- Modify: `skills/uraeda/references/spec.md` ("Tests", if it says a test per scenario)
- Modify: `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/plan.md` and
  `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/plan.md`
- Modify: `skills/uraeda/SKILL.md` and `AGENTS.md` only where they repeat a rule

**Interfaces:**

- Produces: the rules of US3 and US4, in one home each.

- [x] **Step 1: Read the model**

Read `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/` before editing a template, a
reference, or the example, and the [evidence](discovery-01.md#evidence-on-agents-and-tests).

- [x] **Step 2: Rewrite the rules, in one home each**

- `code-quality.md`: a test names the behaviour that matters and comes from the spec, never from the
  code; real objects over mocks; a bug starts with a failing test; a test fails on behaviour and not
  on text, counts, or sizes; the hand-made break is for a task the plan marks risky, and for flows
  of areas that write files, touch git, or guard security; a test and the human's request that
  differ: the request is done and the test changed, after telling the human, and a test that fails
  with no request from the human makes the agent stop and report, never edit the test or bend the
  product.
- `plan.md` and its template and example: the Test map covers the main scenarios, the `high` edge
  cases, and the success criteria; `normal` edge cases appear only as lines of tests that exist. The
  validation step of a task is the fast check, `vp run fast` in this repository, named by the
  project's setup; the last step before a push is the project's full command.
- `implementation.md`: the per-task check is the fast check; `ready` before every push; the final
  review lists every test removed, skipped, or changed in what it expects, apart from the product's
  diff, each with its ruling and, for a changed value, the old and new values; the pull request's
  description repeats the list, or says no test was removed, skipped, or loosened.
- `change.md`: the tests-first rule matches the same rules.
- `spec.md`: the tests section says which scenarios the plan's tests cover.

Each rule is stated once and linked from the other files. Keep the plan template, the reference, and
the example in step.

- [x] **Step 3: Check the files**

- Run: `nix develop -c cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs`
- Expected: PASS, and `vp check` clean on the markdown.

- [x] **Step 4: Commit**

```bash
git add skills AGENTS.md
git commit -m "docs(fix-testing): rewrite the skill's testing rules"
```

## Task 3: The fast check

**Files:**

- Create: `scripts/fast-check.ts`, `scripts/fast-check.test.ts`
- Modify: `vite.tasks.ts` (task `fast`, uncached, with a `fast:*` set of subtasks only if needed),
  `skills/uraeda/references/cli.md` or the project setup reference only if they name `ready` as the
  per-task command

**Interfaces:**

- Produces: `vp run fast`, which takes the changed files from git (the diff to the merge base, and
  uncommitted files) and prints what it ran. Selection: always the formatter, the linter, and the
  types (`vp check`); for a TypeScript or web file, `vp test related <files> --run`; for a file
  under `crates/<name>/`, `cargo nextest run -p <crate>` for the crate and the crates depending on
  it; for any path under `crates/`, `skills/`, `fixtures/`, or the binding's sources, also the
  TypeScript tests that load the binding; a change to `vite.tasks.ts` or the CI workflow runs the
  toolchain test. The selection function is pure, `select(files): Plan`, so it is testable.

- [x] **Step 1: Write the failing tests**

`scripts/fast-check.test.ts` tests `select` on four inputs: `packages/web/src/Composer.tsx` only (no
Rust command), `crates/core/src/...` (the core's Rust tests and the binding-loading TypeScript
tests), a `skills/uraeda/...` file (the same TypeScript tests), and `vite.tasks.ts` (the toolchain
test). The break each catches: dropping the binding tests after a Rust change; running Rust tests
for a web-only change.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test scripts/fast-check.test.ts --run`
- Expected: FAIL, `select` does not exist.

- [x] **Step 3: Implement**

Write `select` and a runner that executes the plan through `scripts/test-run.ts`, with the dev
shell's tools, and stops at the first failure. The binding-loading tests are the server and web
projects' files that import the binding (found from the import of `@uraeda/binding` or `binding.ts`,
not a hand-kept list). Make the task print the commands, not run a cache.

- [x] **Step 4: Measure SC-002**

- Run: touch one web file, then `time nix develop -c vp run fast`.
- Expected: under 1 minute. Record the time in `rulings.md`.

- [x] **Step 5: Run the project's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add scripts vite.tasks.ts
git commit -m "feat(fix-testing): add the fast check"
```

## Task 4: The core, CLI, and LSP flows

**Risky:** it deletes the tests that guard the git contract and every Rust rule the decisions end
with "Checked by ... tests": a gap guards nothing.

**Files:**

- Create: `crates/core/tests/flows/*.rs` behind one `flows.rs` binary per crate, one flow per
  command family or workflow step; `crates/cli/tests/flows/*.rs`; `crates/lsp/tests/flows/*.rs` (one
  per protocol feature)
- Delete: the old files of `crates/*/tests/` and unit tests whose behaviour a flow covers, in a
  commit apart from the flows, after the coverage report of the area is read before and after
- Modify: `rulings.md` (the area's mapping)

**Interfaces:**

- Consumes: the fast check (Task 3) and the existing `common/` helpers, kept where a flow uses them.
- Produces: flows owning the git, repositories, settings, attachments, problems, and cli rules.

- [x] **Step 1: Take the inventory and the coverage**

Run `nix develop -c vp run coverage` for the area, keep its summary, and list each old test file
with the behaviour it guards, from its test names and bodies. Write the mapping skeleton in
`rulings.md`.

- [x] **Step 2: Write the flows**

Write the flows from the specs and the decisions' rules: the real `ura` binary and the core on
temporary git repositories. Cover at least: reading a branch's step only from its latest commit (US1
3), answering and reviewing through the commands, checking files, starting and finishing a feature,
worktrees and pull request states, inbox and triage writes, the settings files, attachments and
images, problem reporting, the watcher, and each LSP feature. No flow asserts a message's exact
words except where a decision's rule fixes them.

The break each flow catches, by hand: for each flow of a write, git, or security rule, break the
code (read an older commit, skip a write, drop a validation) and record the failure in the ruling.

- [x] **Step 3: Run them**

- Run: `nix develop -c cargo nextest run`
- Expected: PASS on the flows and the old tests; each break run FAILS on its flow.

- [x] **Step 4: Delete the old tests**

Delete every old Rust test file and unit test the ruling's mapping places, or drops by a rule of the
spec (fails on a refactor, duplicates a faster path, asserts text, counts, or sizes, only observes).
Run the coverage again and list in the ruling what the area no longer runs.

- [x] **Step 5: Run the project's validation**

- Run: `nix develop -c vp run fast` then `nix develop -c vp run ready:rust`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add crates specs/2026-10-19-fix-testing/rulings.md
git commit -m "test(fix-testing): rebuild the Rust tests as flows"
```

## Task 5: The server flows

**Risky:** it rebuilds the guards of sign-in, the host guard, the preview proxy, and the runner.

**Files:**

- Create: `packages/server/src/__flows__/*.test.ts`, one flow per rule family: sign-in and the host
  guard (table-driven over every route), fate queries and mutations, live streaming, preview proxy
  and embed, the runner with a fake adapter, settings, repositories, attachments, and the notifier
- Delete: the old `packages/server/src/__tests__/*.test.ts` the mapping places, except
  `toolchain.test.ts` and `test-run.test.ts`, which Task 8 owns
- Modify: `rulings.md`

**Interfaces:**

- Consumes: the real server through its routes and the fate protocol, and `helpers.ts`.
- Produces: flows owning the sign-in, stack, repositories, attachments, settings, notifications, and
  agents rules.

- [ ] **Step 1: Inventory and coverage**, as in Task 4, for `packages/server`.
- [ ] **Step 2: Write the flows**, from the decisions' rules, with the break of each flow that
      guards security (an unsigned request, a foreign host) run by hand and reported.
- [ ] **Step 3: Run them**: `nix develop -c vp test --project server --run`. Expected: PASS, and
      each break FAILS its flow.
- [ ] **Step 4: Delete the old tests**, run the coverage again, and list in the ruling what the area
      no longer runs.
- [ ] **Step 5: Run the project's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add packages/server specs/2026-10-19-fix-testing/rulings.md
git commit -m "test(fix-testing): rebuild the server tests as flows"
```

## Task 6: The web flows

**Files:**

- Create: `packages/web/src/__flows__/*.test.tsx`, one flow per page: home, priorities, inbox,
  decisions, round, spec, review, session, settings, editor, plus change and add-repository
- Delete: the old `packages/web/src/__tests__/` files the mapping places, and the lint fixtures that
  no decision's rule needs
- Modify: `rulings.md`, `packages/web/src/__tests__/helpers.tsx` (kept and trimmed, or moved)

**Interfaces:**

- Consumes: the real app rendered in happy-dom against the real server and a fixture repository,
  shared helpers that build one repository per file, not per test.
- Produces: flows asserting behaviour by role, state, and navigation.

- [ ] **Step 1: Inventory and coverage**, as in Task 4, for `packages/web`.
- [ ] **Step 2: Write the flows.** One repository and server per file, shared by its tests. Include
      US1 1 and 2: the home page lists a feature at a gate with its Answer action and opening it
      reaches the round, and no assertion reads the heading's words. The break of each: remove the
      action, break the link target.
- [ ] **Step 3: Run them**: `nix develop -c vp test --project web --run`. Expected: PASS; the
      runtime of the project's files is under a third of the old 690 s.
- [ ] **Step 4: Delete the old tests**, run the coverage again, and list in the ruling what the area
      no longer runs.
- [ ] **Step 5: Run the project's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add packages/web specs/2026-10-19-fix-testing/rulings.md
git commit -m "test(fix-testing): rebuild the web tests as flows"
```

## Task 7: The browser flows

**Files:**

- Create: `packages/web/src/__browser__/` page checks that run every governed page at both sizes and
  in both themes, and the interaction flows that need a real layout
- Delete: every browser test that happy-dom now covers or that measures pixels
- Modify: `rulings.md`

**Interfaces:**

- Consumes: the web flows of Task 6, to know what happy-dom covers.
- Produces: the page checks the UI-checks decision requires, with accessibility rules only.

- [ ] **Step 1: Inventory**, as in Task 4, for `packages/web/src/__browser__`.
- [ ] **Step 2: Write the page checks**, one table-driven check per page, with the break "a page of
      the routes fails its accessibility rule", run by hand.
- [ ] **Step 3: Run them at both sizes**: `nix develop -c vp test --project phone --run` and
      `--project desktop`. Expected: PASS, in under a minute each, and CI-stable.
- [ ] **Step 4: Delete the old browser tests** the mapping places, and list what no longer runs.
- [ ] **Step 5: Run the project's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git add packages/web specs/2026-10-19-fix-testing/rulings.md
git commit -m "test(fix-testing): rebuild the browser tests as page checks"
```

## Task 8: The tooling flows

**Files:**

- Modify: `packages/server/src/__tests__/toolchain.test.ts` (kept only on rules of active
  decisions), `test-run.test.ts`, `packages/web/src/__tests__/lint.test.ts`,
  `crates/cli/tests/skill.rs` (the length test goes), and the coverage and worktree-seed script
  tests
- Delete: tooling tests that enforce no active decision's rule
- Modify: `rulings.md`

**Interfaces:**

- Consumes: the task graph of Task 3.
- Produces: one toolchain test covering the "Checked by the toolchain configuration's test" rules:
  every `ready` group has a CI job, CI runs the same checks uncached, no retries, isolation, and the
  fast check exists and does not replace `ready`.

- [ ] **Step 1: Inventory**, then **Step 2: write the kept tests** from the toolchain, stack, and
      distribution rules; the break: remove a CI job, add a retry.
- [ ] **Step 3: Run them**: `nix develop -c vp test --run`. Expected: PASS, breaks FAIL.
- [ ] **Step 4: Delete the others**, list them by rule, and run `nix develop -c vp run fast`.
- [ ] **Step 5: Commit**

```bash
git add packages crates scripts specs/2026-10-19-fix-testing/rulings.md
git commit -m "test(fix-testing): keep the tooling tests that enforce a rule"
```

## Task 9: The benchmarks flows

**Files:**

- Create: `packages/benchmarks/src/__flows__/*.test.ts`
- Delete: the old `packages/benchmarks/src/__tests__/` files the mapping places
- Modify: `rulings.md`

**Interfaces:**

- Produces: flows for the runner (fake adapter, no network), the record's schema, and each rule the
  benchmarks decision ends with "Checked by ... tests".

- [ ] **Step 1: Inventory**, **Step 2: write the flows** with a break by hand, **Step 3: run them**
      (`nix develop -c vp test --project benchmarks --run`), **Step 4: delete the old tests** and
      list them by rule, **Step 5: run `nix develop -c vp run fast`**.
- [ ] **Step 6: Commit**

```bash
git add packages/benchmarks specs/2026-10-19-fix-testing/rulings.md
git commit -m "test(fix-testing): rebuild the benchmarks tests as flows"
```

## Task 10: The Neovim smoke, the record, and the measures

**Files:**

- Modify: `editors/nvim/tests/*` (a smoke of the plugin's main actions on the real `ura lsp`),
  `.github/workflows/ci.yml` if a job's name changes, `rulings.md`, and the example or README only
  where a number or a path is now wrong

**Interfaces:**

- Produces: the record: every old test file mapped to its flow or dropping rule (SC-005), the
  coverage before and after each area, and the measured SC-001 to SC-003.

- [ ] **Step 1: Rebuild the Neovim tests as a smoke**: open a file, diagnostics, a code action, the
      waiting list, and a comment, with a break by hand; delete the other test files.
- [ ] **Step 2: Run the project's validation**: `nix develop -c vp run ready`. Expected: PASS.
- [ ] **Step 3: Complete the record**: each old test file maps to a flow or a rule; a file with
      neither is an unplaced test and fails the review.
- [ ] **Step 4: Commit**

```bash
git add editors specs .github
git commit -m "test(fix-testing): rebuild the Neovim tests as a smoke, and record the mapping"
```

After the final review pushes the branch, three consecutive CI runs and five repeats of the same
commit give SC-001 and SC-003; record them in the pull request's description.
