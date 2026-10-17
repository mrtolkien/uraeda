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

- A view's spec MUST say why its layout reads best, and what it shows at both width classes, with
  mockups of both. Checked by review.
- The UI MUST have two width classes, split at the theme's `md` breakpoint, 768 px, which components
  read from the shared hook or theme, never their own media queries. Checked by review.
- On narrow screens, a view MUST open as its own page, and menus and short forms as bottom sheets;
  on wide screens, they MUST be popovers and dialogs. Checked by the browser tests.
- A column that takes room from a view's main content MUST be foldable and resizable, keeping its
  state in the browser. Checked by the browser tests.
- An open detail, tab, or sheet MUST be in the URL, so a reload, Back, or a change of width keeps
  it. Checked by the UI tests.
- Body text MUST be 17 px on narrow screens and 19 px from 1024 px wide, and controls at least 44 px
  tall under a coarse pointer. Checked by the browser tests.
- Reading text MUST stay left-aligned, never justified, and no wider than about 120 characters.
  Checked by the browser tests.
- On wide screens, a detail glanced at from a list SHOULD open in a pane beside it, and a view the
  human follows, like a session, SHOULD be a page of its own. Checked by review.
- The sidebar SHOULD show each feature and change as a short, visual card, and MUST fold to a rail
  on wide screens and give each card its full words as its accessible name. Checked by the UI tests.

## Why

The desktop showed the phone's layout, and the human zoomed it to 120% to read it
([text size](../done/2026-10-12-ui-improvements.md#q5-how-large-should-text-be-on-desktop)). An
agent's session, squeezed into a pane beside its list, was too narrow to follow. The human then
asked for concepts over hard rules: "Goal #1 is always readability and clarity for the user"
([the session view's review](../done/2026-10-14-session-view.md#changes-after-approval)). The
sidebar's rows of sub-agents and tasks were hard to read, so it became "small and visual more than
textual"
([the sidebar's rows](../done/2026-10-16-redesign-interface.md#q4-how-does-a-features-step-show-on-its-row-before-implementation)).

## Alternatives considered

- A column near 70 characters: it left most of a desktop empty and read too slim.
- CSS `zoom` on desktop: it breaks dragging's position math.
- Justified paragraphs: rivers on the phone's narrow lines.
- Every detail in a pane on wide screens: an agent's session became too narrow to follow.

## Consequences

- Each view is designed, mocked up, and checked at two widths.
- Tablets between 768 and 1024 px get the wide layout with phone-sized text.
- A renamed feature reads by its new name in the sidebar only: addresses, branches, and commits keep
  its slug.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
