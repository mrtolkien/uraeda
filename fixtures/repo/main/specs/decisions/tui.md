---
status: proposed
approved-by:
icon: square-terminal
---

# TUI

Every interactive screen of `ura` is drawn with ratatui, on its crossterm backend.

## Rules

- Every TUI of `ura` MUST be drawn with ratatui on its crossterm backend. Checked by review.

## Why

One TUI library, so the screens share their code, their keys, and their look.

## Consequences

- Small prompts use the same library as full screens.

## Applies to

- The CLI's prompts and screens
