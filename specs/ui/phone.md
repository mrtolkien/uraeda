# The phone

Narrow screens, under 768 px. The phone gets the same product, reshaped for a thumb and one column:
not a desktop squeezed down, and not a lesser version.

## The frame

- **One column of content**, with small insets, the sidebar's own, so text has the screen's width. A
  document's panes, a round's, a spec's, keep only their titled top border on the phone (`Pane`'s
  `isOpenOnPhone`), their text reaching the insets; a pane inside another keeps its borders. What is
  meant to reach the screen's edges, like a question's options or a band between questions, takes
  the inset back with `--page-bleed`.
- **The top tabs** stay in view: the sidebar's toggle on their far left, set apart, then Home (with
  the Needs-you count on its icon), and the other places. The sidebar opens over the page, up to 400
  px, animated, and holds no copy of the tabs' places.
- **No status line**, unless the page has a bottom bar (below): keys are no help on a touch screen,
  and the counts are on the tabs.

## The bottom bar

A page with a side column on wide screens, a round, a spec, a plan, a document, a data model, and a
session, has a bottom bar on the phone (`layout/ColumnStatusLine.tsx`): one row of icon tiles in
frosted glass, as tall as the top tabs.

What goes in it, in this order:

1. **The page's companions, as its side column has them on wide screens**: Outline, Notes, and
   Session on a round; Contents, Comments (while a review waits), and Session on a spec or a plan;
   Activity, Changes, Sub-agents (while any run), and the plan's progress on a session. Each opens
   its sheet; the open one's icon is in the accent.
2. **At its end, the one step that moves the human forward**: Next to the next blank question, or
   Verdict to the review's end. A help, in the accent's colour, not a filled block, unless it is the
   step that finishes the page, like Submit once every question has an answer.

What does not go in it: words, keys, counts written out (a tile's label says them to screen
readers), a page's content, and anything the page already shows in reach.

It slides away as the page scrolls down, out of the reading's way, and back as it scrolls up, at the
page's top, and at its end. A jump of more than a screen, like a restored place, moves it neither
way.

## A row's actions

When a row is selected, its actions float at the bottom as a glass bar of big icons over short
words, above the keyboard when it is open. It sinks away when the page scrolls, and a tap on a row
brings it back. It covers the bottom bar while it shows.

## Layers

- **Sheets, not dialogs or popovers**: menus, pickers, short forms, confirmations, and the side
  column's tabs rise from the bottom as sheets, each in the address, so Back closes it.
- **Pages for anything read**: a draft, a session, a spec.

## Flows

Flows are linear on the phone: one step, then the next, focused. A New page's kind picked moves the
focus to its composer, its send button in view: "new -> pick -> composer".

## Touch

- Every target is a thumb's size, 44 px at least.
- Every keyboard action has a tap: a row's bar, a tile, a sheet.
- Dragging works on touch after a long press, nesting included.
- Keys still work with a keyboard attached; nothing hints them.
