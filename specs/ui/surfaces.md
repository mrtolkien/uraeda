# Surfaces

Where a thing goes on screen decides how it reads and how it is reached. Each surface below has one
job. Before adding a control, find the surface whose job it is; if none fits, the view is probably
asking the human for something it should not.

## At a glance

| The human wants to…                                | Surface                                     | Not                                    |
| -------------------------------------------------- | ------------------------------------------- | -------------------------------------- |
| Change a word, a line, a row                       | In place                                    | A dialog with a text field             |
| Act on one row: edit, move, delete, open, promote  | The row's bar                               | A `…` menu, icons over the text, hover |
| Read a row's whole text, longer than the row holds | The detail dialog, on the row's address     | A side pane, a hover card              |
| Read an item of a list for a while                 | The list beside its reader (the decisions)  | A dialog                               |
| Go anywhere, find anything, start anything         | The leader menu, the `g` keys, a picker     | A page's own menu                      |
| Choose one of many: a place, a target, a thing     | A picker                                    | A dropdown of the page                 |
| Find which key does what, here                     | The key map, `?`                            | A help page, a list in the leader menu |
| Confirm what cannot be undone                      | The shared confirmation                     | A second, page-made dialog             |
| Take back what was just done                       | The undo toast, or `u`                      | A confirmation before each write       |
| See a commit still landing                         | The commit toast                            | A spinner on its button, a top bar     |
| Answer one short question at a decision point      | A dialog with one field                     | A page                                 |
| Read or work in something for a while              | A page                                      | An overlay                             |
| Keep a document's companions at hand               | The side column (wide), sheets (the phone)  | A popover                              |
| Know what needs them, and go there                 | The sidebar, home, the status line's counts | A toast                                |
| On the phone, reach the page's companions          | The bottom bar                              | The top tabs                           |

## In place

The default. A row is edited where it is (`i`, or a click on the selected row), a category is
renamed in its own title, a comment is written under the block it is about. A one-line field saves
on `Enter` or its button, and leaving it keeps it open with its text; a field of several lines saves
on `Ctrl+Enter` or its button; `Escape` drops the change, asking first when there is one. Lists that
nest are outlines: a row's field also saves what changed as it is left, `Enter` after a row opens
the next one, `Tab` and `Shift+Tab` indent and outdent, a row with its children moves as one. "Not
really elegant to type a text with bullet points inside a multiline in a modal. What if children
were just treated like priorities themselves? Something behaving like an Outliner."

## The row's bar

The actions of the selected row, under it, each with its key written out: "⏎ edit", "m move", "d
delete". It shows when a row is selected, by keys or by a click, and while its field is edited,
never on hover alone. In move mode the row's bar shows the move keys instead, and the row's border
changes, so the mode is visible where it acts. On the phone the same actions float at the screen's
bottom as big icons on glass (see [the phone](phone.md)).

The row's bar replaced the rows' `…` menus, icons drawn over the row's text, and a right-click menu:
"The `...` are weird af." A `…` menu is the last resort, and never inside a card or a pane: only a
page's header holds one, a session's and a feature's.

## A list's detail

A row shows two or three lines. Its whole text, a proposal's or a note's, opens in the detail dialog
(`pane/DetailOverlay.tsx`), 108 characters wide, on the row's own address, over the list, which
keeps its selection and its scroll; a row with a file opens the file's page instead. Where reading
an item is the page's job, the decisions page draws the list beside the item it reads, as the
[UI layout](../decisions/ui-layout.md) decision asks. The priorities' side pane, and a hover card
that followed the selection, were tried and removed.

## The leader menu and the `g` keys

`Space` opens the index of every sequence: the places, the finds, what can be started, and the ui's
own keys, in mnemonic groups, the same menu on every page, its rows clickable. The `g` keys go to
the same places without the menu. A page's single keys are not in it: they show in the status line.
A page does not build its own menu of actions.

## Pickers

A picker chooses one thing among many: a place, a category, where a note is promoted, a repository,
or anything at all (`Space Space`). It is `keys/KeyPicker.tsx`'s dialog on wide screens and a sheet
on the phone: it opens with its filter focused, the arrows move through it, `Enter` picks, and the
human lands on the result. Its rows show a thing as the sidebar's card does, its icon and its state.
When picking moves something, the picker shows where it lands, by level first ("Show the priority
levels first").

## Dialogs

Two jobs only:

- **Confirming what cannot be undone**, through the one shared confirmation (`fields/Confirm.tsx`),
  answered by `y` or `n`, its focus on Cancel: deleting, discarding uncommitted changes, dropping
  typed text. "Make sure every cancel modal uses the same window." A question with more than two
  answers, like deleting a category that holds notes, is the same confirmation with one more answer
  and its key. A delete that takes a file with it says so: `d` on a note with a note file asks
  "Delete this note and its note file?", naming the file.
- **One short question at a decision point**: a single field, with a suggestion at most, like a new
  feature's slug after `Ctrl+Enter`, or a quick note.

A dialog closes by Escape, Close, or Back; the quick note also by a click outside it. A dialog never
holds a view of its own to read: "Remove the 'view' option and the view modal. Why does it even
exist?" A proposal file opens its page, not an overlay. On the phone a dialog is a sheet.

## Undo

A write the human may regret, but that needs no question first, like a note promoted out of the
inbox or an empty category deleted, shows a toast with Undo for 5 seconds
(`layout/useUndoToast.ts`); `u` presses the newest one's Undo. A note of the inbox deleted with `d`
gets one too, after its question: Undo puts back the note and the note file that went with it.
Committing clears them. A toast is for this, for a confirmation from another page, and for the git
writes still landing, never for an error alone, which stays next to what it concerns.

## The commit toast

A git write shows its result at once and takes the human where it leads: the files are written when
its call answers, and its commit lands behind it, with the hooks, in the server's queue of the
repository. The commit toast (`writes/CommitToast.tsx`) lists what is still landing, the running
write first, then the ones waiting their turn, each named as its button would say it ("Approving the
spec of Performance pass"). Nothing waits for it and no button is blocked: "we don't have to 'lie'
to the user", and the toast is the truth of what is not in git yet. Every tab shows the same toast,
and a reload brings it back, as it reads the server's queue.

It sits where the leader menu rises, at the bottom right over the status line, in the same frosted
glass, square; the open menu covers it. On the phone, it sits over the bottom bar, across the
screen's width, and follows the bar down as it slides away.

A write a hook refused is undone where it happened: the page shows what it showed before, and the
hook's output in a banner at that place (`writes/RefusedHere.tsx`), the verdict's place of a review,
a round's end, the editor's Commit. The toast keeps it too, with Open, which goes to that place, and
Dismiss, which takes it out of every tab. Writing at that place again deals with it. The queue goes
on past a refusal: the next writes land, or are refused, each alone.

## Pages

Anything the human reads or works in for a while is a page, with its own address: a proposal file, a
round, a spec, a session, the commit. "Committing is its own dedicated view/flow." Back returns to
where they were.

## The side column

On wide and semi-wide screens, a document page (a round, a spec, a plan) and a session have a column
on their right with their companions as tabs: a round's Outline, Notes, and Session; a spec's
Contents and Session; a session's Activity and Sub-agents. It keeps its tab in the address, folds
with `]` on wide screens, and never holds what the human must read or act on to finish the page:
"Remove the Review pane in the sidebar, it's pointless": the review's comments and verdict are at
the page's end.

## The sidebar

The left column, the shell's, is global: the repository, what needs the human, what is in progress,
the running sessions, the usage, and Commit while changes wait. Folded to a rail, it unfolds over
the page on hover or on `[`, without moving anything ("NOTHING SHOULD CHANGE PLACES"). It is not a
page's place for its own controls.

## The status line

The bottom line of wide and semi-wide screens: the page's key hints and the counts of what needs the
human and what runs. It holds no content. It has a slot for a page's own controls, which only the
phone's bar uses today.

## A session

- **The agent's reply is set apart**: a done turn's last text, after its last call, is a square card
  on a raised surface; on the phone, a rule above and below it alone, its text at the screen's
  width. The texts between its calls are context, in the secondary colour: "The in-turn responses
  are interesting context but not actual info."
- **The agent's text is at the reading measure**, about 80 characters a line, not the page's width.
- **The human's sent messages** are on a faint blue, in their own font (Radon).
- **Jump to the latest** goes to the start of the agent's last message, where its reply reads from;
  while the session works, to its end, following it. On wide screens, a small arrow over the
  composer's top; on the phone, the bottom bar's ↓ alone.
- **An Activity row** is a head line, its kind's icon, a check or a cross, and how long it ran, over
  what it acted on, across the row's whole width, three lines at most, cut in its middle around
  `[...]`, which shows it whole. A divider sets steps apart. Opened, a row scrolls to its start.
- **Changes** sits under the Activity on wide screens, resized from the rule between them.

## The bottom bar, on the phone

The phone's version of the side column: one row of icon tiles in frosted glass, a page's companions
as its side column has them, each opening a sheet, then at its end the one help that moves the human
forward, Next or Verdict, in the accent. It is drawn by the pages with a side column, through
`layout/ColumnStatusLine.tsx`, and slides away as the page scrolls down and back as it scrolls up.
One or two tiles are glass buttons in the corners instead of a bar. See [the phone](phone.md) for
what goes in it.

## Sheets

On the phone, what a dialog, a picker, or a side column's tab would be on a wide screen rises from
the bottom as a sheet. A menu or a selector is not a sheet: it stays a popover, as on a wide screen.
A side column's sheet keeps its tab in the address, so a reload opens it again; every other overlay
is an entry of the history, so Back closes it.

## Never

- **Hover as the only way.** Hover brightens, moves the selection, and unfolds the rail; nothing is
  reachable only by hovering.
- **A toast for an error.** An error stays next to what it concerns until dealt with.
- **A popover of content.** Menus and selectors are popovers at every width; reading content never
  is. One exception: a note's images show under its row, over the page, while the row is hovered or
  selected.
