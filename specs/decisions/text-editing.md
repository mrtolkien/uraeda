---
icon: text-cursor-input
---

# Text editing

> "It’s simple: I want to be able to use vim key bindings in ALL text input fields."

One-line fields included: every field the human types in is the same editor, with the same keys,
highlighting, and wrapping. How a field behaves, its Enter, its Escape, Vim's modes, is the
[keyboard guide](../ui/keyboard.md#in-a-field)'s.

## Rules

- Every text field is the one shared editor, unless only the platform's own field can do the job,
  like a password. _So:_ a picker's filter is that editor too, and takes Vim's keys as a comment's
  field does. A feature that needs a new field uses it, and never draws a field of its own.
- Vim's keys come from Uraeda's own Vim layer, a defined subset written in Rust and tested key by
  key, never from keys handled in a view. _So:_ a missing key is added to the layer, with its test
  against Neovim. It is never caught in one field's own handler.

## Why

The human writes proposals, answers, notes, and messages in the app, and edits text in Neovim
everywhere else. Two editors would behave in two ways, and the second is where Vim's keys are
missing. Native Shell's editor has no Vim, and the app's TSX runs in an interpreter, so what runs at
each key is Rust, tested without a window. A subset that is named and tested beats a larger one that
surprises. History: [Vim in text edit mode](../done/2026-11-03-vim-text.md).

## Alternatives considered

- CodeMirror's Vim engine, the earlier choice: complete, but it runs only in a browser's page.
- Helix's keys: its full set is bound to Helix's own editor, and a part of it is not worth leaving
  Vim for.

## Applies to

- [`app/`](/app/) and [`crates/vim/`](/crates/vim/), and every feature that adds or changes a text
  field
