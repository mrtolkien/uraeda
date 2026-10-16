---
status: active
approved-by: mrtolkien
---

# UI layout

Every layout choice in the web UI serves one goal first: the human reads and understands what is on
screen. There are two layouts, split at Astryx's 768 px. On the phone, views are pages, and menus
and short forms are sheets. On wide screens, each view takes the shape that reads best: a detail
glanced at beside its list opens in a pane, while a view the human stays in and follows, like an
agent's session, is a page of its own. Menus are popovers there, and short forms are dialogs. Text
is 17 px on the phone and 19 px on a desktop, with controls grown to match, in a reading column near
120 characters, left-aligned. The sidebar shows each feature and change as a card, by its name or
slug, with its step and status as icons, and folds to a rail from its top.

## Rules

- Readability and clarity for the human MUST come first. A view's spec MUST say why its layout reads
  best for what the view is for, and the rules below SHOULD give way to that, with the reason in the
  spec. Checked by review.
- The UI MUST have two width classes: narrow, under 768 px, and wide, from 768 px, taken from the
  theme's `md` breakpoint. A layout MUST be chosen by width, never by device type, user agent, or
  pointer. Checked by review.
- Components MUST NOT write their own media queries with sizes. They read the width class from one
  shared hook, or the theme's adaptations. Checked by review.
- On narrow screens, a view MUST open as its own page. Checked by the browser tests.
- On wide screens, a detail the human checks while working through a list, like a task of the
  priorities, SHOULD open in a pane beside the list, which stays usable. A view the human stays in
  or follows, like an agent's session, SHOULD be a page of its own, and MAY have a column beside its
  main content for what the human needs to keep in view. A column that takes room from the content
  MUST be foldable and resizable, with its width and the choice kept in the browser. Checked by the
  browser tests.
- The sidebar SHOULD stay short and visual: each feature or change as one card, by the name the
  human gave it, or its slug when it has none; its step as an icon at the card's start; its status
  and a running background command as icons at its end; its progress and the lines its branch
  changed as counts. Each card's accessible name MUST carry the full words: its name, its title, its
  step, its status, and its task. Checked by the UI tests.
- On wide screens, the sidebar MUST fold to a rail of its rows' icons, each with its status, from a
  button at its top, and unfold from the same place. Checked by the browser tests.
- On wide screens, menus MUST be popovers and short forms dialogs. On narrow screens, both MUST be
  bottom sheets. Astryx's `presentation="adaptive"` SHOULD be used where a component offers it.
  Checked by review.
- An open detail, tab, or sheet that can be returned to MUST be in the URL, so a reload, Back, or a
  change of width keeps it. Checked by the UI tests.
- Body text MUST be 17 px on narrow screens. From 1024 px wide, body text MUST be 19 px, and element
  heights and spacing MUST grow by the same factor, 1.2, through the theme's adaptations. Checked by
  the browser tests.
- Under a coarse pointer, every control MUST be at least 44 px tall, through the theme's
  adaptations. Checked by the browser tests.
- Reading text MUST NOT be wider than about 120 characters. Checked by the browser tests.
- Text MUST be left-aligned, never justified. Paragraphs SHOULD use `text-wrap: pretty`. Checked by
  review.
- Every view's spec MUST say what it shows at both width classes, and its mockups MUST show both.
  Checked by review.

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

Following an agent is one of the main things the UI is for, and the session's pane, about 480 px of
a 1440 px window, was too small for it ([proposal](../done/2026-10-14-session-view.md)). The pane
came from the old run view, and was never chosen for sessions
([layout on wide screens](../done/2026-10-14-session-view.md#q1-where-does-a-features-session-open-on-a-desktop)).
The human chose a page of its own with a column for the feature's progress, like the full-page
sessions of Claude Code's desktop app, Devin, and Codex
([Q1](../done/2026-10-14-session-view.md#q1-where-does-a-features-session-open-on-a-desktop)), and a
sidebar that is "small and visual more than textual", with features by their slug
([Q2](../done/2026-10-14-session-view.md#q2-how-does-the-current-task-show-in-the-sidebar)).
Approving it, they asked for this decision to rest on concepts more than hard rules: "Goal #1 is
always readability and clarity for the user. Some features will live well in a pane, others in a
dedicated page" (C1 of the [spec's review](../done/2026-10-14-session-view.md)).

the human asked the sidebar to show each feature's step before implementation, as an icon at the
start of the row with the running indicator at its end, and every line about a feature grouped in
one card, since sub-agents and tasks were hard to read
([Q4](../done/2026-10-16-redesign-interface.md#q4-how-does-a-features-step-show-on-its-row-before-implementation)).
They asked to rename a feature or give it a colour
([Q14](../done/2026-10-16-redesign-interface.md#q14-what-do-renaming-and-colouring-a-feature-change)),
to resize both sidebars, and to keep the rail as the folded state, with its button at the top
([Q5](../done/2026-10-16-redesign-interface.md#q5-what-does-hiding-a-sidebar-do)).

## Alternatives considered

- A column near 70 characters, the usual print measure: the first choice, which left most of a
  desktop empty and read too slim to the human, who set about 120 characters (2026-10-13).
- One column everywhere, larger on desktop, with sheets turned into dialogs: small, but a task view
  covers the list it came from.
- CSS `zoom: 1.2` on desktop: exactly the human's zoom, but it breaks the position math of dragging.
- Justified paragraphs with hyphenation: asked for in the proposal, with rivers on the phone.
- Every detail in a pane beside its list on wide screens, as a hard rule: the first version of this
  decision. It put an agent's session in a pane too narrow to follow it, and was abandoned for a
  choice made view by view, for readability (2026-10-14).
- The session as a pane beside the feature page, with a Maximize button added: no change to this
  decision, but an extra click every time an agent is followed.
- Each feature as a row by its slug, its progress on a separate row and its sub-agents below: the
  first sidebar, abandoned for cards, which read better with sub-agents and tasks (2026-10-16).

## Consequences

- Each view is designed, mocked up, and checked at two widths, and its spec says why its layout
  reads best.
- Details in panes need an address, and a pane layout shared by the pages that list them.
- A session's page shows no list beside it: its feature's page is one link away, through its crumbs
  and its column.
- The sidebar's labels are slugs, which a reader learns once per feature. Screen readers still get
  the titles.
- Tablets between 768 and 1024 px get the wide layout with phone-sized text.
- The theme is the app's own build of Astryx's neutral theme, not the prebuilt one.
- A renamed feature reads by its new name in the sidebar only: addresses, branches, and commits keep
  its slug.
- The rail keeps every item's step and status in view, 48 px wide.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
