---
status: active
approved-by: mrtolkien
icon: square-terminal
---

# TUI

Every interactive screen of `ura`, from a one-question picker to a full review screen, is a TUI, a
terminal user interface, drawn by one library: ratatui. Its screens share their code, their keys,
and their look, and they follow the user's terminal theme.

## Rules

- Every TUI of `ura`, prompts and pickers included, MUST use ratatui, with no other prompt or TUI
  library. Checked by review.
- A prompt inside a command MUST draw inline under the command's output, full screens being for TUIs
  that are the command itself. Checked by review.
- A TUI MUST restore the terminal on every exit, cancels, errors, and panics included. Checked by
  review.
- A TUI MUST follow the user's terminal theme, and stay readable without colour. Checked by review.
- Reusable TUI parts SHOULD live in their own modules, testable without a terminal. Checked by
  review.

## Why

The planned screens to answer, review, and expand proposals need ratatui. A lighter library for the
first pickers would become a second library with a different look. The terminal's own colours keep
every screen in the user's theme. History:
[Review uraeda init](../done/2026-10-12-review-uraeda-init.md).

## Alternatives considered

- dialoguer: ready select prompts at 36 KB, but a second library once the planned screens use
  ratatui.

## Consequences

- The first picker costs a select widget and its key loop, which later screens reuse.
- Agents never see a TUI: the [CLI](cli.md) decision gives every action a form without one.

## Applies to

- [`crates/cli/`](/crates/cli/), and every feature that adds a prompt, a picker, or a TUI to `ura`
