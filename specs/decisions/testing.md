---
icon: flask-conical
---

# Testing

> "I'm down for tests but they should be useful: each test is added maintenance, because tests also
> drift away from expected behaviour."

The project's stage is `early`. At that stage a feature tests little beyond what is costly to get
wrong and rarely changes:

- stored formats, git, and security;
- the contracts between the core, the CLI, the pages, and the vault's sync with the phone;
- pure logic with many cases, and the reproduction of each bug it fixes.

The human checks the pages by using them. [The testing guide](../guides/testing.md) shows what this
looks like.

## Rules

- A test gives way to the approved spec, the decisions, and the human's requests. _So:_ a test of
  behaviour they replace is rewritten or removed in the task that changes it, never kept by bending
  the code.
- The stage is the human's, and moves only when they say so. _So:_ the settings page's layout got no
  test of its own. The write that keeps the settings file's comments has one, and using the page
  shows the rest.
- A test of a page's UI guards behaviour that is costly to lose and that using the page would not
  show. _So:_ an answer written over one that changed since is refused, and has a test; a page's
  layout has none.
- A picture of a page is a tool to look with, never a check, and none is committed for review. _So:_
  pictures taken in the sandbox stay out of the repository, and no comparison of pixels fails a
  build.
- A test that fails without a bug is fixed in the pull request that finds it, or removed when it
  guards nothing important. It is never retried, and never left failing. _So:_ a width check failed
  now and then, with no cause found, and the case before it held the same guarantee. It was removed
  with a ruling, and the human was not asked again.
- The one exception is a test that failed on a saturated machine. It is run again, at most twice,
  once the machine is quiet. It is never hunted by loading the machine or looping the test. _So:_ a
  drawing check failed twice under other builds' load, and passed three times of three on a quiet
  machine. It was run again, and named in a ruling.

## Why

Every test costs upkeep, and a test of behaviour a spec replaces pushes an agent to bend the code to
keep it passing. Early on, most behaviour still changes, so a test is inertia unless a mistake there
is costly. The human judges the pages by using them. A failure has to mean a bug: a retry hides a
real race, and a test that fails for nothing teaches everyone to ignore failures. History:
[Testing communication](../done/2026-10-26-testing-communication.md).

## Alternatives considered

- A ruling for each removed test, the earlier rule: it pushed agents to bend the code instead.
- Tests of the UI by screenshots or pixel comparisons, and screenshots committed with each change:
  slow, tied to a look that changes weekly, and images nobody read again.
- Retries that report the flaky tests: they hide real races.

## Applies to

- Every feature and change, and the tests of [`crates/`](/crates/) and [`scripts/`](/scripts/)

## Revisit when

The human says the project is no longer `early`.
