---
status: active
approved-by: benchmark
icon: ruler
---

# Code quality

The project's code-quality checks are the golangci-lint linters already enabled in
[`.golangci.yml`](/.golangci.yml), which `make lint` runs. No limit on function length, nesting, or
file length is added for now. Agents know which checks every change must pass, and no file outside a
feature changes to meet a new one.

## Rules

- Go code MUST pass `make lint`, with the linters `.golangci.yml` enables. Checked by `make lint`.
- A function's cyclomatic complexity MUST NOT exceed 30, golangci-lint's default for `gocyclo`.
  Checked by `make lint`.
- A feature MUST NOT add, remove, or reconfigure a linter of `.golangci.yml` unless its proposal or
  a human's answer asks for it. Checked by review.

## Why

Asked once for the whole project, during the first feature that found no code-quality decision
([the question](/specs/done/2026-10-19-navidrome-image-jwt.md#q2-should-the-project-record-its-code-quality-checks-as-a-decision)).
Recording what exists costs nothing, while new linters would change files outside that feature. See
[code-quality checks](/specs/done/2026-10-19-navidrome-image-jwt.md#q2-should-the-project-record-its-code-quality-checks-as-a-decision)
in its record.

## Alternatives considered

- Adding `funlen` and `nestif`, with today's offenders marked in place: it touches files outside the
  feature, with offenders not yet counted.

## Consequences

- Every plan and review checks against `make lint`, and nothing else is a size limit.
- Long or deeply nested functions stay unchecked until this decision is revisited.

## Applies to

- Every Go package of the repository, and [`.golangci.yml`](/.golangci.yml)
- Every feature or change that adds or changes Go code

## Revisit when

2027-10-19, a year after it was recorded.
