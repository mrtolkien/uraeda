---
status: proposed
approved-by:
---

# TUI

Every interactive screen of `ura`, from a one-question picker to the planned answer and review
screens, is drawn with ratatui, on its crossterm backend. `ura` has one TUI library, so its screens
share their code, their keys, and their look, and no second library is added for small prompts.

## Rules

- Every TUI of `ura`, prompts and pickers included, MUST be drawn with ratatui on its crossterm
  backend. Other prompt or TUI libraries, like dialoguer, inquire, or cliclack, and hand-written
  terminal control MUST NOT be added.
- Prompts inside a command, like pickers and confirmations, MUST draw inline, under the command's
  output, and MUST leave the chosen answer as a line of that output once they close. Full screens
  are for the TUIs that are the command itself.
- Reusable TUI parts, like the picker, MUST live in their own modules of
  [`crates/cli/`](/crates/cli/), with their key handling testable without a terminal.
- A TUI MUST restore the terminal on every exit: a confirmation, a cancel with Esc or Ctrl-C, an
  error, and a panic.
- A TUI MUST use the terminal's own 16 colours, never fixed RGB values, and MUST stay readable
  without colour: the cursor and a checked item show as characters, `>` and `[x]`, not as colour
  alone.

## Why

The proposal names ratatui for `ura install`'s pickers
([proposal](../2026-10-12-review-uraeda-init/proposal.md)), and the planned answer, review, and
draft TUIs name it too ([draft](../drafts/cli-tuis.md)). A lighter prompt library for the pickers,
dialoguer at 36 KB against ratatui's 210 KB, would become a second library, with a different look,
once those TUIs come: the human chose ratatui
([Q2](../2026-10-12-review-uraeda-init/clarifications-01.md#q2-which-library-draws-the-pickers),
[picker libraries](../2026-10-12-review-uraeda-init/discovery-01.md#picker-libraries)). The
terminal's 16 colours are the human's answer for the TUIs' look
([Q14](../done/2026-10-10-cli-core.md#q14-what-should-the-tuis-look-like)).

## Alternatives considered

- dialoguer: ready `Select` and `MultiSelect` prompts at 36 KB, but a second library once the
  planned TUIs adopt ratatui.

## Consequences

- The first picker costs a select widget and its key loop, about 100 lines, which later TUIs reuse.
- The binary grows by about 210 KB, which the [CLI](cli.md) decision's size rules accept.
- Every TUI looks like the user's terminal theme, and works with `NO_COLOR`.
- Agents never see a TUI: the [CLI](cli.md) decision gives every action flags and `--no-input`.

## Applies to

- [`crates/cli/`](/crates/cli/), and every feature that adds a prompt, a picker, or a TUI to `ura`
