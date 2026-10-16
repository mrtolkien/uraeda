---
status: active
approved-by: mrtolkien
icon: ruler
---

# Code quality

Size and nesting limits hold Uraeda's Rust and TypeScript code. Clippy, Oxlint, and one structural
test enforce them in `vp run ready`. TypeScript also follows the fate stack's shared lint config.
Code that already breaks a limit is marked in place, with its reason. The checks fail on a new
violation, and on a marker left behind once its code is fixed, so the numbers can only go down.

## Rules

- Rust and TypeScript functions MUST NOT be longer than 100 lines. Checked by clippy's
  `too_many_lines` and Oxlint's `max-lines-per-function`.
- Rust and TypeScript functions MUST NOT take more than 7 parameters. Checked by clippy's
  `too_many_arguments` and Oxlint's `max-params`.
- Code MUST NOT nest blocks more than 4 levels deep inside a function. Checked by clippy's
  `excessive_nesting` and Oxlint's `max-depth`.
- Rust and TypeScript source files MUST NOT be longer than 500 lines. Tests and generated files are
  exempt. Checked by Oxlint's `max-lines`, and for Rust by a structural test of the workspace.
- The TypeScript lint configuration MUST extend `@nkzw/oxlint-config`, the shared configuration of
  the fate stack. A rule of it MAY be turned off only where it conflicts with an active decision,
  and the decision MUST be named next to it. Checked by the lint fixtures of
  [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts).
- Code that broke a limit when this decision was approved MUST be marked where it stands, with a
  reason:
  - in Rust, `#[expect(clippy::<lint>, reason = "...")]`;
  - in TypeScript, an `oxlint-disable-next-line <rule> -- <reason>` comment;
  - for files, an entry in the structural test's list.

  A marker on code that no longer breaks its limit MUST fail the checks. Checked by `-D warnings` on
  an unfulfilled `#[expect]`, Oxlint's report of unused disable directives, and the structural test.

- A new marker MUST NOT be added unless a human approves it as a constitution exception in the
  plan's complexity tracking. Checked by review.
- A custom lint rule or structural test MUST say how to fix the problem in its message. Checked by
  review, and by the fixtures that make each rule fire.
- Unit tests MUST NOT sleep for a fixed time, or assert how long something took. Benchmarks of a
  spec's success criteria are exempt. Checked by review.

## Why

- **The research.** Agents extending their own code grow functions and files feature after feature.
  Instructions lower the starting level, not the decay
  ([record](../done/2026-10-14-code-quality-in-the-skill.md)).
- **The human's choice.** Limits in the linters already installed, with today's offenders in their
  baselines, rather than new tools
  ([Q7](../done/2026-10-14-code-quality-in-the-skill.md#q7-which-checks-does-this-repository-adopt-now)).
- **The limits.** 100 lines per function, 7 parameters, 4 levels of nesting, 500 lines per file
  ([Q7.A](../done/2026-10-14-code-quality-in-the-skill.md#q7a-what-limits)). They stop growth
  without baselining a third of the web UI.
- **The fate stack's rules.** The human asked to follow them. Its lint configuration is the stack's
  shared default, and it holds no size limits of its own
  ([checks in this repository](../done/2026-10-14-code-quality-in-the-skill.md#q7-which-checks-does-this-repository-adopt-now)).
- **Markers in place.** They keep each exception next to its code with its reason, the same way in
  both languages, and fail once the code is fixed.

## Alternatives considered

- jscpd for duplication and selene for Lua: two new tools, and jscpd still misses a rule written
  once in Rust and again in TypeScript.
- Oxlint's suppressions file as the TypeScript baseline: counts per file and rule kept away from the
  code, and not confirmed to pass through `vp lint`.

## Consequences

- **Structural commits first.** A feature touching a marked function or file splits it first, in a
  commit that only restructures it, then removes its marker.
- **A one-time cleanup.** The fate config's autofixable rules, like sorting and `curly`, rewrite
  much of the TypeScript code once, in a commit that only restructures it.
- **Unchecked areas.** Lua and duplication across languages stay checked by review only, along with
  the [stack](stack.md) decision's architecture test.
- **The `.only` guard.** A `test.only` left behind fails the lint.

## Applies to

- [`crates/`](/crates/), [`packages/`](/packages/), [`Cargo.toml`](/Cargo.toml), `clippy.toml`,
  [`vite.config.ts`](/vite.config.ts), and every feature that adds or changes code
