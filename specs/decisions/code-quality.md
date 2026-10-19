---
status: proposed
approved-by:
icon: ruler
---

# Code quality

Agents extending their own code grow it feature after feature. Size and nesting limits hold the Rust
and TypeScript code, checked by the linters already installed. Code that breaks a limit today is
marked in place with its reason, and the exceptions can only go down.

## Rules

- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting, enforced by the existing linters. Checked by clippy and Oxlint.
- The TypeScript lint configuration MUST extend `@nkzw/oxlint-config`, the fate stack's shared one,
  and MAY turn off its rules only where an active decision conflicts. Checked by
  [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts)'s fixtures.
- Code breaking a limit when this decision was approved MUST be marked in place with its reason, so
  a marker on fixed code fails, and a new marker MUST NOT be added unless a human approves it in the
  plan. Checked by the linters and review.
- A custom lint rule or structural test MUST say in its message how to fix the problem. Checked by
  review.
- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.
  Checked by review.

## Why

Instructions lower where code quality starts, not how fast it decays
([the research](../done/2026-10-14-code-quality-in-the-skill.md)). Limits in the existing linters,
with today's offenders marked, stop growth without new tools
([the checks adopted](../done/2026-10-14-code-quality-in-the-skill.md#q7-which-checks-does-this-repository-adopt-now)).
The numbers stop growth without marking a third of the web UI
([the limits](../done/2026-10-14-code-quality-in-the-skill.md#q7a-what-limits)). Markers in place
keep each exception beside its code, the same way in both languages, and fail once it is fixed.

## Alternatives considered

- jscpd for duplication and selene for Lua: two new tools, and jscpd misses a rule copied across
  languages.
- Oxlint's suppressions file as the baseline: counts kept away from the code, and unconfirmed
  through `vp lint`.

## Consequences

- A feature touching a marked function or file splits it first, in a commit that only restructures
  it, and removes its marker.
- Lua, and duplication across languages, stay checked by review only.

## Applies to

- [`crates/`](/crates/), [`packages/`](/packages/), [`Cargo.toml`](/Cargo.toml), `clippy.toml`,
  [`vite.config.ts`](/vite.config.ts), and every feature that adds or changes code
