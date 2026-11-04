---
kind: change
finished: 2026-11-04
pull-request: https://github.com/mrtolkien/uraeda/pull/94
supersedes: [2026-10-18-diagram-frames, 2026-10-30-panes-size]
---

# Record: Some stuff is weirdly left-aligned

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-04, finished on
> 2026-11-04, in [its pull request](https://github.com/mrtolkien/uraeda/pull/94). Its full files are
> in git: `git log -- specs/changes/2026-11-04-some-stuff/`.

## What and why

On the spec page and the questions page, section titles, headings, and graphs sat at the page's left
edge while the panes beside them were centred; the human's screenshot showed a data model's "Data"
heading, its intro, and its state diagram far left of its centred tables. These are the two most
important pages and the hardest to read, so they "need to be _perfect_": the human asked for a
review of every part of both, by driving the app in a headless browser, with more room where it
reads better.

## Behaviour

- **Text outside the panes starts at the panes' left edge**, a reading pane wide, on semi-wide and
  wide screens, as the title and crumbs already did. On the spec page: each group's heading
  (Decisions, User stories, Data, How it is built, and any section the page does not know), the text
  before the first story, the text of a section the page does not know, the data model's intro, a
  failed verdict's notice, and the review's end, from its band to Approve. On the questions page:
  "Settled without you", and the round's end, its notes, the questions left, and Commit or Submit.
  The panes, the decision cards, the split question cards, and the live windows keep their widths
  and places. On the phone nothing moved.
- **A review's end is one group**: its band, "Your review", its comments, the general comment, and
  the verdict sit a small gap apart, rather than a section's gap.
- **A diagram is laid out in the fonts it is drawn in**: its labels wrap within their room and never
  run into each other or past the diagram's edge.
- **A diagram narrower than its room sits in its middle**, in a pane, a question's card, or the
  page's text.
- **A diagram more than a tenth wider than its room is laid out for it**, as a flowchart turning
  top-down, and shows only once that layout is in, when narrower. One within a tenth of its room is
  scaled down to fit, its text a few percent smaller. One still wider scrolls sideways inside its
  card, as before.
- **A question holding a diagram keeps one column**, as one holding a table does, rather than the
  split card whose question column is about 450 px wide. The round mockup's flowchart went from 766
  px scrolling in 452 px to 634 px fitting in 634 px.

## Design

- **Page text**: a reading page (`Page`'s `reading` kind) is two reading panes wide, and only
  `Pane`, the question card, and what takes [`pageText`](/packages/web/src/layout/Page.tsx) centre
  themselves in it. The [Panes size](2026-10-30-panes-size.md) feature gave `pageText` to the title,
  the crumbs, a review's opening line, and a plan's callout, not to the rest of what a page draws
  outside its panes. Each now takes it: [`spec/SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx)
  (`Group`'s heading, `PageText`), [`spec/DataPart.tsx`](/packages/web/src/spec/DataPart.tsx),
  [`YourReview.tsx`](/packages/web/src/YourReview.tsx),
  [`review/VerdictLeft.tsx`](/packages/web/src/review/VerdictLeft.tsx),
  [`SettledGroups.tsx`](/packages/web/src/SettledGroups.tsx), and
  [`RoundSubmit.tsx`](/packages/web/src/RoundSubmit.tsx).
  [`page-text.test.tsx`](/packages/web/src/__tests__/page-text.test.tsx) checks each spot, and that
  a pane is not inside a text column box.
- **Diagram fonts**: `Diagram` called Pele's `renderAsync` with no fonts, so Pele measured labels
  with its own metrics while the page drew them in the theme's wider Monaspace.
  [`useDiagramDraw.ts`](/packages/web/src/useDiagramDraw.ts) reads `--pele-font` and
  `--pele-font-mono` from the diagram's box, as Pele's own `mount()` does, loads them for the
  source's characters, 2 seconds at most, and passes them as `fontFamily` and `fontFamilyMono`
  ([`diagram-fonts.test.tsx`](/packages/web/src/__tests__/diagram-fonts.test.tsx)).
- **Diagram fit**: the same hook draws a diagram much wider than its room again with Pele's
  `maxWidth`, the room in steps of 8 px, keeps each draw with its source, and keeps the last fitted
  layout while the next is drawn; it then gives the width shown, and whether it still scrolls, with
  half a px of tolerance. [`Diagram.tsx`](/packages/web/src/Diagram.tsx) draws what it returns
  ([`diagram-fit.test.tsx`](/packages/web/src/__tests__/diagram-fit.test.tsx)).
- **One column**: [`holdsWide`](/packages/web/src/Question.tsx) counts a `mermaid` block as wide, as
  a table ([`question-wide.test.ts`](/packages/web/src/__tests__/question-wide.test.ts)).

## Replaced behaviour

- **A diagram wider than its card scrolls inside it**, from the
  [Diagram frames](2026-10-18-diagram-frames.md) record: it is laid out for its room first, or
  scaled within a tenth, and scrolls only past that. No test was removed.
- **A diagram wider than the question's column scrolls inside it**, from the
  [Panes size](2026-10-30-panes-size.md) record: a question holding a diagram keeps one column. No
  test was removed.

## Gotchas

- **The data model's intro is a reading pane wide**: it used to spread over the page's two-pane
  column, so a wide table there now scrolls inside 692 px, as a table only grows past its box inside
  a pane ([`Blocks.tsx`](/packages/web/src/Blocks.tsx)'s `TableBlock`).
- **The Decisions heading starts at the reading pane's edge**, about 86 px right of the decision
  cards, which are big-text wide: [Reading](/specs/ui/reading.md#the-scale-of-widths) puts what a
  page draws outside its panes at the reading pane's edge.
- **Pele cannot narrow every diagram**: a state diagram keeps its natural layout under `maxWidth`,
  so on the phone it still scrolls ([`useDiagramDraw.ts`](/packages/web/src/useDiagramDraw.ts)).

## Changes after approval

- A diagram narrower than its room is centred: the proposal names graphs among what is left-aligned.
- A question holding a diagram keeps one column, rather than scrolling in the split card's question
  column, which the Panes size record had approved.
- A diagram wider than its room is laid out for it with Pele's `maxWidth`, and one within a tenth is
  scaled down rather than scrolling for a sliver of itself.

## Follow-ups

- A font picked in Settings changes a diagram's text at once, but its layout is measured again only
  when the diagram is drawn anew, as on the page's next visit.
