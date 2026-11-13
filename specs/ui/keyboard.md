# Keyboard

"Like every single other view, we need keyboard navigation." A view is not finished until the human
can do everything in it without the mouse, with the habits of Vim, LazyVim, and Helix. The
[Keyboard](../decisions/keyboard.md) decision holds the boundaries: every action by keyboard and by
tap, one registry, one meaning for a key on a page, a switch to turn single keys off, and keys at
every width. This guide says the rest: the keys themselves, and how a view shows them.

## The habits

Every view keeps the habits that apply to what it shows; a page adds the ones its content needs.

| Key                       | Does                                                                                                                   | Where                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `j` `k`, `↑` `↓`          | Move the selection or the cursor, or scroll a page with neither, gliding as a browser's arrows do                      | Every page                            |
| `h` `l`, `←` `→`          | Move between columns or panes                                                                                          | Columns: home, priorities, a session  |
| `Enter`                   | The selection's obvious action: open it, or the page's next step                                                       | Every page with a selection or a step |
| `i`                       | Edit the selection in place ("use `i` to start editing like we do everywhere else")                                    | Every editable selection              |
| `a`, `o`                  | Add: `a` in the selected row's section on the priorities, else at the page's default place; `o` beside the selection   | A list of rows: priorities, inbox     |
| `d`                       | Delete the selection at once, undone with `u`                                                                          | A list of rows                        |
| `m`                       | Move mode: the row moves with the move keys, across sections, until `Enter` or `Escape`                                | A list of rows                        |
| `u`, `Ctrl+Z`             | Undo the tab's latest action, outside text fields (see [Surfaces](surfaces.md#undo))                                   | Every page                            |
| `U`, `Ctrl+Shift+Z`       | Redo the latest undone action. On a Mac, `Cmd` replaces `Ctrl` in both chords                                          | Every page                            |
| `/`                       | Search or filter the page's list                                                                                       | A page with a list to filter          |
| `gg`, `G`                 | Top and bottom: the first and last row of a list, as `Home` `End`; no other key takes `g g`                            | Every page                            |
| `g` then a letter         | Go: `h` home, `i` inbox, `p` priorities, `d` decisions, `s` sessions, `,` settings, `n` new, `c` Git, `r` a repository | Every page                            |
| `Space`                   | The leader menu. `Ctrl+K`, or `Cmd+K`, opens it too, and still does with the single keys off                           | Every page                            |
| `Space b`                 | Open the page's file as a buffer, the whole file to edit                                                               | Every page showing one file           |
| `Space w`                 | The panes: `H` `L` send one to a stack, `m` makes it main, `z` zooms, `o` one stack, `q` closes                        | Every page                            |
| `Shift+Enter`             | Open what the selected row names beside the page, as a tab of the other stack                                          | A list whose rows name a pane         |
| `?`                       | The key map: every key that works where the focus is, with a search                                                    | Every page                            |
| `Tab`, `Shift+Tab`        | The focused pane's next and previous control, field, or link, around; `Enter` presses it, `Escape` lets it go          | Every pane, and every dialog          |
| `b`                       | Back to the page before: never through a page's own search, tabs, or categories                                        | Every page                            |
| `Ctrl+D`, `Ctrl+U`        | Half a screen down and up (never Cmd on a Mac, which the browser owns)                                                 | Every page                            |
| `[`, `]`                  | Fold the sidebar, and the right column                                                                                 | `[` everywhere; `]` on wide screens   |
| `Escape`                  | Leave the field, the layer, or the mode, and nothing more; with Vim mode on, insert mode goes to normal mode first     | Every page                            |
| The key again, `Enter`    | Confirm what spends or sends; `Escape` leaves everything as it was                                                     | The shared confirmation               |
| The key again, `y`        | Confirm what loses something for good: Cancel has the focus, so `Enter` changes nothing                                | The shared confirmation               |
| `Ctrl+Enter`, `Cmd+Enter` | Send what a field holds, as its button does                                                                            | Every field of several lines          |

A page's own keys are few, short, and mnemonic: the feature page's `n` for the next step and `S` for
a new session, a review's `n` for its verdict, the inbox's `c` to move a note to a category and `p`
to promote it, a proposal's `w` to write it into a file, the feature page's `n` to clean a merged
one, and the priorities' `v` to switch between columns and a list. A composer's `m` opens its model
picker, or its effort's in a running session, as `Space a` does, on the New page, a session's page,
and a session in a review's column: none of them has a row to move. A round's banner, beside the
inbox's notes, keeps `Space a` alone. A page never gives a base key another meaning while its own
content uses it.

Every page's own keys, as the registry declares them. A key ending in "…" opens a dialog or a
confirmation first.

| Page                    | Its keys                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                    | `a` add a note, `C` continue all…                                                                                                                                                        |
| Inbox                   | `a` add, `i` edit the note, `d` delete, `c` category…, `p` proposal…, `C` new category…, `R` rename the category…, `t` answer the triage                                                 |
| Priorities, a proposal  | `a` add, `v` columns or list; a proposal's `e` edit its line…, `w` write it in a file, `f` `c` feature or change, `s` start…; a nested line's `o` add, `d` remove, `J` `K` move, `>` `<` |
| A feature               | `n` the next step… (merged: clean…), `S` new session, `R` rename, `P` postpone…, `D` drop…, `m` the message, `f` the format notes, `j` `k` between the run map and the history           |
| The run map, continuing | `Enter` pick, `e` effort, `a` add a reviewer, `d` remove, `Ctrl+Enter` continue                                                                                                          |
| A round                 | `a`–`f` answer and go on, `Shift` and `a`–`f` add to the answer, `n` `p` move, `i` comment, `s` ask the agent; at its end `i` the notes, `J` `K` a settled point, `Ctrl+Enter` commit…   |
| A review                | `i` comment, `J` `K` stretch, `s` ask the agent, `n` the verdict; on the verdict `i` the general comment, `a` approve…, `r` request changes…                                             |
| Decisions               | `/` jump…, `o` their order, `r` run the check…                                                                                                                                           |
| A session               | `i` write, `x` stop the agent, `m` model or effort, `R` rename, `a` allow and retry…, `A` allow the whole turn…, `c` make the chat a change…; the sessions' `/` search                   |
| Git                     | `s` stage, `a` stage all, `d` discard…, `o` `t` take a side…, `c` the commit's message, `Ctrl+Enter` commit, `f` fetch, `p` pull, `P` push…, `M` merge…, `m` continue…, `A` abort…       |
| A conflict, its editor  | `1` `2` `3` take a block, `n` the next conflict, `o` `t` take a side…, `Ctrl+Enter` save                                                                                                 |
| Jobs                    | `a` add, `r` run now…, `p` pause or resume, `d` delete…, `e` effort                                                                                                                      |
| A file's editor         | `i` or `Enter` edit, `Ctrl+Enter` save; changed on disk: `v` what changed, `F` the file's version…, `w` yours over it…                                                                   |
| A preview               | `w` the next width, `f` full screen                                                                                                                                                      |

## A key that cannot be taken back

A single key is a slip away, so what one key does is sorted in three:

- **Undone by `u`**: it acts at once. Deleting a note, moving a proposal, editing a line.
- **Cheap, and put back by hand**: it acts at once. Staging a file, pausing a job, a fetch, a pull,
  folding a pane, stopping an agent, which is the safe way and loses nothing it wrote.
- **Neither**: it spends an agent's time, starts a run, leaves this machine, or loses something for
  good. The key, and its button, open the action's own confirmation, `Confirm`, which says what will
  be done, with its names and numbers: "Continue 4 runs?", "Push 3 commits to origin/main?", "Run
  “Weekly report” now?". `Escape` leaves everything as it was. One press more, never a chore, and
  never "Are you sure?". It comes in two kinds:
  - **What spends or sends, and loses nothing** (continue runs, run a job now, push, continue a
    merge, allow and retry, undo a committed change, which writes its reverse): the same key again,
    or `Enter`, does it.
  - **What loses something for good, with no undo** (discard a file's changes, delete a job, remove
    or clean a worktree, take one side of a conflict whole, save over a file changed on disk, take
    the disk's version over typed text, revoke a device, abort a merge, drop or clean a feature,
    dismiss a triage): the shared confirmation focuses Cancel, so that `Enter` changes nothing; `y`,
    or the same key again, does it. Its words say what is lost on the error colour's quiet wash, and
    its button is a red tube, never the lamp.

The keys of the third kind: `C` on Home (continue all), `r` on Jobs (run now), `P` on Git (push),
`Ctrl+Enter` at a round's end (commit the answers), `a` and `r` on a review's verdict (approve,
request changes), `D` on a feature (drop), `m` and `A` on a stopped merge (continue, which commits
it, and abort), `o` and `t` on a conflict (a side, whole), `d` on a changed file, a worktree, and a
job (discard, remove, delete), `a` and `A` on a blocked action (allow, and retry), `n` on a merged
feature (clean), `F` and `w` on a file changed under its editor, and `u` `U` over a change committed
since. A key that opens a dialog with more to read or to pick, a start's, a continue's with its run
map, a merge's branches, is already deliberate: its dialog's own button starts it. A new key of this
kind follows the same rule: its label ends with "…", as its button's does.

## In a field

Every text field is one editor, with keys of its own that the page never hears. A field behaves as
its class does, wherever it is: "all text input fields should follow the same behaviour based on
their types: single line inputs, multiline markdown inputs, and composer inputs are the 3 class I
see atm." It highlights Markdown as it is typed, with Vim mode on or off, and wraps its text, a
one-line field included: "make sure that single line inputs wrap: on mobile, a long single line
input like a priority is impossible to edit properly". A field never scrolls sideways.

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

A file that changed on disk while it is edited, by an agent's write or a pull, is never overwritten
by a save: the editor says so over the text, which stays, and gives three ways out, each with its
key: `v` shows what changed, the patch a save of the text would make; `F` takes the file's version;
`w` saves the text over it. The last two ask first, as each loses something. Every editor of a file
does the same: a buffer, a proposal, a conflicted file.

## Selection

- **One selection per view, always visible.** Moving it clears the old one at once; a selection
  shown in two places, or a new one that shows nothing, is a bug.
- **It looks the same everywhere**: a selected row or card is the accent's muted tint with a bar at
  its start, and the keyboard's ring goes around the whole card.
- **Everything actionable is reachable**: the cards, the panes' buttons, and the rows that add ("put
  my keyboard-driven cursor on 'add to now/next/...' and press enter").
- **It moves in two dimensions** where the page has columns: `h` `l` cross them, keeping the row's
  height where it can.
- **A session's column is crossed the same way**: `l` moves the focus from the page into the column,
  unfolding it first, onto its first row, and `h` gives it back to where it was. There `j` `k` move
  from row to row, the plan's progress at its foot included, and `Enter` is the row's own, a link's
  or a button's. A part with no row, as the Activity's calls, takes the focus itself, and `j` `k`
  scroll it. `k` past the first row reaches the tabs, where `h` `l` open the previous and the next
  one, and `h` on the first goes back to the page. The status line names `h l column`.
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
  shared confirmation takes the keys: the key that asked confirms, and `Escape` leaves; `Enter`
  confirms what loses nothing, and where something is lost, Cancel has the focus, so that `Enter`
  changes nothing, and `y` confirms (see
  [A key that cannot be taken back](#a-key-that-cannot-be-taken-back)).
- `Escape` gives the focus back where it was before the layer opened.
- **`Tab` and `Shift+Tab` go through the focused pane's controls, fields, and links**, in the order
  they are drawn, and around from the last to the first, never into another pane; in a dialog or a
  sheet, through its own. What `Tab` reaches has the one ring of the design language
  (`button.focusRing`, outside its edge), on GTK as in a browser, and comes into sight; a link,
  words of a line, takes its tint instead. `Enter` presses it before the pane's own `Enter`, and
  follows a link. `Space` stays the leader's on a page; in a layer, where no leader is, it presses
  too. `Escape`, or any other key of the pane's, lets go of it, and that key acts on the pane: `j`
  moves its list again. A control that goes while it has the focus leaves the pane its keys.
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
  the mode: NAV while the keys act on the page, else the field's, INSERT in a field without Vim, and
  with Vim NORMAL, INSERT, and the others. In a field it hints only the keys the field lets through.
  It then shows the hints the bindings that work declare (a binding with a `hint`), each one a
  button that does what its key does, nearest the focus first: `Space menu` and `? keys`, which
  teach the rest, then a held selection's (the frame's tabs while they hold the keys: `h l tab`),
  then the focused pane's, in the order the human uses them, the step that ends the pane's work last
  ("Start should be at the end"), then the page's and the frame's (`[ ] fold`, `Space w panes`,
  `h l pane`), then the shell's. A line too short hides the last whole. A hint follows its key's
  guard: `h l pane` shows only where there is a pane to go to.
- **The most important keys of the whole page**, decided page by page: "the status bar holds the
  _most important_ shortcuts for the _full page_". A key that works on every page (`b`, `Ctrl+D`,
  `gg`), a second key for an action already shown (`a` beside `o`, `Enter` beside `n`), and the
  movement keys usually stay unhinted, and work.
- **A row's or a pane's keys show close to it**: "Shortcuts applying to a row or pane should be
  close to that pane". A row's show under the selected row, in its bar, each written out ("⏎ edit",
  "m move", "d delete"), not in the status line; so do the keys of what the cursor holds, under a
  block or at the end of a question's card ("a b pick", "i comment").
- **The leader menu** shows every sequence: `Space` then its groups (go, find, new, the ui, the
  panes' `Space w`, whose moves [the panes guide](panes.md#the-moves) lists), and the `g` keys. It
  is a menu of its own, not an index of every key: a page's single keys are not in it, they show in
  the status line. Its rows are buttons, and a click on `Space menu` opens it at once. A step lists
  its keys in their characters' order, where a person looks a letter up, unless its group declares
  an order of use, as `Space w` does, the pane's `…` menu's. A key none of its entries has closes
  it, as LazyVim's which-key does, does nothing else, and the status line says "`Space x` is no key
  here" for two seconds.
- **The key map**, `?` or `Space ?`, lists every key that works where the focus is, read from the
  registry: the focused pane's first, under its tab's title, then the page's and the frame's
  ("Layout"), the shell's ("Everywhere"), the leader menu's by group, and the `g` keys, keys of one
  label on one row (`j ↓ +`), with a search over the labels, the keys, and the groups. It is the
  index the leader menu is not, and runs nothing: a reference over the page, on glass over the
  dimmed page, a sheet on the phone. With the single keys off it lists only the keys that still
  work, the leader's written from `Ctrl+K`.
- **Nothing on the phone.** Keys still work with a keyboard attached, but the phone's bars show
  icons, not keys (see [the phone](phone.md)).

## Speed

Keys answer at once. A move, an edit, or a reorder shows its result immediately and writes behind it
("make everything optimistic and changes async"); a refused write puts it back and says why where it
happened. The leader menu waits a moment before showing (300 ms), so a quick sequence never flashes
it, and slides in when it does. Once shown, a menu waits for its key, a `g`'s as Space's, as
LazyVim's which-key does: it never closes under the human reading it.

## Back

`b`, and the phone's and the browser's Back, return to the previous page. What a page shows inside
itself, a search, a tab, a category of the settings, another row beside the same list, changes the
visit shown and adds none (`redirect`), so Back never walks a page's own history: from the settings,
after three categories, Back returns to where they were opened from. A page that opens another page,
a session from a list, a feature from the priorities, adds a visit (`navigate`).
