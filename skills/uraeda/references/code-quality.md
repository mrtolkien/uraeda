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

Each guarantee gets the cheapest check that fully owns it. A focused test, through the real
components and an in-memory store, with the clock set by the test, owns local behaviour: it survives
refactoring, where tests of internal functions break. A boundary test owns what only the real
boundary shows: a git history, a native binding, a request and its response, a file on disk. A
complete journey through the whole app proves that the parts connect, once for a story's main
scenario, and does not repeat what a focused test owns. An agent writes them quickly.

Coverage follows the spec: each main scenario, each high-risk edge, and each success criterion has a
meaningful check. One test may own several sentences of the spec, and a sentence needs no test of
its own when another check owns it. Every check derives its expectation from the spec, the
decisions, and the human's intent, never from the code under test.

- **An exact contract is asserted exactly**: user text, a permission scope, a commit count, a byte
  sequence. A check that passes with another value does not own it.
- **A project's constitution stays in force.** When it requires more than this section, such as a
  test per acceptance scenario, follow the constitution.

- Tests are part of the codebase: organize them with the same care as the main code.
- Create the helpers, fixtures, and fakes the tests need, in shared files: rendering the app,
  seeding the store, setting the clock. Each test then holds no boilerplate.
- Readability is a key feature of a test. Each one is short and readable by a human: Arrange, Act,
  Assert, in that order, with a name that states the scenario. Test files stay short.
- Write unit tests only for pure logic with many cases, as one table-driven test: one row per case.
- A case that does not depend on another passes alone, in any order. A sequence that cannot be split
  is one test.
- A UI story's main scenario runs once in the project's browser runner: see
  [UIs verified end to end](#uis-verified-end-to-end).

Checks: the review of each task, which counts a test that breaks these rules as a finding.

## Tests that can fail

A test that passes whatever the code does proves nothing. Each test names the break it exists for,
and the risky ones are shown to catch it.

- **The plan**: each test step names the break each test catches, the realistic mistake that makes
  it fail: "adding a month to the previous date, which drifts to the 30th".
- **The implementer**, for a guarantee of security, git, writes, or an exact contract, and for every
  task marked **Risky**, makes that break in the code once the test passes, sees the test fail,
  reverts it, and reports the failure it saw in the task's commit body. For a low-risk check, the
  reading of the test against its named break is the proof, and the review counts it.
- **A spec conflict stops the work**: a test that fails against the spec, with no human request
  behind the change, is fixed within the task's scope or reported as a conflict, with what each way
  out costs. The assertion is never weakened to pass.
- **Waits**: unit tests never sleep for a fixed time or assert how long something took. They wait
  for the condition, or set the clock. Benchmarks of a spec's success criteria are not unit tests.
- **Existing tests**: removing, skipping, or loosening one, or raising a timeout, takes a ruling,
  saying what it checked, which check owns it now, and why that no longer holds. A test is never
  loosened to pass. The final review and the pull request list these changes apart from the rest.
- **A human's request outranks a test**: when a requested change breaks a test, the test changes,
  and the response says which one and why.
- **The reviews** count a test that asserts nothing, or nothing the spec asks, as an important
  finding.

Checks: the reported failure, which the reviews of the tasks read. A mutation tool, where the
project has one, does the same on the changed lines.

## UIs verified end to end

A UI story is only done when its main scenario works in a browser, through the real app: components
tested alone miss the routing, the styles, and the server.

- **The plan's Test map** runs each UI story's main scenario in the project's browser runner,
  through the real app. It drives the app as a user does: by roles, labels, and visible text. The
  story's other scenarios and edges are focused tests, unless they depend on the routing, the
  styles, or the server.
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
