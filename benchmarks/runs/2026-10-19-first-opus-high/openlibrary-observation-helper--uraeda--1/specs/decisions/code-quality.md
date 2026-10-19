---
status: active
approved-by: benchmark
icon: ruler
---

# Code quality

New and changed Python code meets the limits flake8 already checks in this repository. Lines hold at
most 88 characters, and functions a cyclomatic complexity of at most 10. No new tool is added, and
existing code is not reworked to meet them.

## Rules

- New and changed Python lines MUST NOT be longer than 88 characters. Checked by `make lint-diff`,
  which CI runs.
- New and changed Python functions MUST NOT have a cyclomatic complexity over 10. Checked by
  `make lint`'s `--max-complexity=10` warning, and by review.
- Code a feature does not otherwise touch SHOULD NOT be changed only to meet these limits. Checked
  by review.

## Why

The project had no recorded limits, so reviews had none to point at. These are the limits the
repository's own tooling already applies, in the [`Makefile`](/Makefile) and
[`scripts/flake8-diff.sh`](/scripts/flake8-diff.sh), so today's code meets them without a new
dependency. See the question on
[code-quality limits](../done/2026-10-19-openlibrary-observation-helper.md#q4-should-the-project-record-code-quality-limits)
and the discovery's
[code-quality limits](../done/2026-10-19-openlibrary-observation-helper.md#q4-should-the-project-record-code-quality-limits).

## Alternatives considered

- Ruff, with limits on function length, parameters, and nesting: the most complete checks. It costs
  a new development dependency, and markers on today's offenders.

## Consequences

- Reviews have a shared limit to point at, already checked by CI for line length.
- Complexity stays a warning in `make lint`: a function over 10 is caught by review, not by CI.
- Function and file length have no limit.

## Applies to

- Every Python file of the repository, and every feature that adds or changes Python code
- [`Makefile`](/Makefile) and [`scripts/flake8-diff.sh`](/scripts/flake8-diff.sh)
