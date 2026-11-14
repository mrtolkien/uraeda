# Code quality

Four ideas that keep a project maintainable without the human reading its code, what each asks of
the steps, and how a project sets its checks up.

Agents extend the code they find. Feature after feature, functions and files grow, rules get copied
into a second place, and patterns are repeated whether they are good or not. Instructions lower the
starting level, not the decay: what holds a codebase is a check that fails. So each idea below names
its checks.

The limits themselves are the project's: they live in its code-quality decision,
`specs/decisions/code-quality.md`, and in its linters' configuration.

## One home per rule

A rule, like "a due date is a calendar day" or "only the store opens the database", is enforced in
one place that every caller goes through. A copy in another layer drifts from the first the day one
of them changes.

- **Discovery** lists who owns each rule the feature touches, and every place it is copied.
- **The spec's architecture** says where each new rule lives.
- **The plan** gives each changed rule one enforcement point. A copy it cannot avoid is a row of
  complexity tracking, with the reason.
- **The reviews** look for the same decision made in two places.

The same holds for what users see: one kind of information is drawn by one component, wherever it
shows. Two views built side by side are the usual place a second copy appears.

Checks: types and generated bindings, architecture tests, and the review.

## Extract, don't grow

Structure and behaviour change in separate commits, structure first: a unit over its limit is split
before new behaviour goes in, not after.

- **The plan**: a task that touches a function or file over the project's limit starts with a
  structural step. It only restructures: the tests pass before and after, and it is committed on its
  own. **Complexity tracking** lists every unit a task grows past a limit.
- **The reviews** flag what the branch grew, not sizes that were already there.

Checks: the limits in the project's linters, and the markers on today's offenders, which fail once
their code is fixed. A new marker needs the human's approval: the plan lists it and waits for their
review, and a change that needs one becomes a feature. A unit the branch grew past a limit is named
in the pull request.

## Rules enforced by tools

A rule only a reader remembers is followed until someone forgets it. A rule a tool checks holds.

- **When a written rule keeps being missed, move it into code**: a type, a lint, a test.
- **A custom lint rule or structural test says the fix in its message**: "split this file by
  responsibility", not only "file too long". The agent that hits it reads the message.
- **A boundary a tool can check gets its check**: a task of the plan adds it. The decision does not
  name the check: the code does.

## Testing

A test is evidence that the code does what the approved spec, the decisions, and the human's
requests say. It never overrides them. Every test is also maintenance: a project wants the right
tests, not many.

### How many

The project's testing decision, `specs/decisions/testing.md`, says how much to test at its stage.
Without one, test what is costly to get wrong and rarely changes: stored formats, git and other
writes, security, contracts between the project's parts, pure logic with many cases, and the
reproduction of each bug fixed. Within that:

- **Each test catches a failure worth catching.** Name the plausible mistake it would catch. If you
  cannot, or the mistake would cost little, do not write it. Start from the spec's key scenarios and
  its high edge cases: a rarer case joins one of their tests, as a row or an assertion, or goes
  untested.
- **The existing tests first.** Of each new test, ask which test would already fail if this
  behaviour broke. When one would, add nothing. A new case of a tested behaviour goes into that
  test, and a new test that proves all an old one proves replaces it.
- **One layer per rule.** A rule two entry points reach gets one test, through the one whose path
  runs all the code the rule depends on.
- **A new test asserts what the task adds.** It leaves what existing tests check to them, and
  compares a whole list of results only when the whole list is the contract.

A UI gets few tests by default: UI testing is hard to get right. Follow the human's requests, the
decisions, and the constitution on it. What tests do not cover there, using the product does: see
[use it](implementation.md#use-it). A project's constitution stays in force: when it asks for more,
follow it.

### What a test asserts

What a caller or a user observes, never how the code does it. An exact contract is asserted exactly:
user text, a permission scope, a byte sequence. Every expectation comes from the spec, the
decisions, and the human's intent, never from the code under test.

### Writing one

- **Test-first** for logic, contracts, and bug fixes. A test of a UI may follow its code.
- **Real components, in-memory stores, a clock the test sets.** A fake stands only at a boundary the
  project does not own. A guarantee that depends on a real boundary, a git history, a native
  binding, a request, a file on disk, is tested through it.
- **Short**: Arrange, Act, Assert, with a name that states the scenario. Shared helpers hold the
  setup.
- **Independent**: a case passes alone, in any order.
- **Pure logic with many cases** is one table-driven test, a row per case the spec names.
- **No fixed wait, no elapsed time**: a test waits for the condition, or sets the clock. A benchmark
  of a success criterion is not a unit test.

### Tests that can fail

A test that passes whatever the code does proves nothing. Each test names the break it catches, the
realistic mistake that makes it fail: "adding a month to the previous date, which drifts to the
30th". For a guarantee of security, git, writes, or an exact contract, and for every task marked
**Risky**, the implementer makes that break once the test passes, sees it fail, reverts it, and says
so in the commit's body.

### When a test goes

A test gives way to the approved spec, the decisions, and the human's requests. Code never bends to
keep a test. A test that fails is in one of four cases:

1. **It guards behaviour the approved spec lists as replaced**: rewrite or remove it in the task
   that changes the behaviour. The spec's approval covered it.
2. **It guards behaviour the spec replaces but did not list**, or it asserts how the code works
   rather than what users observe: remove it, with a one-line ruling.
3. **It fails because of the human's own request**: change it when that is safe and reversible, and
   say which test and why in the same response. Otherwise stop, and say what conflicts.
4. **Nothing approved replaces what it guards**: the code is wrong. Fix the code. Never edit the
   assertion, skip the test, or raise a timeout.

A test that fails only because a new rule now refuses its data keeps its point: move its data well
away from the new rule's edge.

## Setting up checks

A project sets its limits in its own linters, so the checks run wherever its code is checked. Setup
proposes it in a code-quality decision, as [setting up a project](projects.md#setting-up-a-project)
says. The [example](../assets/example/specs/decisions/code-quality.md) is a model.

- **Limits**: function length, parameters, nesting depth, and file length, in the linters the
  project has. Pick values today's code mostly meets, so the markers stay few.
- **The stack's shared config**: when the stack has a lint configuration of its own, extend it. A
  rule of it is turned off only where it conflicts with a decision, named beside it.
- **Today's offenders, marked in place**, each with its reason, with a marker that fails once the
  code no longer breaks its limit: Rust's `#[expect(...)]`, a lint's unused-directive report. The
  numbers can only go down.
- **A limit no linter has** is a small structural test listing today's offenders and their sizes,
  which fails on a new one, a grown one, and a listed one now under the limit, and says how to fix
  it.
- **A project that wants no limits** gets the decision anyway: it says so, with a date in its
  **Revisit when**.
