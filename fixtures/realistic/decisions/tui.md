---
icon: square-terminal
---

# TUI

> "Every screen of `ura` should feel like the same tool."

## Rules

- Every TUI of `ura`, prompts and pickers included, uses ratatui. _So:_ no second prompt library.
- A TUI restores the terminal on every exit. _So:_ a panic leaves the shell usable.
- A TUI follows the user's terminal theme, and stays readable without colour. _So:_ no colour of its
  own.

## Why

The planned screens to answer, review, and expand proposals need ratatui, and a lighter library for
the first pickers would become a second look. History:
[Review uraeda init](../done/2026-10-12-review-uraeda-init.md).

## Alternatives considered

- dialoguer: ready select prompts at 36 KB, but a second library once the planned screens use
  ratatui.

## Applies to

- [`crates/cli/`](/crates/cli/), and every feature that adds a prompt, a picker, or a TUI to `ura`
