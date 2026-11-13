---
icon: flask-conical
---

# Testing

> "I'm down for tests but they should be useful: each test is added maintenance, because tests also
> drift away from expected behaviour."

The project's stage is `early`. At that stage a feature tests little beyond what is costly to get
wrong and rarely changes:

- stored formats, git, and security;
- the contracts between the core, the CLI, the server, and the app;
- pure logic with many cases, and the reproduction of each bug it fixes.

The human checks the app by using it. [The testing guide](../guides/testing.md) shows what this
looks like.

## Rules

- A test gives way to the approved spec, the decisions, and the human's requests. _So:_ a test of
  behaviour they replace is rewritten or removed in the task that changes it, never kept by bending
  the code.
- The stage is the human's, and moves only when they say so. _So:_ the page that starts a feature
  from an inbox note got no test of its own. The server's tests own the git write, and using the app
  shows the page.
- A test of the app's UI guards behaviour that is costly to lose and that using the app would not
  show. _So:_ a message that comes back when its send is refused has a test, and a view's layout has
  none.
- A picture of the app is a tool to look with, never a check, and none is committed for review.
  _So:_ `just walk` writes its pictures in `target/`, and no comparison of pixels fails a build.
- A test that fails without a bug is fixed in the pull request that finds it, or removed when it
  guards nothing important. It is never retried, and never left failing. _So:_ a width check failed
  now and then, with no cause found, and the case before it held the same guarantee. It was removed
  with a ruling, and the human was not asked again.
- The one exception is a test that failed on a saturated machine. It is run again, at most twice,
  once the machine is quiet, or by its runner when it draws on a real display. It is never hunted by
  loading the machine or looping the test. _So:_ a drawing check failed twice under other builds'
  load, and passed three times of three on a quiet machine. It was run again, and named in a ruling.

## Why

Every test costs upkeep, and a test of behaviour a spec replaces pushes an agent to bend the code to
keep it passing. Early on, most behaviour still changes, so a test is inertia unless a mistake there
is costly. The human judges the app by using it, so a UI test earns its place only where using the
app would not show the loss. A failure has to mean a bug: a retry hides a real race, and a test that
fails for nothing teaches everyone to ignore failures. History:
[Testing communication](../done/2026-10-26-testing-communication.md).

## Alternatives considered

- A ruling for each removed test, the earlier rule: it pushed agents to bend the code instead.
- Tests of the UI by screenshots, measures, or pixel comparisons: slow, and tied to a look that
  changes weekly.
- Screenshots committed with each change: the repository filled with images nobody read again.
- Retries that report the flaky tests: they hide real races.

## Applies to

- Every feature and change, and the tests of [`crates/`](/crates/), [`app/`](/app/), and
  [`scripts/`](/scripts/)

## Revisit when

The human says the project is no longer `early`.
