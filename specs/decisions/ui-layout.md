---
status: proposed
approved-by:
---

# UI layout

The web UI has two layouts, split at Astryx's 768 px: on the phone, details are pages and menus and
short forms are sheets; on wide screens, a detail opens in a pane beside its list, menus are
popovers, and short forms are dialogs. Text is 17 px on the phone and 19 px on a desktop, with
controls grown to match, in a reading column near 70 characters, left-aligned.

## Rules

- The UI MUST have two width classes: narrow, under 768 px, and wide, from 768 px, taken from the
  theme's `md` breakpoint. A layout MUST be chosen by width, never by device type, user agent, or
  pointer.
- Components MUST NOT write their own media queries with sizes. They read the width class from one
  shared hook, or the theme's adaptations.
- On wide screens, a detail opened from a list MUST open in a pane beside the list, which stays
  usable. On narrow screens, it MUST open as its own page.
- On wide screens, menus MUST be popovers and short forms dialogs. On narrow screens, both MUST be
  bottom sheets. Astryx's `presentation="adaptive"` SHOULD be used where a component offers it.
- An open detail, tab, or sheet that can be returned to MUST be in the URL, so a reload, Back, or a
  change of width keeps it.
- Body text MUST be 17 px on narrow screens. From 1024 px wide, body text MUST be 19 px, and element
  heights and spacing MUST grow by the same factor, 1.2, through the theme's adaptations.
- Under a coarse pointer, every control MUST be at least 44 px tall, through the theme's
  adaptations.
- Reading text MUST NOT be wider than about 70 characters.
- Text MUST be left-aligned, never justified. Paragraphs SHOULD use `text-wrap: pretty`.
- Every view's spec MUST say what it shows at both width classes, and its mockups MUST show both.

## Why

The desktop showed the phone's column with phone sheets: the human zoomed it to 120% to read it, and
called the priorities modal "mobile-only" ([proposal](../2026-10-12-ui-improvements/proposal.md)).
Established products open an item in a side panel on desktop and a page on a phone, like Todoist and
Jira, and Astryx's shell already switches at 768 px
([Q2](../2026-10-12-ui-improvements/clarifications-01.md#q2-how-should-the-ui-adapt-between-the-phone-and-the-desktop),
[adapting](../2026-10-12-ui-improvements/discovery-01.md#adapting-to-the-phone-and-the-desktop)).
The human's 120% zoom turns 16 px into 19 px, close to GOV.UK's 19 px body text, and scales the
controls too
([Q5](../2026-10-12-ui-improvements/clarifications-01.md#q5-how-large-should-text-be-on-desktop),
[text size](../2026-10-12-ui-improvements/discovery-01.md#text-size-on-desktop)). Justified text was
considered and set aside: it is at its worst on a phone's narrow lines
([Q6](../2026-10-12-ui-improvements/clarifications-01.md#q6-should-paragraphs-be-justified),
[justified text](../2026-10-12-ui-improvements/discovery-01.md#justified-text)).

## Alternatives considered

- One column everywhere, larger on desktop, with sheets turned into dialogs: small, but a task view
  covers the list it came from.
- CSS `zoom: 1.2` on desktop: exactly the human's zoom, but it breaks the position math of dragging.
- Justified paragraphs with hyphenation: asked for in the proposal, with rivers on the phone.

## Consequences

- Each view is designed, mocked up, and checked at two widths.
- Details need an address, and a pane layout shared by the pages that list them.
- Tablets between 768 and 1024 px get the wide layout with phone-sized text.
- The theme is the app's own build of Astryx's neutral theme, not the prebuilt one.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
