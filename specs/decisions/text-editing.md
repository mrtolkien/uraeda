---
icon: text-cursor-input
---

# Text editing

Every text field of the UI is one editor, built on Native Shell's editor, so writing feels the same
everywhere: Markdown highlighted, long lines wrapped. Vim's keys come on with a switch, from
Uraeda's own Vim layer in Rust, a named subset tested key by key. The editor looks like a terminal's
text, not like a form's field.

## Rules

- Every text field MUST be the one shared editor, unless only the platform's own field can do the
  job, like a password.
- The editor MUST highlight Markdown, with Vim on or off.
- Text MUST wrap in every field, one-line fields included, never scrolling sideways.
- Vim's keys MUST come from Uraeda's Vim layer, a state machine in Rust that touches no view, never
  from keys handled in a view.
- Every key the Vim layer supports MUST have a row in its table of cases. Checked by the layer's
  tests.
- Vim MUST stay off until the human turns it on in the settings file. Checked by the core's tests.
- Escape in Vim's normal mode MUST do what Escape does in the same field without Vim.
- A yank MUST also reach the system clipboard.
- The status line MUST name the Vim mode while Vim is on.
- The editor SHOULD look like a terminal's text, not like a form's field.

## Why

The human writes proposals, answers, notes, and messages in the UI, and edits text in Neovim
everywhere else. One editor gives every field the same keys, highlighting, and wrapping. Native
Shell's editor has no Vim, and its TSX runs in an interpreter, so the layer is Rust: pure, and
tested without a window. A subset that is named and tested beats a larger one that surprises.
History: [Vim in text edit mode](../done/2026-11-03-vim-text.md).

## Alternatives considered

- CodeMirror's Vim engine, the earlier choice: complete, but it runs only in a browser's page.
- Helix's keys: Helix's own commands are bound to its own editor, and a subset of them is not Helix.
- Plain editing first, Vim later: no Vim for a while.

## Consequences

- Vim is a subset: no Ex commands, macros, marks, or block visual until a feature adds them.
- The human's own Vim commands in the settings file no longer run.
- A new text field uses the shared editor, and gets Vim, highlighting, and wrapping with no further
  work.
- A missing key is Uraeda's to write, with its row.

## Applies to

- `app/` and `crates/vim/`, and every feature that adds or changes a text field
- [`crates/core/`](/crates/core/)'s settings, for the switch
