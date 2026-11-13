---
icon: ruler
---

# Code quality

> "I don't read the code, so the checks have to hold it."

## Rules

- Rust and TypeScript functions and files stay within the limits the linters hold. _So:_ a task
  that would push a function past its limit splits it first.
- An exception is marked where the code stands, with its reason, and a new one needs the human's
  approval in the plan. _So:_ no marker is added to get a task through.
- A custom lint rule says in its message how to fix the problem. _So:_ an agent fixes it without
  asking.

## Why

Instructions raise where code quality starts, not how fast it decays: only a failing check stops
growth. Limits in the linters already installed need no new tool. History:
[Code quality in the skill](../done/2026-10-14-code-quality-in-the-skill.md).

## Alternatives considered

- Oxlint's suppressions file as the baseline: counts kept away from the code.

## Applies to

- [`crates/`](/crates/), [`packages/`](/packages/), [`Cargo.toml`](/Cargo.toml), `clippy.toml`,
  [`vite.config.ts`](/vite.config.ts), and every feature that adds or changes code
