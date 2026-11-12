---
status: active
approved-by: mrtolkien
icon: ruler
---

# Code quality

Agents extending code grow it feature after feature, and only a failing check stops that. Size and
nesting limits hold the Rust and TypeScript code, in the linters already installed. Code over a
limit when the limits were set is marked in place with its reason, so the exceptions can only go
down.

## Rules

- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting. Checked by clippy and Oxlint.
- The TypeScript lint configuration MUST be [`.oxlintrc.json`](/.oxlintrc.json), read by the dev
  shell's Oxlint: its correctness and suspicious rules as errors, and these limits. Checked by
  `just lint`.
- Code over a limit when this decision was approved MUST be marked in place with its reason, so that
  a marker left on fixed code fails. Checked by the linters.
- A new marker MUST NOT be added unless a human approves it in the plan.
- A custom lint rule or structural test MUST say in its message how to fix the problem.
- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.

## Why

Instructions raise where code quality starts, not how fast it decays: only a failing check stops
growth. Limits in the linters already installed need no new tool. A marker keeps each exception
beside its code, the same way in both languages, and fails once the code is fixed. History:
[Code quality in the skill](../done/2026-10-14-code-quality-in-the-skill.md).

## Alternatives considered

- jscpd for duplication and selene for Lua: two new tools, and jscpd misses a rule copied across
  languages.
- Oxlint's suppressions file as the baseline: counts kept away from the code.

## Consequences

- A feature touching a marked function or file splits it first, in a commit that only restructures
  it, and removes its marker.
- Lua, and duplication across languages, stay checked by review only.
- A TSX function's length is checked at 150 lines, without blanks and comments, a looser limit than
  Rust's: a component's markup is one function. The functions over it are marked in place, as Rust's
  are. Oxlint holds nesting, parameters, a function's and a file's length.

## Applies to

- [`crates/`](/crates/), [`app/`](/app/), [`Cargo.toml`](/Cargo.toml), `clippy.toml`,
  [`.oxlintrc.json`](/.oxlintrc.json), and every feature that adds or changes code
