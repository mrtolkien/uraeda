---
status: awaiting-human
revision: 2
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Vim in text edit mode

> [!IMPORTANT]
>
> Spec to review, about 10 minutes.
>
> - You approve one editor, built on CodeMirror, for every text field: Markdown highlighted, long
>   lines wrapped, Vim mode behind a switch, the mode in the status line, and a buffer for any file.
> - Since your review, the status line takes the shape of LazyVim's: the mode in its coloured block
>   with lualine's names and NAV, then the file, the hints, the counts, and the cursor's place.
> - That shape is the status line's for everyone: with Vim mode off, the same line without its mode.
> - The buffer now takes the whole window: only the text and the status line. `:w` saves, `:q` goes
>   back, and the phone's bottom bar holds Save and Back.
> - The setting is "Vim mode", `vim_mode` in the settings file. Each mode keeps the icon you asked
>   for in the round, though LazyVim draws none.
> - Unchanged: the new Text editing decision, the change to UI components, and every other story.

The [proposal](proposal.md) asks for Vim's keys in every text field of the web UI, as many as
possible, in the browser and instant, with the mode in the status line, and a shortcut opening any
file as a buffer. It is for you: Neovim is your main editor, and the web UI is where you write
answers, comments, notes, rows, and messages to agents. The [discovery](discovery-01.md) found one
complete engine, CodeMirror's, which works only inside a CodeMirror editor. Your
[answers](clarifications-01.md) chose it for every field, with Markdown highlighting even without
Vim, so every field becomes that editor.

## Your review

- **C1** (a status line like LazyVim's, NAV, the setting's name): done. The status line takes
  lualine's sections and Catppuccin's colours, NAV names the page's keys, and the setting is "Vim
  mode". See [the mode in the status line](#us3-the-mode-in-the-status-line-p2).
- **C2** (the buffer takes the whole page): done. The buffer shows only its text and the status
  line, with no sidebar, title, pane, or button. See
  [open a file as a buffer](#us5-open-a-file-as-a-buffer-p2).

## Decisions

- **New: [Text editing](../decisions/text-editing.md)**. Every text field is one CodeMirror editor,
  Markdown highlighted and wrapped, with Vim's keys from CodeMirror's engine behind a switch, off by
  default.
- **Changed: [UI components](../decisions/ui-components.md)**. Views use Astryx wherever one fits,
  except text fields, which follow Text editing.

Relied on:

| Decision                                     | What it means for this spec                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Keyboard](../decisions/keyboard.md)         | Vim's keys are a field's own, which the registry never hears; `Space b` is declared there |
| [Settings](../decisions/settings.md)         | the switch and the commands live in the settings file, read and written by the core       |
| [UI behaviour](../decisions/ui-behaviour.md) | text saves only on an explicit action; unsaved text stays protected                       |
| [UI look](../decisions/ui-look.md)           | the editor's terminal look uses the theme's monospace font and Catppuccin colours         |
| [Performance](../decisions/performance.md)   | a keystroke and a reload stay within the targets, measured by the benchmark               |
| [Stack](../decisions/stack.md)               | which files can be written as text is the core's rule                                     |
| [Testing](../decisions/testing.md)           | tests guard the stored settings and the buffer's writes, little of the UI                 |

## User stories

### US1: Every field is one editor (P1)

You write in any field and get the same editor: Markdown highlighted as you type, long lines
wrapped, a one-line field growing with its text. Its keys stay what they are today.

[Every field is the editor, Vim off](mockups/fields.html)

Key scenarios:

1. **Given** Vim is off, **When** you type `**one**` in a comment, **Then** `one` shows bold, its
   asterisks dimmed, and Ctrl+Enter saves the comment as today.
2. **Given** a phone 375 px wide, **When** you edit the priority line "Vim in text edit mode: every
   field gets Vim's keys, and a buffer opens any file", **Then** the row wraps onto 3 lines, grows
   with them, and Enter saves it.
3. **Given** a comment with unsaved text, **When** you press Escape, **Then** the field loses the
   focus, keeps the text, and `j` moves the page's selection.

More scenarios:

1. **Given** you paste "first\nsecond" into a priority row, **When** the paste lands, **Then** the
   row reads "first second".
2. **Given** the composer, **When** you paste a PNG image, **Then** it attaches, as today.
3. **Given** the sign-in page, **When** your password manager fills the password, **Then** it works
   as today: the password field stays the browser's own.

### US2: Vim's keys, behind a switch (P1)

You turn Vim mode on in the settings' Keyboard section, and every field takes Vim's keys, starting
in insert mode. Escape goes to normal mode; a second Escape does what Escape did before.

[Vim mode: a field, and the setting](mockups/vim.html)

Key scenarios:

1. **Given** Vim is on and you press `i` on the priority "Review the UI guidelines properly",
   **When** you type `x`, **Then** "x" is inserted at the end, since the field opens in insert mode.
2. **Given** that row in normal mode, unchanged, **When** you press `dw` then Escape, **Then**
   "Review " is deleted, and Escape asks "Discard your changes?" before cancelling, as today.
3. **Given** a comment in insert mode, **When** you press Shift+Escape, **Then** the field loses the
   focus, keeping its text.
4. **Given** a comment in normal mode, **When** you press `yy`, **Then** the line is on the system
   clipboard, and `p` pastes it in a priority row.

More scenarios:

1. **Given** a comment in normal mode, **When** you type `:w` then Enter, **Then** the comment
   saves, as Ctrl+Enter does; `:q` leaves the field keeping its text; `:wq` does both.
2. **Given** a priority row in normal mode, **When** you press Enter, **Then** the row saves; in a
   comment, the cursor moves down a line.
3. **Given** a phone, or any screen whose main pointer is touch, **When** Vim is on, **Then** fields
   have no Vim and the engine is not loaded.
4. **Given** the search of the `?` key map, a dialog, **When** you press Escape in normal mode,
   **Then** the key map closes, as today.

### US3: The mode in the status line (P2)

The status line takes the shape of LazyVim's, lualine's sections in Catppuccin's colours. With Vim
mode on, it opens with the mode, so you always know whether keys act on the page or in the text.

[The status line, one per mode](mockups/statusline.html)

Key scenarios:

1. **Given** Vim mode is on and no field has the focus, **When** you look at the status line,
   **Then** it opens with NAV and a compass in a grey block, then the page's hints, and the counts
   at its right end.
2. **Given** a comment in insert mode, **When** you press Escape, **Then** INSERT, green with a
   pencil, becomes NORMAL, blue with a block, the cursor becomes a block, and the right end shows
   the cursor's place, like "Top 3:9".
3. **Given** Vim mode is off, **When** you look at the status line, **Then** it has the same
   sections and separators, without the mode.

More scenarios:

1. **Given** normal mode, **When** you press `v`, `V`, `Ctrl+V`, `R`, or `:`, **Then** the mode
   reads VISUAL, V-LINE, or V-BLOCK in mauve, REPLACE in red, or COMMAND in peach.
2. **Given** a screen reader, **When** the mode changes in a field, **Then** the new mode is read
   out politely, once.

### US4: Your own Vim commands (P2)

You list Vim commands in the settings file or in the Keyboard section, like `imap jj <Esc>`, and
they run when Vim starts. A line the engine refuses shows its error under the field.

[Vim mode: a field, and the setting](mockups/vim.html)

Key scenarios:

1. **Given** `vim_commands = ["imap jj <Esc>"]`, **When** you type `jj` quickly in insert mode,
   **Then** the field goes to normal mode, and no `j` is inserted.
2. **Given** the Keyboard section, **When** you save the lines `imap jj <Esc>` and `nmpa Q dd`,
   **Then** the file holds both, and "Line 2: Not an editor command ":nmpa Q dd"" shows under the
   field.
3. **Given** `vim_commands = "imap jj <Esc>"`, a string, **When** the settings page opens, **Then**
   it shows the file's problem "Vim commands are a list of lines, like ["imap jj <Esc>"]."

### US5: Open a file as a buffer (P2)

On any page showing one file, `Space b` opens the whole file as it is on disk, frontmatter included,
and the buffer takes the whole window: only the text, and the status line naming the file. You edit
it, Vim mode on or off, save with `:w` or Ctrl+Enter, and leave with `:q`.

[A file opened as a buffer](mockups/buffer.html)

Key scenarios:

1. **Given** the priorities page, **When** you press `Space b`, **Then** `specs/PRIORITIES.md` fills
   the window, with no sidebar, title, or button, and the status line reads its branch, "main", and
   its path.
2. **Given** you add the line "- Global undo" under Now, **When** you type `:w`, **Then** the file
   is written and committed as `chore: edit specs/PRIORITIES.md`, and the status line's unsaved mark
   goes.
3. **Given** an agent committed to the priorities since the buffer opened, **When** you save,
   **Then** nothing is written, and a banner across the top offers "Copy my text" and "Load the new
   version".

More scenarios:

1. **Given** a feature's spec page, **When** you press `Space b`, **Then** its `spec.md` opens from
   the feature's branch, and a save commits `chore(<slug>): edit spec.md` there.
2. **Given** the feature's agent is working, **When** you save its spec's buffer, **Then** it is
   refused, in the banner: "An agent is working on this feature. Stop it first, or wait for it."
3. **Given** unsaved text in a buffer, **When** you type `:q`, or press `b` outside the text,
   **Then** the Leave guard asks first; `:wq` saves, then goes back.
4. **Given** a phone, **When** a buffer is open, **Then** the bottom bar holds Back and Save, its
   only controls.
5. **Given** home or the settings, pages showing no single file, **When** you press `Space b`,
   **Then** nothing happens, and the leader menu does not list it there.

## Replaced behaviour

- **Text fields are Astryx's `TextArea`, `TextInput`, and `ChatComposerInput`.** The tests type into
  them as a `textarea`, an `input`, or a contenteditable: `__focused__/composer.test.tsx`,
  `commit-toast`, `editor`, `inbox-images`, `keys-inbox`, `keys-leader`, `keys-leader-tree`,
  `keys-map-open`, `keys-pages`, `keys-picker`, `keys-priorities`, `keys-promote`, `keys-registry`,
  `keys-row-editing`, `keys-scroll`, `new-feature`, `new-page`, `review`, `round`, `setup-message`,
  `start-dialog`, `storybook-pick`, and `text-focus`, with both `helpers.tsx`. They type through one
  shared helper instead; what they assert stays.
- **Escape does nothing in a field without its own handler**: comments, notes, a question's comment,
  quick-add lines, the inbox's add form, and most one-line fields. Guarded by no test.
- **A one-line field scrolls sideways past its width.** Guarded by no test.
- **The core writes as text only proposal files, note files, and a feature's top-level files.**
  Guarded by no test: the test refusing paths that climb out of `specs/proposals/` stays as it is.

## Architecture

Every field becomes one shared editor over CodeMirror 6, with
[`@codemirror/lang-markdown`](https://github.com/codemirror/lang-markdown) for highlighting and
[`@replit/codemirror-vim`](https://github.com/replit/codemirror-vim) for Vim, the engine Overleaf
and JupyterLab ship (see [discovery](discovery-01.md#replitcodemirror-vim-codemirror-6)). The field
components keep their props and callers, so pages change little.

- **The editor** draws every text field, in three variants by class: one line (wraps, grows, refuses
  line breaks, Enter as today), several lines (rows by kind, Ctrl+Enter), and the composer (grows
  upward, takes pasted and dropped images). It owns Markdown highlighting, wrapping, the
  placeholder, the field's accessible name, the terminal look over the theme's tokens, and Escape:
  outside a layer it leaves the field, or cancels an in-place line or a row; inside a layer it is
  the layer's. `TextField`, `LineField`, the outline row, the composer's field, and the one-line
  call sites use it.
- **The Vim layer** loads in its own chunk when the app starts, only with the switch on and a fine
  main pointer, and adds the engine to every editor. It owns starting in insert mode, Escape in
  normal mode and Shift+Escape handing over to the editor's Escape, `:w`, `:q`, and `:wq`, Enter in
  a one-line field's normal mode, yanks reaching the clipboard, and running your commands once,
  keeping the refused lines and their errors. Registers, marks, and macros are the engine's, shared
  by every field of the tab.
- **The mode store** holds the focused field's mode, or NAV, and its cursor's place.
- **The status line** takes lualine's sections, as LazyVim sets them: the mode, the branch, the file
  and the page's hints, then the counts and the cursor's place. Its separators are triangles it
  draws, since the bundled fonts have no Powerline glyphs. Each mode has lualine's name, a Lucide
  icon, and the Catppuccin lualine theme's colour: NAV `compass` grey, NORMAL `square` blue, INSERT
  `pencil` green, VISUAL, V-LINE, and V-BLOCK `square-dashed` mauve, REPLACE `replace` red, COMMAND
  `terminal` peach. The branch and the file show on a buffer only. The sections are files of their
  own: `StatusLine.tsx` has 240 lines.
- **The settings** gain `vim_mode` and `vim_commands` in the core's `[keyboard]` table, through the
  binding, the server's settings view and mutations, and the Keyboard section: the switch, the
  commands' field, and its refused lines. See the [data model](data-model.md).
- **The buffer** is a page at `/buffer/<path>`, over the proposal editor's hook, keeping the
  frontmatter. The shell draws it alone, without the sidebar, the rail, or the top tabs, over the
  status line on wide screens and the bottom bar on the phone. Its `:q` and `:wq` go back. Its save
  writes and commits in one queued git write, with the conflict check of today. The core's rule for
  text writes accepts any Markdown file under `specs/`, from the default branch or, for a feature's
  folder at any depth, from its branch. `Space b` is declared on the pages showing one file: the
  proposal editor, a feature's file pages, the inbox, the priorities, a decision, and a document.
- **A lint rule** forbids Astryx's text fields outside the editor, with the password's and the
  picker's exceptions marked in place.
- **The documentation**: the skill's conventions gain the buffer's commit message, the keyboard
  guide gains Vim and `Space b`, and [`docs/web-ui.md`](/docs/web-ui.md) describes both.

Tradeoffs:

- CodeMirror loads with every page, about 176 KB compressed, the first load slower than today.
- The editor's look is kept in step with the theme by hand, as an Astryx gap.
- CodeMirror's home moved off GitHub this year, and its releases continue on npm only.
- Keys the browser keeps never reach Vim: Ctrl+W closes the tab, even in insert mode.

## Edge cases

| Importance | Situation                                                          | What happens                                                                                    |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| High       | Vim on, a changed row, Escape twice quickly                        | the first goes to normal mode; the second asks "Discard your changes?" before dropping anything |
| High       | A buffer saved over a file changed underneath                      | nothing is written; the conflict banner offers to copy the text or load the new version         |
| High       | A buffer edit breaks the file's format, like a decision's sections | saved and committed as typed; `ura check`'s problems show where they do today                   |
| High       | Turning Vim mode off while a field holds unsaved text              | the field loses Vim at once; the text stays, unsaved, in the same field                         |
| Normal     | Shift+Escape in Chrome on Linux, where it opens the task manager   | the field takes it, as JupyterLab's Vim does                                                    |
| Normal     | A dead key or an input method in normal mode                       | the engine's known gap: the character may be inserted; insert mode works as today               |
| Normal     | `"+p` without clipboard permission                                 | the browser asks for it, or offers its own Paste; nothing is pasted until allowed               |
| Normal     | A one-line field with a 2,000-character line                       | it wraps and grows; past 9 lines, as tall as the phone's composer, it scrolls inside            |
| Normal     | A buffer open on a screen too short for its text                   | the text scrolls inside the window; the status line stays at the bottom                         |
| Normal     | The `:` prompt in a one-line field                                 | it opens under the field, as in a multi-line one                                                |
| Niche      | Ctrl+W in insert mode                                              | the browser closes the tab; the Leave guard asks first when text is unsaved                     |
| Niche      | An iPad with a keyboard, its main pointer touch                    | no Vim, as on a phone                                                                           |

## Success criteria

- **SC-001** (every field): every text field of the web UI is the editor, but the password and a
  picker's filter, checked by lint.
- **SC-002** (keystroke): a key typed in a 2,000-character comment, Vim on, draws within 16 ms on
  the benchmark.
- **SC-003** (reload): a page reloads within 1 second with the editor, on the benchmark, as the
  performance decision asks.
- **SC-004** (switch off): with Vim off, the Vim engine's chunk is never requested.
- **SC-005** (settings): the two new keys read, write, and keep comments and order, as the core's
  settings tests check for every key.
- **SC-006** (buffer): a buffer saves any Markdown file under `specs/`, refuses any other path, and
  refuses a changed file, checked by the core's tests.

## Assumptions

The points of the round's [Check these](clarifications-01.md#check-these) and
[Settled without the human](clarifications-01.md#settled-without-the-human) hold as written there,
but two that your answers changed. Markdown highlighting is in, in every field, as your note asked.
Fields keep Astryx's look nowhere, since every field is the editor, and look like a terminal's text.

Settled while writing this spec:

- **Yanks only** reach the clipboard: a delete stays in Vim's registers, so `dd` never replaces what
  you copied elsewhere. Checked in a throwaway experiment: wrapping the engine's register controller
  sends `yw` and `yy` to the clipboard.
- **The engine under the test DOM**: checked in a throwaway experiment under happy-dom, `i`, Escape,
  `dw`, and a typed `x` work, and Escape in normal mode reaches the page.
- **Refused commands** carry the engine's message, checked the same way: "Not an editor command
  ":foo bar"", "Unknown option: nsense".
- **The mode names** are lualine's, which LazyVim shows: NORMAL, INSERT, VISUAL, V-LINE, V-BLOCK,
  REPLACE, COMMAND, with NAV for the page's keys, as you asked.
- **No clock** at the status line's right end, unlike LazyVim's: Uraeda's page shows no time
  elsewhere, and the line keeps the counts there.
- **Code blocks** are highlighted as Markdown, not by their language, to keep the size.
- **The buffer** opens Markdown files only, and saves with a commit, unlike the proposal editor,
  because the inbox and the priorities are committed by every structured action.
- **A buffer opens** with its cursor at the file's start, in normal mode with Vim mode on, as when
  Vim opens a file: a buffer is read before it is edited.
- **`Space b`** is free on every page, and "b" reads as buffer.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

Medium: two new settings keys and wider text writes in the core, and every field of the UI changes
its element, with no stored data converted.

## History

> [!NOTE]
>
> Changes requested on 2026-11-03: 2 comments in spec-review.md.
>
> - You approve one editor, built on CodeMirror, for every text field: Markdown highlighted, long
>   lines wrapped, Vim's keys behind a switch, the mode in the status line, and a buffer for any
>   file.
> - A new decision, Text editing, and a change to UI components: text fields leave Astryx for good,
>   Vim on or off. Your note asked for highlighting without Vim, which only the editor gives.
> - The cost of that note: CodeMirror loads with every page, about 176 KB compressed, where the
>   round assumed it only with Vim on.
> - Two fields stay as they are, reading "every field" narrowly: the password, for password
>   managers, and a picker's filter, which is part of Astryx's palette.
> - Fields that ignore Escape today, like a comment, now leave on it, as the keyboard guide says.
> - The buffer's save also commits, so a hand edit never rides into the next inbox action's commit.
> - Risk tier medium: no plan review. 25 test files type into today's fields and move to one typing
>   helper, their assertions kept.
