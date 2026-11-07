# The phone

Narrow screens, under 768 px. The phone gets the same product, reshaped for a thumb and one column:
not a desktop squeezed down, and not a lesser version.

## The frame

- **One column of content**, with small insets, the sidebar's own, so text has the screen's width:
  "We want less margins on phones for max readability". A round, a spec, a plan, a document, and the
  data model share that inset, 7.8 px. Their panes stay whole panes, every border drawn: "We should
  actually still have full panes on mobile, just with less padding on both sides". A pane reaches
  past the page's inset to 2 px from the screen's edges, with 3 px inside its border (`Pane`'s
  `isSnugOnPhone`), so its text starts about where the page's own text does; a pane inside another
  keeps its own room. A merged feature's record, drawn on the feature's page, has snug panes too,
  while that page's own panes, like its timeline and its sessions, keep their room. Each reading
  pane opts in: a new pane on one of these pages sets `isSnugOnPhone`. What is meant to reach the
  screen's edges, like a question's options or a band between questions, takes the inset back with
  `--page-bleed`.
- **Prose a step smaller**, 16 px rather than 19, as a chat app's messages on a phone: "slightly
  smaller text (same as discord messages on mobile)".
- **Text of more than one line takes the full width**, always, but in extremely rare cases: "On
  mobile, multi-line text should ALWAYS take up the full width". A row's icon, number, count, or
  date goes on a line of its own above the text, never in a column beside it that squeezes it.
- **A card is a head line over its text**, on home and in the sidebar (`sidebar/ItemCard.tsx`): its
  icon, its name, and its status on the head line, then its step or what it asks at the card's full
  width. A card whose step waits on the human has no ＞: the whole card is the target, and leads to
  the step, as the ＞ did. A button that leads elsewhere, the agent's at work on it, stays at the
  head line's end, the head line as tall as it.
- **The top tabs** stay in view, a terminal's tab line (`shell/Tabs.tsx`): the sidebar's toggle on
  their far left, set apart, then Home, Inbox, Priorities, Sessions, Git, a `…`, and New. Git is
  always there, the phone's way to the Git page. The `…` holds Decisions and Settings, the least
  visited places, in a popover anchored to it; while one of them is open, the `…` is the current
  tab. Nothing is filled: the current page's tab is in the accent, its icon and its count, with a
  thin line in the accent under it on the bar's bottom edge; New is a ＋ framed in the accent. A
  count is a small number after its icon, in the muted text, Home's needs-you count bold in the
  Needs you pane's colour; Git counts what waits on it, the main checkout's changes and the commits
  to pull, only while any do. Eight 44 px controls are what a 375 px phone holds, so from 375 px the
  bar never scrolls sideways; a narrower one, 360 px, scrolls it 3 px. The tabs' targets touch, as
  there is no room for Apple's or Android's spacing, and take the bar's height. The sidebar opens
  over the page, up to 400 px, animated, and holds no copy of the tabs' places, Git and New
  included: its heading, then the panes.
- **No status line**, unless the page has a bottom bar (below): keys are no help on a touch screen,
  and the counts are on the tabs.
- **The home-screen app** is the phone's main way in: the page names its icon, its name, and
  `display: standalone` (`index.html`, `public/manifest.webmanifest`), and reaches under the
  screen's rounded corners and home indicator (`viewport-fit=cover`). Every bar pads by the safe
  areas (`layout/safeArea.stylex.ts`): the tabs below the status bar, the bottom bar's tiles, a
  sheet's buttons, and the sidebar's end above the home indicator, so no control sits where the
  system takes the swipe home, and the bottom bar's glass goes on under it, as an iPhone's tab bar
  does. A page's end scrolls clear of it too.

## The bottom bar

A page with a side column on wide screens, a round, a spec, a plan, a document, a data model, a
session, and a feature, has a bottom bar on the phone (`layout/ColumnStatusLine.tsx`): one row of
icon tiles in frosted glass, as tall as the top tabs, each with a small word under its icon. Its
shape follows its count (`layout/NavBar.tsx`): one tile is a single square glass button at the
bottom right, two are a button in each corner, and three or more the bar across the screen. A button
sits inside the bar's row, so the page's end always shows above it.

What goes in it, in this order:

1. **The page's companions, as its side column has them on wide screens**: Outline, Notes, and
   Session on a round; Contents, Comments (while a review waits), and Session on a spec or a plan;
   Activity, Changes, Sub-agents (while any run, its word Agents), and the plan's progress (Plan) on
   a session; Produced and Links (while it has one) on a feature, its wide column, then its Session
   once it has one, which opens the session's page. Each opens its sheet; the open one's icon is in
   the accent. A session's bar starts with ↓, the jump to the latest, dimmed at the end, so the
   other tiles never move; its Activity and Changes each open their own sheet.
2. **At its end, the one step that moves the human forward**: Next to the next blank question,
   Verdict to the review's end, or a feature's next step, which its Next pane's button also does: "I
   know it's duplication, but it's clearer". An icon in the accent, never a filled block, even when
   it is the step that finishes the page, like Commit once every question has an answer.

A page with one main action has a bar of it alone, in the accent: the draft editor's Start, which
opens the Start pane as a sheet, the slug focused; the inbox's and the priorities' Add, which opens
their add form, as the sidebar's ＋ does. A buffer's bar holds Back and Save.

What does not go in it: sentences, keys, counts written out (a tile's label says them to screen
readers), a page's content, and anything the page already shows in reach. A tile's word is one,
under its icon, short enough to stay whole at 360 px.

It slides away as the page scrolls down, out of the reading's way, and back as it scrolls up, at the
page's top, and at its end. A jump of more than a screen, like a restored place, moves it neither
way.

## The composer

A session's composer comes after the transcript, at the page's end, above the bottom bar, in its
glass box alone, nothing drawn around it: the transcript has the whole screen while the human reads
it. Empty and unfocused, it folds to one line, its field and Send; a tap opens it, its paperclip and
actions on one line. Send is an icon, as the paperclip is, not a filled button. While it is typed
in, the page scrolls so its end, Send included, stays above the keyboard, as a question's comment
and its Save do (`layout/useAboveKeyboard.ts`): iOS scrolls only the caret into view.

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
  its field. A swipe on its top, its handle and title row, moves it: down closes it, up takes it to
  the whole screen. Over the keyboard, a sheet shorter than the screen lifts by the whole keyboard
  and shrinks to the room left under the tabs, its form scrolled to its end, so the field and its
  last button show together.
- **Menus and selectors are popovers**, as on wide screens, not sheets: a `…`'s actions, a sort, a
  category to choose ("Decision sort should just open a selector… It shouldn't be a sheet").
- **Pages for anything read**: a proposal file, a session, a spec.

## Pages

- **A round**: a question's header sticks below the tabs while its card is on screen, but lets go
  while its comment is typed in, so the room the keyboard leaves goes to the text.
- **A review**: the comment's sheet quotes no block: the block shows, marked, right above it.
- **The priorities**: one column, the list, until the human picks the columns on the phone.

## Flows

Flows are linear on the phone: one step, then the next, focused. A New page's kind picked moves the
focus to its composer, its send button in view: "new -> pick -> composer".

## Touch

- Every target is a thumb's size, 44 px at least. A one-line field is 44 px tall on a touch screen,
  frame included, as Astryx's controls there, its text in its middle (`fields/editor/theme.ts`).
- Every keyboard action has a tap: a row's bar, a tile, a sheet.
- Dragging works on touch after a long press, nesting included.
- Keys still work with a keyboard attached; nothing hints them.
