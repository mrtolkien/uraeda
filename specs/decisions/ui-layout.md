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
  the theme and never per-view media queries. Checked by the browser tests, at each class.
- On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and
  dialogs. Checked by the browser tests.
- Text MUST stay readable at each width without zoom, and controls MUST be easy to hit by touch.
  Checked by the browser tests.
- An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change keeps it.
  Checked by the UI tests.
- A column that takes room from the main content SHOULD be foldable and resizable. Checked by the
  browser tests.
- A detail glanced at from a list SHOULD open in a pane beside it, and a view the human follows
  SHOULD be a page of its own. Checked by review.
- A feature's session MAY open beside any of the feature's documents, in the right column, at least
  400 px wide; everywhere else it stays a page of its own. Checked by the browser tests.

## Why

Readability comes first, and what reads best depends on the room a view has, not on the device: a
desktop window at half a screen and a tablet can have the same width. Three width classes cover the
shapes that read differently: the phone's one column, a half screen of about 1200 px, where the
sidebar folds to a rail to leave the content its room, and a full desktop. A theme that sets them
once keeps every view on the same classes, where per-view media queries would drift apart.

Text sized for the desktop and touch-sized controls let the human read and act without zooming. On a
phone, a popover or a dialog covers most of the screen and is hard to dismiss, so a page or a sheet
reads better; on a wide screen, the same detail fits beside what it came from. What is open lives in
the address, so the human finds it again after a reload, Back, or turning the screen.

A detail glanced at keeps its list in view beside it. A view followed for a while, like an agent's
session, needs a page's width to read. The one exception is a feature's session beside its own
documents: asking the agent about a question or a point should not take the human away from the
document they answer or review. At 400 px and wider, the session is still easy to follow. A column
that takes room from the main content can be folded and resized, so the human decides how much room
it takes.

Each spec shows its layout at each width class, because a layout is judged by seeing it.

## Alternatives considered

- A column near 70 characters: it left most of a desktop empty and read too slim.
- CSS `zoom` on desktop: it breaks dragging's position math.
- Justified paragraphs: rivers on the phone's narrow lines.
- Every detail in a pane on wide screens: an agent's session became too narrow to follow.
- A session beside a round of questions only: each later document page would have asked again.
- Two width classes, switching at 768 px: half a screen got the desktop's layout, and broke.
- Panes that adapt to their own width, with container queries: no class to test, but each pane
  tested alone.

## Consequences

- Each view is designed, mocked up, and checked at three widths.
- The questions, spec, and plan pages share one right column, where the session sits as a tab.
- A renamed feature reads by its new name in the sidebar only: addresses, branches, and commits keep
  its slug.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
