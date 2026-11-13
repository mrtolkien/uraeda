---
icon: flask-conical
---

# Testing

> "Test what would hurt to break. I'll check the UI by using it."

The project's stage is `early`: only what is costly to get wrong and rarely changes is tested, such
as stored formats, git, security, and the contracts between the core, the CLI, and the server.

## Rules

- A test gives way to the approved spec, the decisions, and the human's requests. _So:_ a test of
  replaced behaviour is rewritten or removed, never kept by bending the code.
- A test asserts what a caller or a user observes. _So:_ a refactoring keeps it green.
- A test of the web UI guards only what using the UI would not show. _So:_ unsaved text and a git
  write are tested, a layout is not.
- The stage is the human's, and moves only when they say so. _So:_ no feature adds a test for every
  sentence of its spec on its own.
- The agent reviews each changed view in the running app before handing it over. _So:_ in both
  themes, at a phone's and a desktop's width, in the [sandbox](sandbox.md).

## Why

Agents bent code to keep old tests green, and the suite grew to about 3,900 tests. Early on, tests
are undue inertia, and UI tests made each visual change cost test edits. History:
[Testing communication](../done/2026-10-26-testing-communication.md).

## Alternatives considered

- Browser tests with screenshots or pixel comparisons: slow, and tied to the look.

## Applies to

- Every feature and change, and the tests of [`crates/`](/crates/), [`packages/`](/packages/),
  [`scripts/`](/scripts/), and [`benchmarks/`](/benchmarks/)
- [`packages/web/`](/packages/web/), and every feature or change that adds or changes a view

## Revisit when

The human says the project is no longer `early`.
