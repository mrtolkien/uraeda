# Open questions

Where the direction is not settled, or where the code does not follow these guides yet. Each is the
human's to answer; once answered, its rule moves into the guide it belongs to, and the item goes.

## The decisions to amend

- **Glass in the look.** [UI look](../decisions/ui-look.md) lists "glass" among the directions not
  picked, while the phone's floating bars are now frosted glass. Should the decision name glass as
  the look of what floats over the page, and nothing else?
- **Panes on the phone.** UI look makes bordered panes a must; on the phone, a document's panes keep
  only their titled top border, so their text has the screen's width. Should the decision say so?
- **A list's detail.** [UI layout](../decisions/ui-layout.md) says a detail glanced at from a list
  SHOULD open in a pane beside it. The decisions page does; the priorities' side pane was removed
  for editing in place and the detail dialog. Should the rule say when each fits?
- **Line length.** UI layout rejected "a column near 70 characters" for the page, while prose now
  aims at about 80 characters inside a wider page. Should the decision say both: a wide page, and
  prose at about 80 characters inside it? The theme's general reading measure, 86 of the UI's
  characters, holds more than that: should it come down to the round's 75?

## The direction

- **The leader menu and a page's keys.** The leader menu lists every sequence, but not a page's own
  single keys (`v`, `c`, `p`, `o`), which only the status line shows, and nothing on the phone.
  Should the menu have a group for the page's own keys, so that it is the index of everything?
- **Glass on wide screens.** Would a wide surface gain from the phone's glass? The leader menu,
  which already floats in the bottom right over the page, is the one candidate; the status line
  holds no page's controls on wide screens, so glass would only restyle it.
- **The bottom bar on more phone pages.** The round, the spec family, and the session page have one.
  The feature page has a column (Produced, Links) drawn inline on the phone, and could get tiles for
  them, its Session, and its next step. Pages with one main action, the draft editor's Start, the
  inbox's and the priorities' Add, the commit page's Commit, could end a bar with it. Which pages
  get a bar?
- **Submit's tile.** Next is an accent icon on the glass; Submit, once every question has an answer,
  is still a filled accent block. Should it be an icon too, or keep its fill as the page's real
  action?
- **Which keys show as hints.** The rule in [Keyboard](keyboard.md#what-shows-the-keys), keys that
  work everywhere and second keys stay unhinted, is read from the requests, not stated. Is it right?
- **A confirmation's keys.** The shared confirmation's `y` and `n` work even with the single-key
  shortcuts switched off; the category's delete follows the switch. Which is right?
- **Helper text.** "Remove the slop" was said of page subtitles. Does it reach placeholders and a
  field's help, like the slug's?
- **Sub-agents' colour.** Maroon reads close to red, the colour of what is wrong. Keep it, or move
  to another, like teal?
- **Hover.** The rail unfolds on hover, and hover moves a list's selection. Is hover fine as an
  extra everywhere, as long as it is never the only way?
- **Home.** "Leave the home as it is now, we'll review it later": a richer home, and the Needs-you
  cards it shares with the sidebar, are still open.
- **Settings and sign-in** were not gone over: they follow these guides' general rules, but no
  request shaped them.

## Coherence: where the code drifts

Found in a pass over every surface. The ones marked done were fixed in that pass.

- Done: the session page's phone bar uses the bottom bar's tiles, as the round's and the spec's do.
- Done: the repository picker opens as one dialog on wide screens, whether clicked or opened by
  `Space r`; it opened as a popover on a click.
- Done: a category's delete is drawn as the shared confirmation, though it asks three ways.
- Done: the phone's row actions show the focus ring; a story's scenarios and an answer under a
  review comment read in the reading font.
- Done: the picked row's look and the ring around a whole card are one shared style each
  (`layout/picked.ts`), and the band between parts one component (`layout/Band.tsx`).
- **The category's delete asks in its own dialog**, with its own keys. Merge it into `Confirm`, with
  a third answer?
- **Moving an item uses three controls**: a segmented control for a priority's section, a selector
  for a new note's category, and a picker (`c`) to move a note. The priorities have no `c`. One
  picker for all of them?
- **Sheets come in three forms**: the overlay's, with a title and Close; the picker's, bare; and
  Astryx's menu sheet. One form?
- **The phone's Review sheet repeats the verdict's buttons**, which the Verdict tile reaches at the
  page's end. Keep both?
- **`…` menus remain** on a category's pane, and on a session's and a feature's header. Are they the
  last resort the guides allow, or should their actions move to the page's keys and the page?
- **Counts are drawn four ways**: a pane's `· N`, a group's title, a badge, and plain text.
- **The spec page's phone inset is tighter** than the plan's, the document's, and the data model's,
  which share its column and bar.

## Coherence: code to merge, with no visible change

- The bottom bar's tile and the row bar's tile are the same glass button, and the two hide-on-scroll
  hooks count the same 8 px: one tile, one hook.
- A bare button's reset is copied in several places; the two "after the sheet closes" helpers do the
  same job two ways; key caps are drawn three ways; the new, changed, and removed colours are mapped
  twice; a count with its word read out is written twice; a session's Rename and Archive are built
  twice; the column's rail is drawn twice.
- The sessions page writes the picked card's look as CSS, since it styles the sidebar's own cards
  from outside.

## Astryx gaps to approve

The [UI components](../decisions/ui-components.md) decision lets a raw element stand in for a
missing Astryx component, with its reason, once it is listed as an Astryx gap. The lint pass found
these raw elements, each now marked with its reason, for the human to approve or to replace:

- `layout/NavBar.tsx`: the bottom bar's tile, an icon alone, flat, stretched to share the bar.
- `lists/RowBar.tsx`: the phone's row-action tile, a big icon over its word on the glass; and the
  wide row bar's action, drawn as the row's supporting text.
- `shell/StatusLine.tsx`: a hint, and the "need you" count, each pressed as text of the line.
- `keys/LeaderMenu.tsx`: a menu row, and the footer's back and close keys, drawn as the menu's text.
- `lists/OutlineEditor.tsx`: the row's field, a `textarea` in the row's own font, with no frame,
  growing with its text.

## Left behind

- The sidebar's cards still receive their `…` menu's actions (`actions`, `onSettings`), which they
  no longer draw since the `…` went.
- The status line's slot for a page's controls is only filled on the phone; its code for wide
  screens, and `useCountsFit`, no longer have a use.
- The spec's view still reads its architecture's units and tradeoffs, which the page no longer draws
  apart; `hasVerdict` is never false; several comments still describe the Review tab, the `…` menus,
  and a phone with no status line.
