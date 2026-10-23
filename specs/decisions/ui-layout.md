---
status: proposed
approved-by:
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

## Why

The desktop showed the phone's layout, and the human zoomed it to 120% to read it
([text size](../done/2026-10-12-ui-improvements.md#q5-how-large-should-text-be-on-desktop)). An
agent's session, squeezed into a pane beside its list, was too narrow to follow. The human then
asked for concepts over hard rules: "Goal #1 is always readability and clarity for the user"
([the session view's review](../done/2026-10-14-session-view.md#changes-after-approval)). The
sidebar's rows of sub-agents and tasks were hard to read, so it became "small and visual more than
textual"
([the sidebar's rows](../done/2026-10-16-redesign-interface.md#q4-how-does-a-features-step-show-on-its-row-before-implementation)).
Half a screen, where the human often works, got the desktop's layout and broke: the human asked for
a middle class, wide enough to hold their 1205 px half screen
([width classes](../2026-10-20-layout-look/clarifications-01.md#q5-should-the-ui-get-a-third-width-class-for-half-screens)).

## Alternatives considered

- A column near 70 characters: it left most of a desktop empty and read too slim.
- CSS `zoom` on desktop: it breaks dragging's position math.
- Justified paragraphs: rivers on the phone's narrow lines.
- Every detail in a pane on wide screens: an agent's session became too narrow to follow.
- Two width classes, switching at 768 px: half a screen got the desktop's layout, and broke.
- Panes that adapt to their own width, with container queries: no class to test, but each pane
  tested alone.

## Consequences

- Each view is designed, mocked up, and checked at three widths.
- A renamed feature reads by its new name in the sidebar only: addresses, branches, and commits keep
  its slug.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
