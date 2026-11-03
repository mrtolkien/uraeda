---
status: proposed
approved-by:
icon: text-cursor-input
---

# Text editing

Every text field of the web UI is one editor, built on CodeMirror 6, a text editor for the web, so
writing feels the same everywhere: Markdown highlighted, long lines wrapped. Vim's keys come on with
a switch, from CodeMirror's own Vim engine, as complete as it is and never rewritten by hand. The
editor looks like a terminal's text, not like a form's field.

## Rules

- Every text field MUST be the one shared editor, unless it is part of another Astryx component,
  like a picker's filter, or only the browser's field can do the job, like a password. Checked by
  lint.
- The editor MUST highlight Markdown, with Vim on or off.
- Text MUST wrap in every field, one-line fields included, never scrolling sideways.
- Vim's keys MUST come from CodeMirror's Vim engine, never from keys handled by hand.
- Vim MUST stay off until the human turns it on in the settings file. Checked by the core's tests.
- Escape in Vim's normal mode MUST do what Escape does in the same field without Vim.
- A yank MUST also reach the system clipboard.
- The status line MUST name the Vim mode while Vim is on.
- The human's own Vim commands SHOULD live in the settings file, and run when Vim starts.
- The editor SHOULD look like a terminal's text, not like Astryx's fields.

## Why

The human writes proposals, answers, notes, and messages in the web UI, and edits text in Neovim
everywhere else. Astryx's three kinds of fields each behaved their own way, and a one-line field cut
a long priority on a phone. One editor gives every field the same keys, highlighting, and wrapping.
CodeMirror's Vim engine is the one Overleaf and JupyterLab ship: a hand-written one would never
catch up. History: [Vim in text edit mode](../2026-11-03-vim-text/spec.md).

## Alternatives considered

- Astryx's own fields, with the editor only while Vim is on: two kinds of every field, and no
  highlighting or wrapping without Vim.
- vimee, a Vim engine for plain text areas: no `:g`, `:normal`, mappings, or clipboard register, and
  nothing for the composer.
- Neovim compiled to WebAssembly: every key, but 8 MB, one editor at a time, and still a demo
  upstream.

## Consequences

- CodeMirror and its Markdown support will load with every page, about 176 KB compressed, and the
  Vim engine 42 KB more, with Vim on only.
- The editor's look will be Uraeda's own, kept in step with the theme by hand rather than by Astryx.
- A new text field will use the shared editor, and get Vim, highlighting, and wrapping with no
  further work.
- Some keys will stay the browser's: Ctrl+W closes the tab, even in insert mode.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a text field
- [`crates/core/`](/crates/core/)'s settings, for the switch and the human's Vim commands
