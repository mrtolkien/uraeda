---
status: active
approved-by: human
icon: flask-conical
---

# Testing

Tests check that the code behaves as the decisions and the approved spec say, and never override
them. How much is tested follows the project's stage, now `early`: only what is costly to get wrong
and rarely changes, such as stored formats, git, security, and the contracts between the core, the
CLI, and the server. The human checks the web UI by using it in the [sandbox](sandbox.md), so tests
of the UI are rare.

## Rules

- A test MUST give way to the approved spec, the decisions, and the human's requests: a test of
  behaviour they replace is rewritten or removed in the task that changes it, never kept by bending
  the code. Checked by review.
- A spec that replaces behaviour MUST list it with the tests that guard it, so its approval covers
  their removal. Checked by review.
- A test MUST assert what a caller or a user observes, never how the code does it. Checked by
  review.
- At the `early` stage, a feature MUST test little beyond stored formats, git, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed.
  Checked by review.
- A test of the web UI MUST guard behaviour that is costly to lose and that using the UI would not
  show, such as unsaved text or a git write. Checked by review.
- The stage MUST be set by the human, and moves only when they say so. Checked by review.
- A UI change MUST be easy to try in the running app, through the sandbox. Checked by review.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width. Checked by review.
- The agent MUST NOT wait for a live review of each UI change: the human may review several
  together, after merging. Checked by review.
- A pull request that adds a view MUST show one screenshot of it, never committed to the repository.
  Checked by review.

## Why

Agents bent code to keep old tests green, since nothing said what to do with a test of replaced
behaviour, and the suite grew to about 3,900 tests. Early on, tests are undue inertia. UI tests were
slow, tied to the markup, and made each visual change cost test edits, while the human prefers to
review actual behaviour in the sandbox. History:
[Testing communication](../done/2026-10-26-testing-communication.md).

## Alternatives considered

- A ruling per removed test, the earlier rule: it pushed agents to bend code.
- Browser tests with screenshots, measures, or pixel comparisons: slow, tied to the look, and
  failures only CI shows.
- Screenshots committed with each change: the repository filled with images nobody read again.

## Consequences

- A change to a view's look or behaviour costs almost no test edit, and a UI regression is found by
  the human's review.
- The sandbox must stay easy to start, since it is the UI's check.
- Moving to `growing` needs a new answer on what tests the UI.
- A spec carries one more list to read: the behaviour it replaces.

## Applies to

- Every feature and change, and the tests of [`crates/`](/crates/), [`packages/`](/packages/),
  [`scripts/`](/scripts/), and [`benchmarks/`](/benchmarks/)
- [`packages/web/`](/packages/web/), and every feature or change that adds or changes a view

## Revisit when

The human says the project is no longer `early`.
