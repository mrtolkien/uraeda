---
status: approved
revision: 5
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Vim in text edit mode

> [!NOTE]
>
> Approved on 2026-11-03.
>
> - You approve one editor, built on CodeMirror, for every text field: Markdown highlighted, long
>   lines wrapped, Vim mode behind a switch, the mode in the status line, and a buffer for any file.
> - Since your review, the Commit page has one pane per branch with changes, each with its own
>   changes, message, Commit, and Discard: a new story, with its mockup.
> - Each pane's message is a field, filled with the suggested message; you can rewrite it, and go
>   back to the suggestion.
> - On the phone, two panes put their buttons in each pane; one pane keeps today's bottom bar.
> - Two rare scenarios moved to the edge cases, keeping the spec at 30 scenarios.
> - Unchanged: the editor, Vim mode, the status line, the buffer, and the decisions.

The [proposal](proposal.md) asks for Vim's keys in every text field, as many as possible, with the
mode in the status line and a buffer for any file. The [discovery](discovery-01.md) found one
complete engine, CodeMirror's, and your [answers](clarifications-01.md) chose it for every field,
with Markdown highlighting even without Vim.

## Your review

- **C1** (a commit per branch, and an editable message): done. The Commit page has a pane per branch
  with changes, each committed by its own Commit, and each message is a field you can rewrite. See
  [commit each branch apart](#us6-commit-each-branch-apart-p2).

## Decisions

- **New: [Text editing](../decisions/text-editing.md)**. Every text field is one CodeMirror editor,
  Markdown highlighted and wrapped, with Vim's keys from CodeMirror's engine behind a switch, off by
  default.
- **Changed: [UI components](../decisions/ui-components.md)**. Views use Astryx wherever one fits,
  except text fields, which follow Text editing.
- **Changed: [Git](../decisions/git.md)**. Tools commit the human's edits only when the human asks,
  on the Commit page or by an action that says it commits; starting a feature or a change commits on
  its own.

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
and the buffer fills the center column, the sidebar beside it. A line at its top shows the file as
Neovim's bufferline does. You edit it, Vim mode on or off, save with `:w` or Ctrl+Enter, and leave
with `:q`.

[A file opened as a buffer](mockups/buffer.html)

Key scenarios:

1. **Given** the priorities page, **When** you press `Space b`, **Then** `specs/PRIORITIES.md` fills
   the center column, its top line reading "specs › PRIORITIES.md", and the status line its branch,
   "main".
2. **Given** you add the line "- Global undo" under Now, **When** you type `:w`, **Then** the file
   is written, not committed: the top line's unsaved mark goes, and the Commit page lists "Edit
   specs/PRIORITIES.md".
3. **Given** an agent committed to the priorities since the buffer opened, **When** you save,
   **Then** nothing is written, and a banner across the top offers "Copy my text" and "Load the new
   version".

More scenarios:

1. **Given** a feature's spec page, **When** you press `Space b`, **Then** its `spec.md` opens from
   the feature's branch, and a save writes it there.
2. **Given** the feature's agent is working, **When** you save its spec's buffer, **Then** it is
   refused, in the banner: "An agent is working on this feature. Stop it first, or wait for it."
3. **Given** unsaved text in a buffer, **When** you type `:q`, or press `b` outside the text,
   **Then** the Leave guard asks first; `:wq` saves, then goes back.
4. **Given** a phone, **When** a buffer is open, **Then** the top line names the file, and the
   bottom bar holds Back and Save, its only controls.
5. **Given** home or the settings, pages showing no single file, **When** you press `Space b`,
   **Then** nothing happens, and the leader menu does not list it there.

### US6: Commit each branch apart (P2)

The Commit page shows a pane per branch with changes: the default branch's, then each feature's
whose files a buffer changed. Each pane lists what its commit holds, its message in a field you can
rewrite, and its own Commit and Discard.

[The Commit page, two branches](mockups/commit.html)

Key scenarios:

1. **Given** you saved `specs/PRIORITIES.md` and the spec of "vim-text" in buffers, **When** you
   open the Commit page, **Then** it shows a "main" pane holding "Edit specs/PRIORITIES.md" and a
   "2026-11-03-vim-text" pane holding "Edit spec.md", each with its Commit.
2. **Given** those two panes, **When** you press Commit in the feature's, **Then** only its branch
   gets the commit `chore(vim-text): edit spec.md`, and the "main" pane stays.
3. **Given** the "main" pane's message "chore: edit specs/PRIORITIES.md", **When** you rewrite it as
   "chore: add Global undo to Now" and commit, **Then** the commit has your message, as typed.

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
- **The Commit page commits the default branch only, with the core's message.** Guarded by the
  commit tests of the core's changes and the server's `changes.commit`, which keep passing with the
  suggested message.
- **The core writes as text only proposal files, note files, and a feature's top-level files.**
  Guarded by no test: the test refusing paths that climb out of `specs/proposals/` stays as it is.

## Architecture

Every field becomes one shared editor over CodeMirror 6, with
[`@codemirror/lang-markdown`](https://github.com/codemirror/lang-markdown) and
[`@replit/codemirror-vim`](https://github.com/replit/codemirror-vim), the Vim engine Overleaf and
JupyterLab ship (see [discovery](discovery-01.md#replitcodemirror-vim-codemirror-6)). The field
components keep their props and callers, so pages change little.

- **The editor** draws every text field in three variants: one line (wraps, grows, refuses line
  breaks), several lines (rows by kind), and the composer (grows upward, takes images). It owns
  highlighting, wrapping, the accessible name, the terminal look over the theme's tokens, and
  Escape: it leaves the field or cancels a row, and inside a layer it is the layer's.
- **The Vim layer** loads in its own chunk at start, only with the switch on and a fine main
  pointer. It owns insert mode at focus, Escape and Shift+Escape handing over to the editor's
  Escape, `:w`, `:q`, `:wq`, yanks reaching the clipboard, and your commands with their errors.
- **The mode store** holds the focused field's mode, or NAV, and its cursor's place.
- **The status line** takes lualine's sections, its separators triangles it draws, since the bundled
  fonts have no Powerline glyphs. Icons are Lucide's: NAV `compass`, NORMAL `square`, INSERT
  `pencil`, the visual modes `square-dashed`, REPLACE `replace`, COMMAND `terminal`. Its sections
  are files of their own, since `StatusLine.tsx` has 240 lines.
- **The settings** gain `vim_mode` and `vim_commands`, from the core to the Keyboard section. See
  the [data model](data-model.md).
- **The buffer** is a page at `/buffer/<path>` over the proposal editor's hook, keeping the
  frontmatter, in the center column under its bufferline. Its save writes only, with today's
  conflict check. The core's text writes accept any Markdown file under `specs/`, on the default
  branch or, for a feature's folder, on its branch. `Space b` is declared on every page showing one
  file.
- **The Commit page** has a pane per branch with changes, the default branch's first, each with its
  changes, its message field, and its own Commit and Discard; with one pane, it looks as today. The
  core lists each branch's changes, now with any Markdown file under `specs/`, and suggests its
  message; a commit takes the message as typed.
- **A lint rule** forbids Astryx's text fields outside the editor, the password and the picker
  marked in place.
- **The documentation**: the skill's conventions, the keyboard guide, and
  [`docs/web-ui.md`](/docs/web-ui.md).

Tradeoffs:

- CodeMirror loads with every page, about 176 KB compressed, the first load slower than today.
- The editor's look is kept in step with the theme by hand, as an Astryx gap.
- CodeMirror's home moved off GitHub this year, and its releases continue on npm only.
- Keys the browser keeps never reach Vim: Ctrl+W closes the tab, even in insert mode.

## Edge cases

| Importance | Situation                                                                | What happens                                                                                                        |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| High       | Vim on, a changed row, Escape twice quickly                              | the first goes to normal mode; the second asks "Discard your changes?" before dropping anything                     |
| High       | A buffer saved over a file changed underneath                            | nothing is written; the conflict banner offers to copy the text or load the new version                             |
| High       | A buffer edit breaks the file's format, like a decision's sections       | saved as typed, and committed only from the Commit page; `ura check`'s problems show as today                       |
| High       | A commit message emptied                                                 | Commit is refused in its pane: "A commit needs a message."                                                          |
| High       | Turning Vim mode off while a field holds unsaved text                    | the field loses Vim at once; the text stays, unsaved, in the same field                                             |
| Normal     | The changes grow after you rewrote the message                           | your message stays; the pane's list shows the new change, and "Use the suggested message" brings the new suggestion |
| Normal     | Two panes on the phone                                                   | each pane holds its own Commit and Discard, and the bottom bar holds none                                           |
| Normal     | Escape in normal mode in a dialog's field, like the `?` key map's search | the dialog closes, as today                                                                                         |
| Normal     | Committing a feature's buffer edits while its agent works                | refused on the Commit page: "An agent is working on this feature. Stop it first, or wait for it."                   |
| Normal     | Shift+Escape in Chrome on Linux, where it opens the task manager         | the field takes it, as JupyterLab's Vim does                                                                        |
| Normal     | A dead key or an input method in normal mode                             | the engine's known gap: the character may be inserted; insert mode works as today                                   |
| Normal     | `"+p` without clipboard permission                                       | the browser asks for it, or offers its own Paste; nothing is pasted until allowed                                   |
| Normal     | A one-line field with a 2,000-character line                             | it wraps and grows; past 9 lines, as tall as the phone's composer, it scrolls inside                                |
| Niche      | A screen reader, when the Vim mode changes in a field                    | the new mode is read out politely, once                                                                             |
| Niche      | Ctrl+W in insert mode                                                    | the browser closes the tab; the Leave guard asks first when text is unsaved                                         |

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

- **Yanks only** reach the clipboard: `dd` never replaces what you copied elsewhere.
- **Checked in throwaway experiments**, under happy-dom: the engine's `i`, Escape, `dw`, and typed
  keys work, Escape in normal mode reaches the page, yanks reach the clipboard through the engine's
  register controller, and a refused command carries the engine's message.
- **No clock**, unlike LazyVim's status line: its right end keeps the counts.
- **Code blocks** are highlighted as Markdown, not by their language, to keep the size.
- **One buffer at a time**: the top line shows the open file only, not a list of buffers, as Uraeda
  opens one page at a time.
- **The buffer** opens Markdown files only, and saves without committing, as every edit does.
- **A feature's file changed in a buffer** stays uncommitted while its agent runs: the agent's step
  commits only its own files, and the edit waits on the Commit page.
- **A buffer opens** with its cursor at the file's start, in normal mode with Vim mode on, as when
  Vim opens a file: a buffer is read before it is edited.
- **The Commit page's keys**: with several panes, `j` and `k` select one, and Enter and `d` commit
  or discard the selected pane only; Ctrl+Enter in a message commits its pane.
- **`Space b`** is free on every page, and "b" reads as buffer.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

Medium: two new settings keys, wider text writes in the core, a Commit page listing every branch,
and every field of the UI changes its element, with no stored data converted.

## History

> [!NOTE]
>
> Changes requested on 2026-11-03: 1 comment in spec-review.md.
>
> - You approve one editor, built on CodeMirror, for every text field: Markdown highlighted, long
>   lines wrapped, Vim mode behind a switch, the mode in the status line, and a buffer for any file.
> - Since your review, a buffer only saves: nothing commits on its own, and its edits wait on the
>   Commit page, like every other edit.
> - A changed decision, Git: tools commit your edits only when you ask, on the Commit page or by an
>   action that says it commits. Only starting a feature or a change commits on its own.
> - I read "an action that says it commits" as keeping today's: "Add and commit" in the inbox,
>   submitting answers, a review's verdict, and the proposal editor's Commit.
> - The Commit page grows: it lists the files a buffer changed, on the default branch and, per
>   feature, on its branch, each branch committed apart.
> - Unchanged: the editor, Vim mode, the status line, the buffer's layout, and the other decisions.

> [!NOTE]
>
> Changes requested on 2026-11-03: 1 comment in spec-review.md.
>
> - You approve one editor, built on CodeMirror, for every text field: Markdown highlighted, long
>   lines wrapped, Vim mode behind a switch, the mode in the status line, and a buffer for any file.
> - Since your review, the buffer fills the center column only: the sidebar stays, and a line at the
>   top shows the file as bufferline does, its path, name, and unsaved mark.
> - The right column folds away while a buffer is open, and comes back when you leave it.
> - The file's path left the status line, so it shows once, in the buffer's top line.
> - One buffer at a time: the top line holds no list of open buffers.
> - Unchanged: the status line in LazyVim's shape, the "Vim mode" setting, the decisions, and every
>   other story.

> [!NOTE]
>
> Changes requested on 2026-11-03: 1 comment in spec-review.md.
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
