---
status: active
approved-by: mrtolkien
---

# UI layout

The web UI has two layouts, split at Astryx's 768 px: on the phone, details are pages and menus and
short forms are sheets; on wide screens, a detail opens in a pane beside its list, menus are
popovers, and short forms are dialogs. Text is 17 px on the phone and 19 px on a desktop, with
controls grown to match, in a reading column near 120 characters, left-aligned.

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
- Reading text MUST NOT be wider than about 120 characters.
- Text MUST be left-aligned, never justified. Paragraphs SHOULD use `text-wrap: pretty`.
- Every view's spec MUST say what it shows at both width classes, and its mockups MUST show both.

## Why

The desktop showed the phone's column with phone sheets: the human zoomed it to 120% to read it, and
called the priorities modal "mobile-only" ([proposal](../done/2026-10-12-ui-improvements.md)).
Established products open an item in a side panel on desktop and a page on a phone, like Todoist and
Jira, and Astryx's shell already switches at 768 px
([Q2](../done/2026-10-12-ui-improvements.md#q2-how-should-the-ui-adapt-between-the-phone-and-the-desktop),
[adapting](../done/2026-10-12-ui-improvements.md#q2-how-should-the-ui-adapt-between-the-phone-and-the-desktop)).
The human's 120% zoom turns 16 px into 19 px, close to GOV.UK's 19 px body text, and scales the
controls too ([Q5](../done/2026-10-12-ui-improvements.md#q5-how-large-should-text-be-on-desktop),
[text size](../done/2026-10-12-ui-improvements.md)). Justified text was considered and set aside: it
is at its worst on a phone's narrow lines
([Q6](../done/2026-10-12-ui-improvements.md#q6-should-paragraphs-be-justified),
[justified text](../done/2026-10-12-ui-improvements.md)).

## Alternatives considered

- A column near 70 characters, the usual print measure: the first choice, which left most of a
  desktop empty and read too slim to the human, who set about 120 characters (2026-10-13).
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

## Proposed change (2026-10-14-session-view)

Proposed by the [spec](../2026-10-14-session-view/spec.md). A session, a feature's or a chat, opens
as a page of its own at both widths, never in a pane beside a list, with a column beside its
transcript on wide screens that the human can fold away. The sidebar's rows stay short: features by
their slug, progress and status as icons and counts.

The rules become:

- The UI MUST have two width classes: narrow, under 768 px, and wide, from 768 px, taken from the
  theme's `md` breakpoint. A layout MUST be chosen by width, never by device type, user agent, or
  pointer.
- Components MUST NOT write their own media queries with sizes. They read the width class from one
  shared hook, or the theme's adaptations.
- On wide screens, a detail opened from a list MUST open in a pane beside the list, which stays
  usable. On narrow screens, it MUST open as its own page.
- A session, a feature's or a chat, MUST open as a page of its own at both widths, never in a pane
  beside a list. On wide screens, a column beside its transcript MAY show what the session works on.
  The human MUST be able to fold it away, and the choice MUST be kept in the browser.
- The sidebar's rows SHOULD be short: a feature by its slug, its progress and status as icons and
  counts. Each row's accessible name MUST carry the full words: the feature's title, its status, and
  its task.
- On wide screens, menus MUST be popovers and short forms dialogs. On narrow screens, both MUST be
  bottom sheets. Astryx's `presentation="adaptive"` SHOULD be used where a component offers it.
- An open detail, tab, or sheet that can be returned to MUST be in the URL, so a reload, Back, or a
  change of width keeps it.
- Body text MUST be 17 px on narrow screens. From 1024 px wide, body text MUST be 19 px, and element
  heights and spacing MUST grow by the same factor, 1.2, through the theme's adaptations.
- Under a coarse pointer, every control MUST be at least 44 px tall, through the theme's
  adaptations.
- Reading text MUST NOT be wider than about 120 characters.
- Text MUST be left-aligned, never justified. Paragraphs SHOULD use `text-wrap: pretty`.
- Every view's spec MUST say what it shows at both width classes, and its mockups MUST show both.

Why: following an agent is one of the main things the UI is for, and the session's pane, about 480
px of a 1440 px window, was too small for it ([proposal](../2026-10-14-session-view/proposal.md)).
The pane came from the old run view, and was never chosen for sessions
([layout on wide screens](../2026-10-14-session-view/discovery-01.md#session-layout-on-wide-screens)).
The human chose a page of its own with a column for the feature's progress, like the full-page
sessions of Claude Code's desktop app, Devin, and Codex
([Q1](../2026-10-14-session-view/clarifications-01.md#q1-where-does-a-features-session-open-on-a-desktop)).
They asked for a sidebar that is "small and visual more than textual", with features by their slug
([Q2](../2026-10-14-session-view/clarifications-01.md#q2-how-does-the-current-task-show-in-the-sidebar)).

Alternatives considered, added:

- The session as a pane beside the feature page, as the run view had it, with a Maximize button
  added: no change to this decision, but an extra click every time an agent is followed.

Consequences that change:

- A session's page shows no list beside it: its feature's page is one link away, through its crumbs
  and its column.
- The sidebar's labels are slugs, which a reader learns once per feature. Screen readers still get
  the titles.
