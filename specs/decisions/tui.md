---
status: proposed
approved-by:
icon: square-terminal
---

# TUI

Every interactive screen of `ura`, from a one-question picker to a full review screen, comes from
one TUI library, ratatui. Its screens share their code, their keys, and their look, and they follow
the user's terminal theme.

## Rules

- Every TUI of `ura`, prompts and pickers included, MUST use ratatui, with no other prompt or TUI
  library. Checked by review.
- A prompt inside a command MUST draw inline under the command's output; full screens are for TUIs
  that are the command itself. Checked by review.
- A TUI MUST restore the terminal on every exit, cancels, errors, and panics included. Checked by
  review.
- A TUI MUST follow the user's terminal theme and stay readable without colour. Checked by review.
- Reusable TUI parts SHOULD live in their own modules, testable without a terminal. Checked by
  review.

## Why

The planned answer, review, and draft TUIs need ratatui ([draft](../drafts/cli-tuis.md)). A lighter
library for the first pickers would become a second library with a different look
([which library draws the pickers](../done/2026-10-12-review-uraeda-init.md#q2-which-library-draws-the-pickers)).
The terminal's own colours are the look the human chose
([what the TUIs look like](../done/2026-10-10-cli-core.md#q14-what-should-the-tuis-look-like)).

## Alternatives considered

- dialoguer: ready select prompts at 36 KB, but a second library once the planned TUIs adopt
  ratatui.

## Consequences

- The first picker costs a select widget and its key loop, which later TUIs reuse.
- Agents never see a TUI: the [CLI](cli.md) decision gives every action flags and `--no-input`.

## Applies to

- [`crates/cli/`](/crates/cli/), and every feature that adds a prompt, a picker, or a TUI to `ura`
