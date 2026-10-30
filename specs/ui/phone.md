# The phone

Narrow screens, under 768 px. The phone gets the same product, reshaped for a thumb and one column:
not a desktop squeezed down, and not a lesser version.

## The frame

- **One column of content**, with small insets, the sidebar's own, so text has the screen's width:
  "We want less margins on phones for max readability". A round, a spec, a plan, a document, and the
  data model share that inset, 7.8 px. A document's panes, a round's, a spec's, keep only their
  titled top border on the phone (`Pane`'s `isOpenOnPhone`), their text reaching the insets; a pane
  inside another keeps its borders. What is meant to reach the screen's edges, like a question's
  options or a band between questions, takes the inset back with `--page-bleed`.
- **Text of more than one line takes the full width**, always, but in extremely rare cases: "On
  mobile, multi-line text should ALWAYS take up the full width". A row's icon, number, count, or
  date goes on a line of its own above the text, never in a column beside it that squeezes it.
- **The top tabs** stay in view: the sidebar's toggle on their far left, set apart, then Home (with
  the Needs-you count on its icon), Inbox, Priorities, Sessions, Commit while something waits for
  one, a `…`, and New (`shell/Tabs.tsx`). The `…` holds Decisions and Settings, the least visited
  places, in a popover anchored to it; while one of them is open, the `…` is the current tab. Eight
  44 px controls are what a 375 px phone holds, so from 375 px the bar never scrolls sideways,
  Commit showing or not; a narrower one, 360 px, scrolls it 3 px. The sidebar opens over the page,
  up to 400 px, animated, and holds no copy of the tabs' places.
- **No status line**, unless the page has a bottom bar (below): keys are no help on a touch screen,
  and the counts are on the tabs.

## The bottom bar

A page with a side column on wide screens, a round, a spec, a plan, a document, a data model, a
session, and a feature, has a bottom bar on the phone (`layout/ColumnStatusLine.tsx`): one row of
icon tiles in frosted glass, as tall as the top tabs. Its shape follows its count
(`layout/NavBar.tsx`): one tile is a single square glass button at the bottom right, two are a
button in each corner, and three or more the bar across the screen. A button's top is where the
bar's would be, so the page's end always shows above it.

What goes in it, in this order:

1. **The page's companions, as its side column has them on wide screens**: Outline, Notes, and
   Session on a round; Contents, Comments (while a review waits), and Session on a spec or a plan;
   Activity, Changes, Sub-agents (while any run), and the plan's progress on a session; Produced and
   Links (while it has one) on a feature, its wide column, then its Session once it has one, which
   opens the session's page. Each opens its sheet; the open one's icon is in the accent. A session's
   bar starts with ↓, the jump to the latest, dimmed at the end, so the other tiles never move; its
   Activity and Changes each open their own sheet.
2. **At its end, the one step that moves the human forward**: Next to the next blank question,
   Verdict to the review's end, or a feature's next step, which its Next pane's button also does: "I
   know it's duplication, but it's clearer". An icon in the accent, never a filled block, even when
   it is the step that finishes the page, like Submit once every question has an answer.

A page with one main action has a bar of it alone, in the accent: the draft editor's Start, which
opens the Start pane as a sheet, the slug focused; the inbox's and the priorities' Add, which opens
their add form, as the sidebar's ＋ does. The commit page has two, while changes wait: Discard on
the left, which asks first, and Commit, a save icon, in the accent on the right; the page's own
buttons leave it.

What does not go in it: words, keys, counts written out (a tile's label says them to screen
readers), a page's content, and anything the page already shows in reach.

It slides away as the page scrolls down, out of the reading's way, and back as it scrolls up, at the
page's top, and at its end. A jump of more than a screen, like a restored place, moves it neither
way.

## The composer

A session's composer floats over the transcript on the glass of the bar under it, its box alone,
nothing drawn around it, and it follows the bar down as the bar slides away. Empty and unfocused, it
folds to one line, its field and Send; a tap opens it, its paperclip and actions on one line. Send
is an icon, as the paperclip is, not a filled button.

## The decisions page

No pane: the list is the page, "Jump to…" and "Ask" (Review with AI) on one line. What is open is a
page of its own, without a border, its bottom bar holding the list, back to the decisions, and on a
decision the previous and the next one. The constitution, read top to bottom, has no steps.

## A row's actions

When a row is selected, its actions float at the bottom as a glass bar of big icons over short
words, above the keyboard when it is open (`lists/RowBar.tsx`). It sinks away when the page scrolls,
and a tap on a row brings it back. It covers the bottom bar while it shows.

Its tiles are a finger wide at least, 3.5 rem, with a small step of room beside each word, so five
actions, a row's most, fit a 360 px phone on one line in every bundled font. Where a font leaves too
little room, a word ends in an ellipsis inside its tile: the bar never runs past the screen, and
never wraps.

## Layers

- **Sheets, not dialogs**: pickers, short forms, confirmations, and the side column's tabs rise from
  the bottom as sheets, each in the address, so Back closes it. They are one sheet
  (`layout/Sheet.tsx`), whatever it holds: its title on top, a Close, in frosted glass ("make them
  all 3 the same component"). A side column's sheet, the session's Activity or Changes, draws its
  title in its content, which scrolls it away, and its Close alone stays. It opens with the focus in
  its field, and a drag up on its top takes it to the whole screen.
- **Menus and selectors are popovers**, as on wide screens, not sheets: a `…`'s actions, a sort, a
  category to choose ("Decision sort should just open a selector… It shouldn't be a sheet").
- **Pages for anything read**: a proposal file, a session, a spec.

## Flows

Flows are linear on the phone: one step, then the next, focused. A New page's kind picked moves the
focus to its composer, its send button in view: "new -> pick -> composer".

## Touch

- Every target is a thumb's size, 44 px at least.
- Every keyboard action has a tap: a row's bar, a tile, a sheet.
- Dragging works on touch after a long press, nesting included.
- Keys still work with a keyboard attached; nothing hints them.
