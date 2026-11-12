---
status: active
approved-by: mrtolkien
icon: layout-panel-left
---

# UI layout

Every layout choice in the app serves one goal first: the human reads and understands what is on
screen. The UI adapts to the window's width, in three width classes, not to the device, and each
view takes the shape and the width that read best for what it holds. The rules below give way to
that goal when a view's spec says why.

## Rules

- A view's spec MUST say why its layout reads best, with mockups at each width class.
- The UI MUST adapt to three width classes, narrow, semi-wide, and wide, and size every page and
  pane from one short scale of named widths, picked by what it holds, both set once in the theme,
  never by a view.
- On narrow screens, views MUST be pages, and pickers, short forms, and confirmations rise as sheets
  from the bottom.
- A selector or a menu opened from a control MUST stay a popover anchored to it, at every width.
- Text MUST stay readable at each width without zoom, with controls easy to hit by touch.
- An open detail, tab, or sheet MUST be in the address, so reload, Back, or a width change keeps it.
- Prose SHOULD hold about 80 characters a line, even where its page is wider.
- A column that takes room from the main content SHOULD be foldable and resizable.
- A view the human follows, such as a session, SHOULD be a page of its own.
- A feature's session MAY open beside the feature's documents, in a right column wide enough to
  follow.

## Why

What reads best depends on the room a view has, not the device: half a desktop screen and a tablet
can share a width. Three classes cover the shapes that read differently. On a phone, a dialog covers
the screen and is hard to dismiss, while a short choice reads best beside its control. Lines much
longer than 80 characters are hard to follow. Pages sized one by one drifted apart: one scale keeps
every edge where the eye expects it. History: [Panes size](../done/2026-10-30-panes-size.md).

## Alternatives considered

- Two width classes: half a screen got the desktop's layout, and broke.
- Every detail in a pane on wide screens: an agent's session became too narrow to follow.
- Menus and selectors as sheets on the phone: a short choice rose as a layer over the whole page.
- Each pane fitting its own content: the panes of one page ended at different edges.

## Consequences

- Each view is designed, mocked up, and reviewed at three widths.
- A part whose room depends on a resizable column measures it, and is checked at the widths where it
  switches.
- The questions, spec, and plan pages share one right column, where the session sits as a tab.
- A view that needs a width the scale lacks adds it to the scale, with the human's approval.

## Applies to

- [`app/`](/app/), and every feature that adds or changes a view
