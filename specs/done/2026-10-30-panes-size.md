---
kind: feature
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/73
supersedes: [2026-10-24-questions-page, 2026-10-25-session-new]
---

# Record: Panes size

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/73). Its full files are
> in git: `git log -- specs/2026-10-30-panes-size/`.

## What and why

The human asked to review every pane's size: the feature page's panes were too large, some question
cards too big, and widths should be coherent, "based on clear rules". Only prose had a rule, about
80 characters a line; every other page filled a 1,200 px column from a 1,024 px window, and a
document beside the side column read at 25 characters a line on a half screen. Every page and pane
now takes one width of a short scale, picked by what it holds, and the UI layout decision binds it.

## Behaviour

- **The scale (all stories).** On semi-wide and wide screens, at the default fonts: a reading pane
  692 px, big text 865 px, a split card about 1,090 px, two panes 1,424 px, the whole window, the
  editor's 108 characters, a session's 95 characters, the side column 400 px dragged to 720 px.
  Every width made of the reading measure follows the reading font and size picked (Literata: 730 px
  panes, 913 px decision cards). No page changes width at 1,024 px; the phone is unchanged.
- **Pages of rows at a reading pane (US1).** The feature page, the inbox, settings, sessions, the
  commit page, the triage, the decisions check, a branch's decision, and the repository pages draw
  their panes one reading pane wide, centred. Settings' pages are wider by their controls: each
  setting's text keeps the reading pane's column, its control at the row's end. The priorities'
  single list is a reading pane wide and its rows' markers' gutter.
- **Titles at the panes' edge (US1).** A page's title and crumbs, and what a reading page draws
  outside its panes (a review's line, a plan's opening callout, a round's title), start at its
  panes' left edge, a reading pane wide.
- **A round's split cards (US2).** A round's context stays a reading pane; a split question card is
  the split card's width, its question at about 50 characters a line and its options at about 60,
  centred under the context, the same width whatever it holds. A card with less room than that keeps
  one column; a card with a mockup or a story keeps the page's whole column, its text a reading
  pane. A diagram wider than the question's column scrolls inside it.
- **The side column (US1, US3).** It starts at 400 px on every page that has one; a width dragged
  before is read as before, within 400 to 720 px. On a semi-wide window where the page beside it
  would keep less than a reading pane, it folds to a 52 px rail of its tabs' icons, the open tab's
  picked, and the page keeps its reading pane. The rail opens over the page, without moving it, when
  the mouse rests on it, on keyboard focus, on a tap of its button or its space, on `]`, or when
  asking the agent opens Session; it closes when the mouse or the focus leaves, on `]`, Escape, or a
  click outside. Opened from its button, the focus moves to the open tab; Escape returns it to the
  button. One rail is open at a time, the sidebar's or the column's. A wide window, or a semi-wide
  one with room for both, keeps the column beside the page, folded by `]`; a session's page keeps
  its column beside it.
- **Panes side by side (US4).** The home and New are two reading panes and their gap wide: the
  home's columns 692 px each, New's three cards about 450 px each.
- **Decision cards (US5).** A spec's decision cards are the big-text width, 865 px, centred; on a
  branch's decision page, a page of rows, the card is a reading pane.

## Design

The scale is theme tokens, declared once from the reading measure by
[`theme/scale.ts`](/packages/web/src/theme/scale.ts), spread into the theme and declared again on
the fonts' root ([`theme/fonts.ts`](/packages/web/src/theme/fonts.ts)), as a token holding a `var()`
takes its value where it is set. [`Page`](/packages/web/src/layout/Page.tsx) takes a required
`kind`, `reading`, `rows`, `panes`, `window`, `code`, or `session`, which sets its column
(`--page-column`) and, on a reading page, its panes' and its text's widths (`--pane-max`,
`pageText`); `beside` widens a page of rows by a token, as settings' controls. The question card
([`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx)) and the decision card
([`spec/DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx)) take their widths from the
tokens; a card splits once its group is a split card wide, measured by a probe
([`layout/useWidthOf.ts`](/packages/web/src/layout/useWidthOf.ts)), as a token made of others is a
`calc()` its text does not give. The side column's start is
[`layout/documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts)'s; whether it is
a rail is [`layout/SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx)'s, which reuses the
sidebar's [`useRail`](/packages/web/src/shell/Rail.tsx) for hover, tap, focus, and Escape. The
guides state the scale once, in [Reading](/specs/ui/reading.md#the-scale-of-widths).

## Replaced behaviour

- **A page without a width of its own filled a 1,200 px column from a 1,024 px window, 720 px under
  it.** No test guarded it.
- **The side column started at a third of the window, 400 to 600 px.** No test guarded it; the tests
  of `__tests__/document-column.test.ts` read a dragged width, which stays, and a new one checks the
  400 px start.
- **A split question card was two reading panes wide, and split from 840 px.** No test guarded it.
- **On semi-wide screens, the side column always sat beside the page.** No test guarded it; the
  semi-wide guide said it, and now describes the rail.

## Gotchas

- **The scale's tokens are declared twice, in the theme and on the fonts' root**: a custom property
  holding a `var()` resolves where it is declared, so a width made of the measure declared only in
  the theme would stay at the default font ([`theme/fonts.ts`](/packages/web/src/theme/fonts.ts)).
- **A width check reads a token through a probe element**: the computed value of an unregistered
  custom property is its unevaluated text, so `parseFloat` of a `calc()` token gave no width
  ([`layout/useWidthOf.ts`](/packages/web/src/layout/useWidthOf.ts)).
- **Page widths go through `--page-column`**: the token lint refuses a plain `calc()` on a width
  property but accepts a custom property set to a calc of tokens
  ([`layout/Page.tsx`](/packages/web/src/layout/Page.tsx)).
- **One rail is open at a time**: each open rail binds Escape as the registry's fallback, which
  refuses two ([`shell/Rail.tsx`](/packages/web/src/shell/Rail.tsx)'s `claim`).

## Questions

### Round 01

#### Q1: How should a page and its panes get their width?

**Answer:** A: a short scale of named widths, set in the theme, every page picking one.

#### Q2: How wide is a page of rows, such as the inbox, settings, or the feature page?

**Answer:** A: one reading pane, as the documents. "The same as priorities? Which is also a page of
rows." And "when there's tabs, insets, or similar info, it's ok to get a larger pane as long as the
_text_ colums take 692px".

#### Q3: How wide is a page with panes side by side, such as the home or New?

**Answer:** A: two reading panes and the gap between them, the round's width.

#### Q4: How wide is the side column before you drag it?

**Answer:** A: 400 px, until dragged.

#### Q5: What happens to the side column on a half screen, when the page beside it gets too narrow?

**Answer:** A: it folds to its rail, its tabs opening over the page. "Hover should also work."

#### Q6: How wide is a round's question card, split into the question and its options?

**Answer:** A: split, each column at a measure for several columns, about 50 and 60 characters.

#### Q7: How wide is a spec's decision card?

**Answer:** B: a quarter wider, as a width of the scale: "They can be their own width scale, for
'big text' panes".

#### Q8: Where do the width rules live?

**Answer:** A: a rule in the UI layout decision, the widths in the guides.

## Decisions

- [UI layout](../decisions/ui-layout.md), changed: every page and pane takes its width from one
  short scale of named widths, picked by what it holds, set once in the theme.

## Changes after approval

- Every reading page's column is the two-panes width, so a spec's live window may grow to 1,424 px
  rather than 1,200 px.
- A question card splits only with a split card's width of room, about 1,090 px, rather than 840 px.
- The side column's rail is the sidebar's 52 px, folded or railed, rather than 48 px.
- The column opened over the page from its rail has no resize bar.
- What a reading page draws outside its panes, beyond its title and crumbs, starts at the panes'
  edge too.
- A branch's decision page draws its card a reading pane wide.
- The ledger test of the decisions' shape exempts the UI layout decision's Why and alternatives,
  which the human approved over its limits.
