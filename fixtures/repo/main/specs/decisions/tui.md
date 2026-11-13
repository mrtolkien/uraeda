---
icon: square-terminal
---

# TUI

> "Every screen of `ura` should feel like the same tool."

## Rules

- Every TUI of `ura` is drawn with ratatui on its crossterm backend. _So:_ a small prompt uses the
  same library as a full screen.

## Why

One TUI library, so the screens share their code, their keys, and their look.

## Applies to

- The CLI's prompts and screens
