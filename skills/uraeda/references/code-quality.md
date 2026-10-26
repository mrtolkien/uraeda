# Code quality

Four concepts that keep a project maintainable without the human reading its code, what each asks at
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
- **The final review** checks each function and file the branch grew: one it grew past a limit is a
  point of the pull request's opening block.

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

## Testing

A test is evidence that the code does what the approved spec, the decisions, and the human's
requests say. It never overrides them. Every test is also maintenance, so a project wants the right
tests, not many.

### How many

The project's testing decision, `specs/decisions/testing.md`, says how much to test at its stage.
Discovery asks a project without one to adopt it, once. Without one, test only what is costly to get
wrong and rarely changes: stored formats, git and other writes, security, contracts between the
project's parts, pure logic with many cases, and the reproduction of each bug fixed.

- **The spec's key scenarios and high edge cases set the ceiling**: count them, and add no more new
  tests than that. Each gets one test at most, and none where the stage asks none. A rarer scenario,
  a lower edge case, or a review-focus item joins one of those tests, as a row or an assertion, or
  has no test. The plan's test map says "none" and why for each row without one.
- **The existing tests first.** Read the tests of the code a task changes before writing one, and
  ask of each new test: which test would already fail if this behaviour broke? Look at the existing
  tests, the planned ones, and the tests the task rewrites, whose new expectation often proves the
  new behaviour already. When there is one, add nothing: the test map names it. A new case of a
  behaviour that has a test goes into that test, as a row or an assertion. A new test that would
  prove all an existing one proves replaces it, in the same commit.
- **Assert only what the task adds.** A new test checks the behaviour the task adds or changes, and
  leaves what existing tests already check to them. When the code returns several results, such as a
  list of problems, a test of a new one picks it out, by its message or its kind, and asserts it
  alone, or its absence: it never compares the whole list. A case existing tests already run, such
  as the unchanged path of valid input, gets no new test.
- **One layer per rule.** A rule that two entry points reach, such as a check and a view built on
  it, gets one test, through the entry point whose path runs all the code the rule depends on. A
  test of the inner one adds nothing.
- **A UI gets few tests**, only for behaviour that is costly to lose and that using the app would
  not show, such as unsaved text or a git write. The human checks the rest by using the app.
- **A project's constitution stays in force.** When it asks for more, such as a test per scenario,
  follow it.

### What a test asserts

What a caller or a user observes, never how the code does it. An exact contract is asserted exactly:
user text, a permission scope, a commit count, a byte sequence. A test that passes with another
value does not own it. Every expectation comes from the spec, the decisions, and the human's intent,
never from the code under test.

### Writing one

- **Test-first** for logic, contracts, and bug fixes. A test of a UI may follow its code.
- **Real components, in-memory stores, a clock the test sets.** A fake stands only at a boundary the
  project does not own. A boundary test owns what only the real boundary shows: a git history, a
  native binding, a request and its response, a file on disk.
- **Short**: Arrange, Act, Assert, with a name that states the scenario. Shared helpers, fixtures,
  and fakes hold the setup, so a test holds none.
- **Independent**: a case passes alone, in any order. A sequence that cannot be split is one test.
- **Pure logic with many cases** is one table-driven test, a row per case the spec names, not per
  value.
- **No fixed wait, no elapsed time**: a test waits for the condition, or sets the clock. A benchmark
  of a spec's success criterion is not a unit test.

### Tests that can fail

A test that passes whatever the code does proves nothing. Each test names the break it catches, the
realistic mistake that makes it fail: "adding a month to the previous date, which drifts to the
30th". For a guarantee of security, git, writes, or an exact contract, and for every task marked
**Risky**, the implementer makes that break once the test passes, sees it fail, reverts it, and
reports the failure in the task's commit body. For other tests, the reading of the test against its
named break is the proof. A mutation tool, where the project has one, does the same. The reviews
count a test that asserts nothing, or nothing the spec asks, as an important finding.

### When a test goes

A test gives way to the approved spec, the decisions, and the human's requests, and code never bends
to keep a test. A test that fails is in one of four cases:

1. **It guards behaviour the approved spec lists as replaced**: rewrite or remove it in the task
   that changes the behaviour. No ruling: the spec's approval covered it.
2. **It guards behaviour the spec replaces but did not list**: remove it with a one-line ruling. The
   final review lists it.
3. **It fails because of the human's own request**: change it when the change is safe and
   reversible, and say which test and why in the same response. Otherwise stop, and say what
   conflicts and what each way out costs.
4. **Nothing approved replaces what it guards**: the code is wrong. Fix the code, and say so in the
   commit body. Never edit the assertion, skip the test, or raise a timeout, and never change code
   only to keep a test green.

A test that fails on a change that keeps what callers and users observe, such as a split of a unit
over its limit, asserts how the code does it: remove it with a one-line ruling, as in the second
case.

A test that fails only because the new rule now flags its data, such as a date that now warns, keeps
its point: move its data well away from the new rule, never onto the rule's edge, since the new
rule's own tests own its edges.

Checks: the reviews of the tasks and the final review, which count a test that bends the code, or
that went without one of these cases, as a finding.

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
