---
status: active
approved-by: benchmark
icon: ruler
---

# Code quality

Code respects the limits qutebrowser's linters already set. Pylint limits line length and the number
of arguments, and flake8 the complexity of a function. The limits live in the linters'
configuration, so they hold with or without this workflow.

## Rules

- Lines MUST NOT be longer than 190 characters, except the lines pylint's `ignore-long-lines`
  exempts, like URLs. Checked by pylint's `max-line-length` in [`.pylintrc`](/.pylintrc), run by
  `tox -e pylint`.
- Functions MUST NOT take more than 10 arguments. Checked by pylint's `max-args` in
  [`.pylintrc`](/.pylintrc), run by `tox -e pylint`.
- Functions MUST NOT have a cyclomatic complexity over 12. Checked by flake8's `max-complexity` in
  [`.flake8`](/.flake8), run by `tox -e flake8`.
- A feature or change MUST NOT change these limits in `.pylintrc` or `.flake8` unless a human asks
  for it. Checked by review.
- A function that reaches a limit SHOULD be split, rather than silenced with a `# pylint: disable=`
  or `# noqa` comment. Checked by review.

## Why

The project had no code-quality decision, and its linters already set these limits. Recording them
writes down what holds, without touching linters unrelated to the feature that asked
([the question](../done/2026-10-19-qutebrowser-process-messages.md#q4-should-the-project-record-its-code-quality-limits-as-a-decision),
[discovery](../done/2026-10-19-qutebrowser-process-messages.md#q4-should-the-project-record-its-code-quality-limits-as-a-decision)).

## Alternatives considered

- Limits on function and file length in pylint, with today's offenders marked: it touches many files
  unrelated to the feature that asked.

## Consequences

- Agents learn the limits before writing code, not when a linter fails.
- Functions and files have no length limit.
- The few existing `# pylint: disable=too-many-arguments` comments stay where they are.

## Applies to

- [`qutebrowser/`](/qutebrowser/), [`scripts/`](/scripts/), [`tests/`](/tests/),
  [`.pylintrc`](/.pylintrc), [`.flake8`](/.flake8), and every feature or change that adds or changes
  Python code
