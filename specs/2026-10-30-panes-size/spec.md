---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Panes size

> [!NOTE]
>
> Approved on 2026-10-30.
>
> - You approve one scale of named widths for every page and pane. Pages of rows narrow to a reading
>   pane, and the side column starts at 400 px. Split question cards narrow to about 1,080 px, and
>   the side column becomes a rail on a half screen.
> - Changed decision, UI layout: every page and pane takes its width from the scale, set once in the
>   theme.
> - I read "the same as priorities?" as one text column for every page of rows, the priorities' list
>   included. That list's text goes from 80 to about 72 characters of the UI font.
> - The spec's decision cards keep their 865 px, as the scale's big-text width, as you asked.
> - On a half screen, the side column opens over the page on hover too, as the sidebar's rail does.
> - Risk tier `medium`: every page changes width at once, with no stored data changed.

The web UI sizes its pages one by one: documents read at about 80 characters a line, while every
other page stretches its panes to a 1,200 px column. The feature page's panes, a round's question
cards, and a document beside the side column on a half screen read worst. This feature gives every
page and pane a width from one short scale, picked by what it holds. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

The scale: every page and pane takes one of these widths on wide and semi-wide screens. The numbers
are at the default fonts; each follows the reading font and size the human picks, as the reading
measure does today.

| Width        | At default fonts          | Holds                                                               |
| ------------ | ------------------------- | ------------------------------------------------------------------- |
| Reading pane | 692 px                    | prose at about 80 characters, and the text column of a page of rows |
| Big text     | 865 px                    | a pane of large text: a spec's decision cards                       |
| Split card   | about 1,080 px            | a question card's two columns, about 50 and 60 characters a line    |
| Two panes    | 1,424 px                  | two reading panes and their gap: the home, New, a round's page      |
| Whole window | the window                | the priorities' columns                                             |
| Code         | 108 characters            | the proposal editor's formatted file, unchanged                     |
| Session      | 95 characters             | a session's page, unchanged                                         |
| Side column  | 400 px, dragged to 720 px | a page's companions                                                 |

A page's text column is a reading pane. A pane may grow past it only by what sits beside its text: a
control, a tab, an inset, a row's marker. A page's title and crumbs start at its panes' left edge.

## Decisions

- **Changed: [UI layout](../decisions/ui-layout.md)**. Every page and pane takes its width from one
  short scale of named widths, picked by what it holds, set once in the theme with the three width
  classes.

Relied on:

| Decision                                       | What it means for this spec                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| [UI look](../decisions/ui-look.md)             | the phone keeps panes at the screen's width; nothing changes there      |
| [UI components](../decisions/ui-components.md) | every width is a theme token; prose stays sized by the shared component |
| [Preview](../decisions/preview.md)             | the layouts are an HTML page of frames, as the decision allows          |

## User stories

### US1: Pages of rows at a reading pane's width (P1)

The feature page, the inbox, settings, sessions, the commit page, the triage, the decisions check,
and a branch's decision draw their panes one reading pane wide, centred as documents are. The side
column starts at 400 px on every page that has one.

[Feature page](mockups/widths.html#feature)

[Inbox and settings](mockups/widths.html#rows)

[Priorities as one list](mockups/widths.html#priorities)

Key scenarios:

1. **Given** a 1920 px window and the sidebar open, **When** the human opens a feature, **Then**
   Next, Sessions, and Timeline are 692 px wide, and its side column 400 px.
2. **Given** a 1920 px window, **When** the human opens settings, **Then** each setting's text wraps
   at 692 px, and its control sits beside the text, in the same pane.
3. **Given** the priorities shown as one list, **When** the window is 1920 px, **Then** the list's
   text column is 692 px wide, its markers and selection bar in the room around it.

More scenarios:

1. **Given** a 1100 px window, **When** the human opens the inbox, **Then** its panes are 692 px,
   not 971 px.
2. **Given** a side column dragged to 560 px before this feature, **When** the human opens a spec,
   **Then** the column is still 560 px.
3. **Given** a 1000 px window, **When** the human opens the inbox, **Then** its panes are as wide as
   at 1100 px: no page changes width at 1024 px.

### US2: A round's split cards at a measure for columns (P1)

A round's context stays one reading pane. Each split question card is as wide as its question at
about 50 characters a line, its options at about 60, and the gap between them.

[A round](mockups/widths.html#round)

Key scenarios:

1. **Given** a round at a 1920 px window, **When** it shows a split card, **Then** the card is about
   1,080 px wide, not 1,424 px, centred under the 692 px context.
2. **Given** a card with three one-line options and a card with a diagram, **When** both are split,
   **Then** both are the same width.

More scenarios:

1. **Given** a card holding a mockup or a story, **When** the round is drawn, **Then** its live
   window keeps the page's whole column, and its text a reading pane, as today.
2. **Given** a 1100 px window, **When** a card has less room than its split width, **Then** it keeps
   one column, as today under 840 px.

### US3: The side column as a rail on a half screen (P2)

On a semi-wide window, when the page beside the side column would keep less than a reading pane, the
column folds to a rail of its tabs' icons. Hovering the rail, tapping it, or `]` opens the column
over the page, without moving the page. It folds back when the pointer leaves, or on `]` or Escape.

[The column as a rail](mockups/widths.html#semi)

[The column opened over the page](mockups/widths.html#semi-open)

Key scenarios:

1. **Given** a spec at a 1000 px window, **When** it is drawn, **Then** its panes are 692 px wide,
   and the side column is a 52 px rail on the right.
2. **Given** the same spec, **When** the pointer rests on the rail, **Then** the column opens over
   the page at 400 px, the page staying where it was, and closes when the pointer leaves.
3. **Given** the same spec, **When** the human presses `]`, **Then** the column opens over the page
   and stays open until `]`, Escape, or a click outside it.

More scenarios:

1. **Given** a spec at a 1260 px window, the page keeping more than a reading pane, **When** it is
   drawn, **Then** the column sits beside the page, as today.
2. **Given** the Session tab in the address at a 1000 px window, **When** the page reloads, **Then**
   the rail shows Session's icon picked, and opening the column shows Session.

### US4: Panes side by side at two reading panes (P2)

The home and New are two reading panes and their gap wide, as a round's page is.

[Home and New](mockups/widths.html#home)

Key scenarios:

1. **Given** a 1920 px window, **When** the human opens the home, **Then** its two columns are 692
   px each.
2. **Given** a 1920 px window, **When** the human opens New, **Then** its three cards share 1,424
   px, about 450 px each, and the two panes under them are 692 px each.

### US5: The spec's decision cards at the big-text width (P3)

A spec's decision cards keep their width, now a named width of the scale, for panes of large text.

[A spec](mockups/widths.html#spec)

Key scenarios:

1. **Given** a spec at a 1920 px window, **When** it lists a changed decision, **Then** the
   decision's card is 865 px wide, centred, and the spec's other panes 692 px.

## Replaced behaviour

- **A page without a width of its own fills a 1,200 px column from a 1,024 px window, 720 px under
  it.** No test guards it.
- **The side column starts at a third of the window, 400 to 600 px.** No test guards it: the tests
  of `__tests__/columnWidth.test.ts` and `__tests__/document-column.test.ts` read a dragged width,
  which stays.
- **A split question card is two reading panes wide.** No test guards it.
- **On semi-wide screens, the side column always sits beside the page.** No test guards it; the
  [semi-wide guide](/specs/ui/semi-wide.md#the-page-shares-its-room) says it, and changes with this
  feature.

## Architecture

The scale is a set of theme tokens, and `Page` takes a page's kind instead of its flags, so a view
names what it holds, never a number. The reading pane stays derived from the reading measure, so
every width of the scale follows the fonts. See [the rule](discovery-01.md#the-rule).

- **The scale** is the theme's named widths, in one place of the theme. It owns every width above,
  and drops `--size-page-max` and its 1,024 px rule.
- **The page** (`layout/Page.tsx`) gives each kind of page its width from the scale: reading, rows,
  two panes, whole window, code, or session. It owns where the title, crumbs, and panes start.
- **The pane** (`layout/Pane.tsx`) takes its page's text column, and grows only by what its content
  sets beside the text.
- **The question card** (`QuestionCard.tsx`) owns the split card's width and its two columns.
- **The side column** (`layout/SideColumn.tsx`, `layout/documentColumnWidth.ts`) owns its 400 px
  start, and the rail it becomes when the page beside it would keep less than a reading pane.
- **The guides** in `specs/ui/` state the scale once, in [Reading](/specs/ui/reading.md), and the
  width guides link to it.

Tradeoffs:

- Settings' panes are wider than the inbox's by their controls: one text column, two pane edges.
- On a half screen, the side column's tabs take a hover or a key to reach.

## Edge cases

| Importance | Situation                                                      | What happens                                                             |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| High       | A side column width kept in the browser before this feature    | it is read as before, within 400 to 720 px                               |
| Normal     | The human picks a larger reading font or size                  | every width of the scale grows with the reading measure                  |
| Normal     | A window between two widths, at 1,280 px with the sidebar open | the column stays beside the page: the rail is for semi-wide windows only |
| Normal     | The sidebar is folded on a wide window                         | the page is centred on the screen, at its scale width                    |
| Normal     | A table in a page of rows is wider than the text column        | it scrolls inside its pane, as in a document                             |
| Niche      | A semi-wide window wide enough for the page and the column     | the column sits beside the page, as today                                |
| Niche      | Reduced motion asked by the system                             | the column opens over the page at once                                   |

## Success criteria

- **SC-001** (one text column): At 1920 px and 1100 px, every page of rows has a text column of one
  reading pane, measured in the sandbox.
- **SC-002** (80 characters): At 1000 px, a spec's prose holds 75 to 85 characters a line.
- **SC-003** (no 1,024 px jump): No page changes width between a 1,000 px and a 1,050 px window.
- **SC-004** (tokens only): No view sets a page's or a pane's width with a number, checked by the
  token lint.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Settled
while writing this spec:

- Pages of rows and the priorities' list share one text column, a reading pane. A pane may grow past
  it only by what sits beside its text, from your answer on tabs and insets.
- The rail on a half screen applies to every page with a side column: a spec, a plan, a round, and
  the feature page. Wide windows keep the column beside the page, folded only by `]`.
- The split card's width is fixed by its two measures, the same for every split card of a round.
- A story's or a mockup's page takes the two-panes width, the widest short of the whole window.
- The sign-in page keeps its form's width; dialogs, pickers, and the detail overlay keep theirs.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: every page of the web UI changes width at once, though no stored data or file format
changes.
