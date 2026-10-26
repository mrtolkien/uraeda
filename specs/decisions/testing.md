---
status: proposed
approved-by:
icon: flask-conical
---

# Testing

Tests let the project change with confidence: they are evidence of what the human asked for, never
an authority over it. How much is tested follows the project's stage, now `early`: only what is
costly to get wrong and rarely changes, such as stored formats, git, security, and the contracts
between the core, the CLI, and the server. The web UI is not tested automatically: the human reviews
it live in the sandbox.

## Rules

- A test MUST give way to the approved spec, the decisions, and the human's requests: a test that
  guards behaviour they replace is rewritten or removed in the task that changes the behaviour,
  never kept by bending the code. Checked by review.
- A spec that replaces behaviour MUST list it with the tests that guard it, so its approval covers
  their removal, and the record MUST name them. Checked by review.
- A test MUST assert behaviour a caller or a user can observe through a public interface, and MUST
  NOT assert markup, class names, sizes, call sequences, or private state. Checked by review.
- At the `early` stage, a feature MUST test only stored formats, git, security, contracts between
  the project's parts, pure logic with many cases, and the reproduction of each bug fixed. Checked
  by review.
- The web UI MUST NOT have automated UI tests. Checked by review.
- The stage MUST be set by the human, and moves only when they say so. Checked by review.
- Pure logic extracted from the web UI MAY have unit tests. Checked by review.

## Why

Agents bent code to keep old tests green, because nothing said what to do with a test whose
behaviour the approved spec replaced, and the suite grew to about 3,900 tests with no limit
([why tests are bent](../2026-10-26-testing-communication/clarifications-01.md#q2-what-happens-to-a-test-that-guards-behaviour-the-approved-spec-replaces)).
The human chose to scale testing with the stage, since in early development tests are "undue
inertia"
([stages](../2026-10-26-testing-communication/clarifications-01.md#q3-does-testing-effort-scale-with-the-projects-stage)).
They would "rather review actual behaviour with the sandbox" than keep UI tests
([UI testing](../2026-10-26-testing-communication/clarifications-01.md#q4-how-should-the-web-ui-be-tested)).
Speed, retries, and flaky tests stay with the [toolchain](toolchain.md) decision.

## Alternatives considered

- Keep today's rule, a ruling per removed test: it pushed agents to bend code.
- Tests of the UI by browser and screenshots: slow, tied to the look, and tests drifted from what
  the human asked for.

## Consequences

- A change to the look or the behaviour of a view costs no test edit, and no automatic check holds a
  UI behaviour, an accessibility rule, or a size: a regression there is found by the human's review.
- Moving to `growing` will need a new answer on what the UI is tested by.
- A spec carries one more list to read, the behaviour it replaces.

## Applies to

- Every feature and change, and the tests of [`crates/`](/crates/), [`packages/`](/packages/),
  [`scripts/`](/scripts/), and [`benchmarks/`](/benchmarks/)

## Revisit when

The human says the project is no longer `early`.
