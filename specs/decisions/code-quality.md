---
icon: ruler
---

# Code quality

> "What I want is a system that gives me the least amount of work to create high quality,
> maintainable apps. I do not intend to read a single line of code."

Nobody reads the code, so checks hold it. Limits on a function's length, parameters, and nesting,
and on a file's length, live in [`clippy.toml`](/clippy.toml) and
[`.oxlintrc.json`](/.oxlintrc.json), which `just lint` runs. A marker is the line that excuses one
function or file from a limit, written beside it with its reason.

## Rules

- Functions and files stay within the limits the linters hold. _So:_ three new functions would have
  pushed a file of 499 lines past its limit. The file was split first, in a commit that only
  restructures.
- An exception is marked where the code stands, with its reason, and a new one needs the human's
  approval in the plan. _So:_ no marker is added to get a task through: the task splits the function
  first.
- The exceptions only go down. _So:_ a marker left on code that was fixed fails the lint. A feature
  that touches a marked function splits it, and removes its marker.

## Why

Agents extend the code they find. Instructions raise where quality starts, not how fast it decays:
only a check that fails stops functions and files from growing feature after feature. A marker keeps
each exception beside its code, the same way in Rust and in TSX, and fails once the code is fixed.
History: [Code quality in the skill](../done/2026-10-14-code-quality-in-the-skill.md).

## Alternatives considered

- A baseline file that lists the exceptions, as Oxlint's suppressions do: the counts live away from
  the code, and nobody sees them shrink.

## Applies to

- [`crates/`](/crates/), [`app/`](/app/), and every feature that adds or changes code
