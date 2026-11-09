# Keyboard

"Like every single other view, we need keyboard navigation." A view is not finished until the human
can do everything in it without the mouse, with the habits of Vim, LazyVim, and Helix. The
[Keyboard](../decisions/keyboard.md) decision holds the rules: one registry, a Space leader, a base
keymap, and a switch to turn single keys off. This guide says how a view uses them.

## The habits

Every view keeps the habits that apply to what it shows; a page adds the ones its content needs.

| Key                       | Does                                                                                                                      | Where                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `j` `k`, `↑` `↓`          | Move the selection or the cursor, or scroll a page with neither, gliding as a browser's arrows do                         | Every page                            |
| `h` `l`, `←` `→`          | Move between columns or panes                                                                                             | A page of columns: home, priorities   |
| `Enter`                   | The selection's obvious action: open it, or the page's next step                                                          | Every page with a selection or a step |
| `i`                       | Edit the selection in place ("use `i` to start editing like we do everywhere else")                                       | Every editable selection              |
| `a`, `o`                  | Add: `a` in the selected row's section on the priorities, else at the page's default place; `o` beside the selection      | A list of rows: priorities, inbox     |
| `d`                       | Delete the selection at once, undone with `u`                                                                             | A list of rows                        |
| `m`                       | Move mode: the row moves with the move keys, across sections, until `Enter` or `Escape`                                   | A list of rows                        |
| `u`, `Ctrl+Z`             | Undo the tab's latest action, outside text fields (see [Surfaces](surfaces.md#undo))                                      | Every page                            |
| `U`, `Ctrl+Shift+Z`       | Redo the latest undone action. On a Mac, `Cmd` replaces `Ctrl` in both chords                                             | Every page                            |
| `/`                       | Search or filter the page's list                                                                                          | A page with a list to filter          |
| `gg`, `G`                 | Top and bottom: the first and last row of a list, as `Home` `End`                                                         | Every page                            |
| `g` then a letter         | Go: `h` home, `i` inbox, `p` priorities, `d` decisions, `s` sessions, `,` settings, `n` new, `c` commit, `r` a repository | Every page                            |
| `Space`                   | The leader menu                                                                                                           | Every page                            |
| `Space b`                 | Open the page's file as a buffer, the whole file to edit                                                                  | Every page showing one file           |
| `?`                       | The key map: every key that works where the focus is, with a search                                                       | Every page                            |
| `b`                       | Back                                                                                                                      | Every page                            |
| `Ctrl+D`, `Ctrl+U`        | Half a screen down and up (never Cmd on a Mac, which the browser owns)                                                    | Every page                            |
| `[`, `]`                  | Fold the sidebar, and the right column                                                                                    | `[` everywhere; `]` on wide screens   |
| `Escape`                  | Leave the field, the layer, or the mode, and nothing more; with Vim mode on, insert mode goes to normal mode first        | Every page                            |
| `y`, `n`                  | Answer a confirmation                                                                                                     | The shared confirmation               |
| `Ctrl+Enter`, `Cmd+Enter` | Send what a field holds, as its button does                                                                               | Every field of several lines          |

A page's own keys are few, short, and mnemonic: the feature page's `n` for the next step and `s` `S`
for its sessions, a review's `n` for its verdict, the inbox's `c` to move a note to a category and
`p` to promote it, the priorities' `e` to expand a proposal into a file, `c` to clean a merged one,
and `v` to switch between columns and a list. A composer's `m` opens its model picker, or its
effort's in a running session, as `Space a` does, on the New page, a session's page, and a session
in a review's column: none of them has a row to move. A round's banner, beside the inbox's notes,
keeps `Space a` alone. A page never gives a base key another meaning while its own content uses it.

## In a field

Every text field is one editor, with keys of its own that the page never hears.

- **`Enter`** runs a one-line field's action, like saving a row; in a field of several lines it adds
  a line. `Ctrl+Enter` sends what any field holds, as its button does: a commit message's commits
  its pane.
- **A session's composer sends on `Enter`**, as a chat does, and `Shift+Enter` adds a line. Under a
  finger, whose keyboard has no `Shift+Enter`, `Enter` adds a line and the Send button sends. The
  New page's composers keep `Enter` for a line: a stray one there would start a feature.
- **`Escape` leaves the field**, keeping its text, and the page's keys work again: `j` moves the
  selection. A changed row asks "Discard your changes?" first; in a layer, it is the layer's Escape.
- **Vim mode**, a switch in the settings' Keyboard section, off by default, gives every field Vim's
  keys. A field opens in insert mode, typing as without Vim. `Escape` goes to normal mode, and
  `Escape` in normal mode is the field's own `Escape`, as above. `Shift+Escape` leaves the field
  from any mode. `Enter` in normal mode saves a row, and moves down a line in a field of several
  lines. In a picker's filter, as in LazyVim's picker, `j` and `k` in normal mode move the
  highlighted row and `Enter` opens it; `Escape` in normal mode closes the picker.
- **A picker's filter** moves its highlighted row with `Ctrl+J` and `Ctrl+K` too, Vim mode or not,
  as LazyVim's picker does, besides the arrows.
- **Vim's commands** work in every field: `:w` is the field's `Ctrl+Enter`, `:q` its `Escape`, and
  `:wq` both. A yank also reaches the system clipboard; a delete never replaces what was copied.
- **Touch screens** have no Vim: on a phone, or wherever the main pointer is a finger, fields type
  as without it.

## The buffer

`Space b` opens the file the page shows, frontmatter included, as a buffer: the center column holds
its whole text, under a line naming the file. With Vim mode on, it opens in normal mode at the
file's start, as Vim opens a file. `:w` or `Ctrl+Enter` saves it, without committing: the edit waits
on the Git page. `:q`, or `b` outside the text, goes back, asking first while the text is not saved;
`:wq` saves, then goes back. `Escape` leaves the text for the page's keys, as in any field.

## Selection

- **One selection per view, always visible.** Moving it clears the old one at once; a selection
  shown in two places, or a new one that shows nothing, is a bug.
- **It looks the same everywhere**: a selected row or card is the accent's muted tint with a bar at
  its start, and the keyboard's ring goes around the whole card (`layout/picked.ts`).
- **Everything actionable is reachable**: the cards, the panes' buttons, and the rows that add ("put
  my keyboard-driven cursor on 'add to now/next/...' and press enter").
- **It moves in two dimensions** where the page has columns: `h` `l` cross them, keeping the row's
  height where it can.
- **On a list, the mouse moves it too.** Moving the pointer onto a row moves the selection there; a
  click selects; a click on the selected row, or a double click, edits it. A row that slides under a
  resting pointer, as the page scrolls or a list grows, takes nothing: only a pointer that moves
  does, so the keys' selection is never taken from under them.
- **A widget with keys of its own**, like home's grid of cards or a radio group, takes its arrows
  before the registry does, and leaves a letter typed while a sequence or the leader's menu waits to
  them.

## The cursor

The pages read most, a spec's or a plan's review, a document, and a round of questions, have a
cursor instead of a list's selection: `j` `k` move it from stop to stop, in reading order, and what
it holds has a few keys of its own.

- **Its stops** are the blocks a review comments on, the pending comments under them, the folds, and
  an embedded story's or mockup's buttons; on a round, each question's whole card, the settled
  points, the notes, and the commit. What is inside a story or a mockup stays the pointer's.
- **It starts where the human reads**: a page opens with no cursor, and the first `j` or `k` takes
  the topmost stop on screen, as it does again after `Escape` cleared it, or once `Ctrl+D` scrolled
  it away.
- **It scrolls little**: only when the stop comes within 100 px of the top bar or the status line,
  or moves into another pane, which then shows whole when it fits. A stop taller than the screen, a
  long question, scrolls through before `j` leaves it, so every option is read.
- **A selection's keys win while it holds** ([Keyboard](../decisions/keyboard.md)): a held
  question's `a` to `f` pick its options, so `b` is Back again only after `Escape`. `g` never picks:
  an option G is picked by `Tab` and `Space`. A block's `Enter` comments, `J` `K` (or `Shift` with
  the arrows) stretch the comment over more blocks, and `s` asks the agent; a pending comment's
  `Enter` edits it and `d` removes it at once, with an Undo.
- **The pointer hides it**: a mouse that moves clears the cursor, and a click never shows it. It is
  the keyboard's alone, where a list's selection is both's.
- **It is the browser's focus**, on the stop's own element, so a screen reader follows it.

## Focus

- A layer that opens takes the focus where typing goes: a picker its filter, a form its field. The
  shared confirmation focuses Cancel, so that Enter changes nothing.
- `Escape` gives the focus back where it was before the layer opened.
- A page that starts something opens with the focus in its text field: the New page in the picked
  kind's composer, and again after `s c f` pick a card, a feature's New session in its composer, and
  on a keyboard's screen, the session a hand-over opens, the workflow's message waiting for `Enter`.
  `Escape` gives the page its keys back. Back to a New page scrolled down its entries keeps its
  place instead.
- After an action that sends the human somewhere, they land there, with the result selected: a note
  promoted to the priorities opens the priorities at that line.
- A list opens with no row selected, unless the address names one: a selection nobody made looks odd
  under a mouse ("it's ok to have no focus on open in a list"). The first `j` selects its first row.
  Where Space is the row's own, as a Git page's box, the page opens with its first row selected and
  focused, so that Space stages at once.

## What shows the keys

- **The status line**, at the bottom of wide and semi-wide screens, in LazyVim's shape, opens with
  the Vim mode while Vim mode is on: NAV while the keys act on the page, else the field's mode, as
  NORMAL or INSERT. It then shows the hints the page's bindings declare (a binding with a `hint`),
  each one a button that does what its key does. `Space menu` comes first, `? keys` second, and
  `[ ] fold` third, then the page's hints, in the order the human uses them, the step that ends the
  page's work last ("Start should be at the end"), then the shell's.
- **The most important keys of the whole page**, decided page by page: "the status bar holds the
  _most important_ shortcuts for the _full page_". A key that works on every page (`b`, `Ctrl+D`,
  `gg`), a second key for an action already shown (`a` beside `o`, `Enter` beside `n`), and the
  movement keys usually stay unhinted, and work.
- **A row's or a pane's keys show close to it**: "Shortcuts applying to a row or pane should be
  close to that pane". A row's show under the selected row, in its bar, each written out ("⏎ edit",
  "m move", "d delete"), not in the status line; so do the keys of what the cursor holds, under a
  block or at the end of a question's card ("a b pick", "i comment").
- **The leader menu** shows every sequence: `Space` then its groups (go, find, new, the ui), and the
  `g` keys. It is a menu of its own, not an index of every key: a page's single keys are not in it,
  they show in the status line. Its rows are buttons, and a click on `Space menu` opens it at once.
- **The key map**, `?` or `Space ?`, lists every key that works where the focus is, read from the
  registry: the page's, the shell's, the leader menu's by group, and the `g` keys, keys of one label
  on one row (`j ↓ +`), with a search over the labels, the keys, and the groups. It is the index the
  leader menu is not, and runs nothing: a reference over the page, on glass over the dimmed page, a
  sheet on the phone. With the single keys off it lists only the keys that still work, the leader's
  written from `Ctrl+K`.
- **Nothing on the phone.** Keys still work with a keyboard attached, but the phone's bars show
  icons, not keys (see [the phone](phone.md)).

## Speed

Keys answer at once. A move, an edit, or a reorder shows its result immediately and writes behind it
("make everything optimistic and changes async"); a refused write puts it back and says why where it
happened. The leader menu waits a moment before showing (300 ms), so a quick sequence never flashes
it, and slides in when it does. Once shown, a menu waits for its key, a `g`'s as Space's, as
LazyVim's which-key does: it never closes under the human reading it.
