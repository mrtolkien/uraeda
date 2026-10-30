---
kind: change
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/76
supersedes: [2026-10-24-questions-page, 2026-10-24-spec-page]
---

# Record: Reading and layout pass

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/76). Its full files are
> in git: `git log -- specs/changes/2026-10-30-reading-pass/`.

## What and why

The human reads most of the time in Uraeda, on a phone too, and five things read badly. On the
phone, open panes let a question's example run into its context, and prose was large for a narrow
screen. A spec's replaced behaviour was the only part drawn bare, a wide table was cut off at its
pane's border, and the home's columns sat left of the room beside the sidebar.

## Behaviour

- On the phone, every pane of a reading page, a round, a spec, a plan, a document, the data model,
  and a feature's record, keeps its whole border: 2 px from the screen's edges, 3 px inside it. Its
  text starts about 6 px from the edge, near the page's own text at 7.8 px. A pane inside another
  keeps its own room; a pane in a question's options, as a decisions check's candidate, keeps 2 px
  from the edges too.
- On the phone, under 768 px, prose is 16 px rather than 19, as a chat app's messages; the UI font's
  sizes and the line height are unchanged.
- A spec's Replaced behaviour sits in one pane, "Behaviours", under its heading, as Architecture
  sits under How it is built.
- On semi-wide and wide screens, a table wider than its pane grows past it into the empty room
  beside it, as a live window does, with its own border over the pane's and its rows' lines running
  to it. It scrolls sideways only past that room. A table that fits its pane stays in it, unframed;
  on the phone, a table scrolls inside its pane.
- On semi-wide and wide screens, a page is centred on the room right of the sidebar, as if the side
  column were closed, as far as the room allows: at 2,400 px, the home's columns centre at 1,368 px,
  the room's middle. A side column opening at the right leaves the page where it is while the room
  allows.

## Design

- **Snug panes**: [`Pane`](/packages/web/src/layout/Pane.tsx)'s `isSnugOnPhone`, formerly
  `isOpenOnPhone`, keeps the border and sets a 3 px padding (`--pane-phone-inset`), and a negative
  margin, `--pane-phone-margin` (2 px) less `--pane-phone-reach`, the page's inset by default
  ([`pane.stylex.ts`](/packages/web/src/layout/pane.stylex.ts)). A question's options, already at
  the screen's edges, set the reach to none ([`Question.tsx`](/packages/web/src/Question.tsx)). The
  page keeps its inset, so its own text, a question's heading and context, does not touch the edge.
- **Phone prose**: one adaptation of the [theme](/packages/web/src/theme/theme.ts), `width < 768px`,
  sets `--text-reading-size` to 16 px, before the touch screens' rule.
- **Tables**: [`TableBlock`](/packages/web/src/Blocks.tsx) asks
  [`useOutgrow`](/packages/web/src/embedLayout.ts) for room, the width being its columns', from
  [`tableWidth`](/packages/web/src/BlockTable.tsx), the widths Astryx draws them at. Its shape adds
  a frame, the border and the holder's room inside it, and `isPastOnly`, so a table that fits grows
  not at all. A live window keeps the default shape.
- **Centring**: [`useScreenCentre`](/packages/web/src/layout/useScreenCentre.ts) takes, as the
  page's start margin, the room that the middle of its parent's start to the window's end asks for,
  clamped to the parent's room; [`Page`](/packages/web/src/layout/Page.tsx) and the decisions'
  [`Panes`](/packages/web/src/layout/Panes.tsx) use it.
- The guides [The phone](/specs/ui/phone.md), [Reading](/specs/ui/reading.md),
  [Space and motion](/specs/ui/space-and-motion.md), and [Wide screens](/specs/ui/wide.md) say the
  same.

## Gotchas

- **The phone's snug room is opt-in, pane by pane**: a new pane on a reading page takes
  `isSnugOnPhone`, or it keeps the wide screens' 14.4 px room beside its 3 px siblings.
- **The UI look decision's phone rule reads for every pane**, as approved, while only a reading
  page's panes take the snug room: a home card or a session's pane keeps its own, as under the rule
  it replaced.
- **A question's options set `--pane-phone-reach` to `0%`**: `calc(2px - 0)` is not valid CSS, and
  the token lint refuses a raw `0px`.

## Questions

### Round 01

#### Q1: Where should a page be centred on a wide screen?

**Answer:** A, centre every page on the room right of the sidebar, as if the side column were
closed.

#### Q2: Should a pane keep its whole border on the phone?

**Answer:** A, approve the change of the UI look decision.

#### Check these

- **Wide tables** grow past their pane on semi-wide and wide screens, framed, as far as the room
  beside the pane allows, and scroll only past it; on the phone they scroll inside their pane.
- **The change's start** made a feature, `2026-10-30-reading-pass`; the folder moved to
  `specs/changes/`, and the branch became `change/2026-10-30-reading-pass`.

## Decisions

- [UI look](/specs/decisions/ui-look.md): on the phone, a pane keeps its whole border, with little
  room inside it and around it, where it kept only its titled top border.

## Follow-ups

- Two agents' notes in the inbox: starts leave the links of `specs/done/` records to the proposals
  they move broken, which fails `ura check` on the default branch; and this change's start made a
  feature while its session continued a change.
