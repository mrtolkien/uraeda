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
- The TypeScript lint configuration MUST extend `@nkzw/oxlint-config`, the shared configuration of
  fate's stack, turning off its rules only where an active decision conflicts. Checked by the lint
  configuration's test.
- Code over a limit when this decision was approved MUST be marked in place with its reason, so that
  a marker left on fixed code fails. Checked by the linters.
- A new marker MUST NOT be added unless a human approves it in the plan. Checked by review.
- A custom lint rule or structural test MUST say in its message how to fix the problem. Checked by
  review.
- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.
  Checked by review.

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

## Applies to

- [`crates/`](/crates/), [`packages/`](/packages/), [`Cargo.toml`](/Cargo.toml), `clippy.toml`,
  [`vite.config.ts`](/vite.config.ts), and every feature that adds or changes code
