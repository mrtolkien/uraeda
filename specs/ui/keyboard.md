# Keyboard

"Like every single other view, we need keyboard navigation." A view is not finished until the human
can do everything in it without the mouse, with the habits of Vim, LazyVim, and Helix. The
[Keyboard](../decisions/keyboard.md) decision holds the rules: one registry, a Space leader, a base
keymap, and a switch to turn single keys off. This guide says how a view uses them.

## The habits

Every view keeps the habits that apply to what it shows; a page adds the ones its content needs.

| Key                       | Does                                                                                                                      | Where                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `j` `k`, `↑` `↓`          | Move the selection, or scroll a page with none, gliding as a browser's arrows do                                          | Every page                            |
| `h` `l`, `←` `→`          | Move between columns or panes                                                                                             | A page of columns: home, priorities   |
| `Enter`                   | The selection's obvious action: open it, or the page's next step                                                          | Every page with a selection or a step |
| `i`                       | Edit the selection in place ("use `i` to start editing like we do everywhere else")                                       | Every editable selection              |
| `a`, `o`                  | Add: at the page's default place, or beside the selection                                                                 | A list of rows: priorities, inbox     |
| `d`, `dd`                 | Delete the selection, after a yes/no                                                                                      | A list of rows                        |
| `m`                       | Move mode: the row moves with the move keys, across sections, until `Enter` or `Escape`                                   | A list of rows                        |
| `u`                       | Undo the last write that offers one (see [Surfaces](surfaces.md#undo))                                                    | Every page                            |
| `/`                       | Search or filter the page's list                                                                                          | A page with a list to filter          |
| `gg`, `G`                 | Top and bottom                                                                                                            | Every page                            |
| `g` then a letter         | Go: `h` home, `i` inbox, `p` priorities, `d` decisions, `s` sessions, `,` settings, `n` new, `c` commit, `r` a repository | Every page                            |
| `Space`                   | The leader menu                                                                                                           | Every page                            |
| `?`                       | The key map: every key that works where the focus is, with a search                                                       | Every page                            |
| `b`                       | Back                                                                                                                      | Every page                            |
| `Ctrl+D`, `Ctrl+U`        | Half a screen down and up (never Cmd on a Mac, which the browser owns)                                                    | Every page                            |
| `[`, `]`                  | Fold the sidebar, and the right column                                                                                    | `[` everywhere; `]` on wide screens   |
| `Escape`                  | Leave the field, the layer, or the mode, and nothing more                                                                 | Every page                            |
| `y`, `n`                  | Answer a confirmation                                                                                                     | The shared confirmation               |
| `Ctrl+Enter`, `Cmd+Enter` | Send what a field holds, as its button does                                                                               | Every field of several lines          |

A page's own keys are few, short, and mnemonic: the feature page's `n` for the next step and `s` `S`
for its sessions, the inbox's `c` to move a note to a category and `p` to promote it, the
priorities' `v` to switch between columns and a list. A page never gives a base key another meaning.

## Selection

- **One selection per view, always visible.** Moving it clears the old one at once; a selection
  shown in two places, or a new one that shows nothing, is a bug.
- **It looks the same everywhere**: a selected row or card is the accent's muted tint with a bar at
  its start, and the keyboard's ring goes around the whole card (`layout/picked.ts`).
- **Everything actionable is reachable**: the cards, the panes' buttons, and the rows that add ("put
  my keyboard-driven cursor on 'add to now/next/...' and press enter").
- **It moves in two dimensions** where the page has columns: `h` `l` cross them, keeping the row's
  height where it can.
- **The mouse moves it too.** Hovering a row in a list moves the selection there; a click selects; a
  click on the selected row, or a double click, edits it.
- **A widget with keys of its own**, like home's grid of cards or a radio group, takes its arrows
  before the registry does, and leaves a letter typed while a sequence or the leader's menu waits to
  them.

## Focus

- A layer that opens takes the focus where typing goes: a picker its filter, a form its field. The
  shared confirmation focuses Cancel, so that Enter changes nothing.
- `Escape` gives the focus back where it was before the layer opened.
- After an action that sends the human somewhere, they land there, with the result selected: a note
  promoted to the priorities opens the priorities at that line.
- A page with a list opens with a row selected: the first of its first section, or the one the
  address names.

## What shows the keys

- **The status line**, at the bottom of wide and semi-wide screens, shows the hints the page's
  bindings declare (a binding with a `hint`), each one a button that does what its key does.
  `Space menu` comes first, `? keys` second, and `[ ] fold` third, then the page's hints, in the
  order the human uses them, the step that ends the page's work last ("Start should be at the end"),
  then the shell's.
- **The most important keys of the whole page**, decided page by page: "the status bar holds the
  _most important_ shortcuts for the _full page_". A key that works on every page (`b`, `Ctrl+D`,
  `gg`), a second key for an action already shown (`a` beside `o`, `Enter` beside `n`), and the
  movement keys usually stay unhinted, and work.
- **A row's or a pane's keys show close to it**: "Shortcuts applying to a row or pane should be
  close to that pane". A row's show under the selected row, in its bar, each written out ("⏎ edit",
  "m move", "d delete"), not in the status line.
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
it, and slides in when it does.
