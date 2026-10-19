# Code quality

Six concepts that keep a project maintainable without the human reading its code, what each asks at
each step, and the checks behind it; then how a project sets those checks up.

Agents extend the code they find. Feature after feature, functions and files grow, rules get copied
into a second place, and patterns are repeated whether they are good or not. Instructions lower the
starting level, not the decay: what holds a codebase is a check that fails. So each concept below
names its checks, and the steps link here for the why rather than repeating it.

The limits themselves are the project's: they live in its code-quality decision,
`specs/decisions/code-quality.md`, and in its linters' configuration. See
[setting up checks](#setting-up-checks).

## One home per rule

A rule, like "a due date is a calendar day" or "only the store opens the database", is enforced in
one place that every caller goes through. A copy in another layer or language drifts from the first
the day one of them changes.

- **Discovery** lists who owns each rule the feature touches today: the module, type, decision, or
  test that enforces it, and every place it is copied.
- **The spec's architecture** says where each new rule lives.
- **The plan** gives each changed rule one enforcement point. A copy it cannot avoid, such as a
  check repeated in the browser for speed, is a row of complexity tracking, with the reason.
- **The reviews** look for the same decision made in two places.

Checks: types and generated bindings, so a second definition cannot compile; architecture tests,
like one that refuses a parser import outside its module; and the review, with discovery's list of
owners. No tool finds one rule written twice in two languages.

## Extract, don't grow

Structure and behaviour change in separate commits, structure first: a unit over its limit is split
before new behaviour goes in, not after.

- **The plan**: a task that touches a function or file over the project's limit starts with a
  structural step. The step only restructures the unit: the tests pass before and after, its marker
  goes away, and it is committed on its own, before the failing test of the new behaviour.
  **Complexity tracking** lists every new abstraction, and every unit a task grows past a limit or
  leaves over one, with the reason.
- **The reviews of the tasks** flag what the tasks grew, not sizes that were already there.
- **The final review** reports each function and file the branch grew, with its length before and
  after, in the pull request's description.

Checks: the limits in the project's linters, and the markers on today's offenders, which fail once
their code is fixed. A new marker is a constitution exception: the human approves it in the plan.

## Rules enforced by tools

A rule only a reader remembers is followed until someone forgets it. A rule a tool checks holds.

- **Each rule of a decision ends with how it is checked**: a lint, a test, `ura check`, or "Checked
  by review." when no tool can. Review only is an honest answer: it tells the next agent that
  nothing else guards the rule.
- **A decision a tool can check**, proposed by a spec, gets that check in the plan's **Test map**.
  The plan then has a task that adds it.
- **A custom lint rule or structural test says the fix in its message**: "split this file by
  responsibility", not only "file too long". The agent that hits it reads the message, not the
  decision.
- **When a written rule keeps being missed**, move it into code: a type, a lint, a test.

Checks: the project's linters and tests, in its usual validation command, so every step runs them.

## Writing tests

Test the behaviour that matters, the way a user or a caller uses it: integration tests, through the
real components, with real objects over mocks (real files, real git, the real server) and the clock
set by the test. They survive refactoring, where unit tests of internal functions break. An agent
writes them quickly.

- **A test comes from the spec, never from the code.** It names the behaviour it guards: a story's
  main scenario, a `high` edge case, or a success criterion. A `normal` edge case is a line in a
  test that exists, never a test of its own.
- **A bug starts with a failing test** that reproduces it, before any fix.
- **A test fails on behaviour, not on text, counts, or sizes.** It asserts no heading, label, count,
  or size the product may change. A UI test finds things by role and state, and asserts navigation
  and effects, not wording. The accessibility rules of a page check are the exception.
- Tests are part of the codebase: organize them with the same care as the main code.
- Create the helpers, fixtures, and fakes the tests need, in shared files: rendering the app,
  seeding the store, setting the clock. Each test then holds no boilerplate.
- Readability is a key feature of a test. Each one is short and readable by a human: Arrange, Act,
  Assert, in that order, with a name that states the scenario. Test files stay short.
- Write unit tests only for pure logic with many cases, as one table-driven test: one row per case.
- A UI story's scenarios run in the project's browser runner: see
  [UIs verified end to end](#uis-verified-end-to-end).

Checks: the review of each task, which counts a test that breaks these rules as a finding.

## Tests that can fail

A test that passes whatever the code does proves nothing. A test MUST fail when the behaviour it
guards breaks, and MUST NOT fail when a change keeps that behaviour.

- **The break**: a task the plan marks risky, and a task whose tests cover code that writes files,
  touches git, or guards security, shows each test catching its break. The plan's test step names
  the realistic mistake that makes it fail: "adding a month to the previous date, which drifts to
  the 30th". The implementer, once the test passes, makes that break in the code, sees the test
  fail, reverts it, and reports the failure in the task's commit body. Other tests need no break.
- **Waits**: tests never sleep for a fixed time, retry, or assert how long something took. They wait
  for the condition, or set the clock. Benchmarks of a spec's success criteria are not unit tests.
- **A test and the human's request differ**: the request is done, and the test changed or removed,
  after telling the human in the same response, as the [skill](../SKILL.md) says of a human's
  request. A ruling records the test's old and new expectation.
- **A test fails with no request from the human**: find the root cause first. When the code is
  wrong, fix the code, within the spec. When it cannot be fixed within the spec, stop and report:
  never edit the test, loosen it, skip it, or bend the product to make them agree.
- **A test that fails without a bug**, such as one that pinned text a refactor changed, is fixed or
  deleted with a ruling saying what it guarded and why that no longer holds.
- **The reviews** count a test that asserts nothing, or nothing the spec asks, as an important
  finding. The final review lists every test removed, skipped, or changed in what it expects: see
  [the final review](implementation.md#review-the-branch).

Checks: the reported failure, which the reviews of the tasks read, and the final review's list. A
mutation tool, where the project has one, does the same on the changed lines.

## UIs verified end to end

A UI story is only done when it works in a browser, through the real app: components tested alone
miss the routing, the styles, and the server.

- **The plan's Test map** runs each UI story's main scenarios and `high` edge cases in the project's
  browser runner, through the real app. They drive it as a user does: by roles and labels, and
  assert state and navigation, not wording.
- **A project without a browser runner**: adding one is a new dependency, so a question for the
  human in discovery, like any other.

Checks: the browser tests, in the project's validation.

## Setting up checks

A project sets its limits in its own linters, so the checks run wherever its code is checked, with
or without Uraeda. Setup proposes it in a code-quality decision, and a project that has none is
asked once, by discovery. The [example](../assets/example/specs/decisions/code-quality.md) is a
model.

- **Limits**: function length, parameters, nesting depth, and file length, in the linters the
  project has: clippy's `too_many_lines`, Oxlint's or ESLint's `max-lines-per-function`,
  `max-lines`, `max-params`, and `max-depth`, Ruff's `PLR0915`. Pick values today's code mostly
  meets, so the markers stay few; tighter ones can come later.
- **The stack's shared config**: when the stack has a lint configuration of its own, extend it. A
  rule of it is turned off only where it conflicts with an active decision, named next to it.
- **Today's offenders, marked in place**, each with its reason: in Rust,
  `#[expect(clippy::<lint>, reason = "...")]`; in TypeScript,
  `// oxlint-disable-next-line <rule> -- <reason>`, or ESLint's equivalent. A marker on code that no
  longer breaks its limit fails the checks: clippy's `-D warnings` on an unfulfilled `expect`, a
  report of unused disable directives as errors. The numbers can only go down.
- **A limit no linter has**, like the length of a Rust file, is a small structural test with a list
  of today's offenders and their lengths. It fails on a new one, on a listed one that grew, and on a
  listed one now under the limit, saying how to fix each.
- **A project that wants no limits** gets the decision anyway: it says so, with a date in its
  **Revisit when**. Discovery does not ask again before that date.

Each rule of the decision says which of these checks it, as
[rules enforced by tools](#rules-enforced-by-tools) asks.
