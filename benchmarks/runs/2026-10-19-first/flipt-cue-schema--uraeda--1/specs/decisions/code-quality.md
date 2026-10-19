---
status: active
approved-by: benchmark
icon: ruler
---

# Code quality

The project sets no limits on function length, file length, or nesting depth. Its linters stay as
[`.golangci.yml`](/.golangci.yml) configures them today, and a feature does not add limits on its
own.

## Rules

- A feature MUST NOT add function, file, or nesting limits to the linters, nor mark existing code as
  an offender, unless a human asks for it. Checked by review.
- Agents SHOULD NOT raise this topic in a round of questions before 2027-01-19. Checked by review.

## Why

The first round of the feature that created this file asked whether to adopt limits. The human chose
none for now, because adopting them means editing the lint configuration and marking unrelated code.
See
[the question](../done/2026-10-19-flipt-cue-schema.md#q4-should-this-feature-adopt-code-quality-limits-as-a-project-decision).

## Consequences

- Features stay inside their own scope: no lint configuration changes ride along.
- Nothing stops a function or a file from growing, apart from review.

## Applies to

- [`.golangci.yml`](/.golangci.yml), and every feature that adds or changes Go code

## Revisit when

2027-01-19.
