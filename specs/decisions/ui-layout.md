---
status: active
approved-by: mrtolkien
icon: layout-panel-left
---

# UI layout

Every layout choice in the web UI serves one goal first: the human reads and understands what is on
screen. The UI adapts to the screen's width, not to the device, and each view takes the shape that
reads best for what it is for. The rules below serve that goal, and give way to it when a view's
spec says why.

## Rules

- A view's spec MUST say why its layout reads best, with mockups at each width class. Checked by
  review.
- The UI MUST adapt to three width classes, narrow, semi-wide, and wide, not to the device, through
  the theme and never per-view media queries. Checked by review.
- On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and
  dialogs. Checked by review.
- Text MUST stay readable at each width without zoom, and controls MUST be easy to hit by touch.
  Checked by review.
- An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change keeps it.
  Checked by review.
- Prose SHOULD hold about 80 characters a line, even where its page is wider. Checked by review.
- A column that takes room from the main content SHOULD be foldable and resizable. Checked by
  review.
- A view the human follows SHOULD be a page of its own. Checked by review.
- A feature's session MAY open beside any of the feature's documents, in the right column, wide
  enough to follow; everywhere else it stays a page of its own. Checked by review.

## Why

Readability comes first, and what reads best depends on the room a view has, not on the device: a
desktop window at half a screen and a tablet can have the same width. Three width classes cover the
shapes that read differently: the phone's one column, a half screen, where the sidebar folds to a
rail to leave the content its room, and a full desktop. A theme that sets them once keeps every view
on the same classes, where per-view media queries would drift apart.

Text sized for the desktop and touch-sized controls let the human read and act without zooming.
Lines of prose much longer than 80 characters are hard to follow from one line to the next, while a
page may be wider, to hold panes and columns beside its text. On a phone, a popover or a dialog
covers most of the screen and is hard to dismiss, so a page or a sheet reads better. What is open
lives in the address, so the human finds it again after a reload, Back, or turning the screen.

A view followed for a while, like an agent's session, needs a page's width to read. The one
exception is a feature's session beside its own documents: asking the agent about a question or a
point should not take the human away from the document they answer or review. In a column wide
enough, the session is still easy to follow. A column that takes room from the main content can be
folded and resized, so the human decides how much room it takes.

Each spec shows its layout at each width class, because a layout is judged by seeing it.

## Alternatives considered

- A whole page near 70 characters wide: it left most of a desktop empty and read too slim.
- A detail opened from a list always in a pane beside it: too rigid, since a list edited in place,
  or a detail read in a dialog, can read better.
- CSS `zoom` on desktop: it breaks dragging's position math.
- Justified paragraphs: rivers on the phone's narrow lines.
- Every detail in a pane on wide screens: an agent's session became too narrow to follow.
- A session beside a round of questions only: each later document page would have asked again.
- Two width classes: half a screen got the desktop's layout, and broke.
- Panes that adapt to their own width, with container queries: no class to test, but each pane
  tested alone.

## Consequences

- Each view is designed, mocked up, and reviewed at three widths.
- The questions, spec, and plan pages share one right column, where the session sits as a tab.
- A renamed feature reads by its new name in the sidebar only: addresses, branches, and commits keep
  its slug.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
