---
status: answered
---

# Clarifications, round 01: Panes size

> [!NOTE]
>
> Answered on 2026-10-30.
>
> - Verdict: worth building, with changes: the feature page and the round are only the visible
>   cases. No page outside the documents has a width rule, and documents beside the side column read
>   at 25 characters a line on a half screen.
> - One choice lasts beyond this feature: a short scale of named widths for every page. It may
>   become a rule of the UI layout decision.
> - Pages of rows (inbox, settings, sessions, the feature page) would narrow from 1,200 px to a
>   reading pane's 692 px, the documents' edge.
> - The question cards: "some questions panes are too big" does not say which, so check the card I
>   read it as.
> - On a half screen, the side column would fold to its rail, against the semi-wide guide.
> - Check the points settled without you: dialogs left out, and the 1024 px jump removed.

## Context

### Goal

The [proposal](proposal.md) asks for coherent pane sizes, from clear rules. It names the feature
page's panes as too large, and some of a round's question panes as too big.

### Today

A reading page centres panes of about 80 characters of prose: 692 px at the default font. It is a
round's context, a spec, a plan, a document. Every other page fills one column, 720 px wide under a
1,024 px window and 1,200 px above. Its panes stretch to it whatever they hold. Measured in the
sandbox, the sidebar open:

| Page                              | 1920 px window | 800 px window |
| --------------------------------- | -------------- | ------------- |
| Round: context panes              | 692            | 671           |
| Round: question cards, split      | 1,424          | one column    |
| Spec, plan: panes                 | 692            | 271           |
| Spec: decision cards              | 865            |               |
| Feature: Next, Sessions, Timeline | 974            | 271           |
| Feature: its side column's panes  | 562            | 362           |
| Inbox, Settings, Sessions: panes  | 1,123          |               |
| Home: two panes side by side      | 552 each       |               |

At 1920 px, the feature page's Next button is 940 px wide for two words. At 800 px, a spec's prose
reads about 25 characters a line beside the side column. The theme holds about 20 widths, each set
by its own rule ([`theme.ts`](/packages/web/src/theme/theme.ts),
[`Page.tsx`](/packages/web/src/layout/Page.tsx)).

### Scope

The widths of pages, panes, cards, and the side column, at the three width classes. The rules behind
them, in the guides and possibly the UI layout decision. Dialogs, pickers, and the detail overlay
are left out: they are layers, not panes. The phone changes nothing: its panes are already the
screen's width.

### Sources

- [`Page.tsx`](/packages/web/src/layout/Page.tsx), [`Pane.tsx`](/packages/web/src/layout/Pane.tsx),
  [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx),
  [`documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts), and the theme.
- Every page measured in the sandbox with Chromium, at 1920, 1440, 1100, 800, and 400 px.
- GitHub Primer, Shopify Polaris, GOV.UK, Material 3, Apple's readable width, Linear, Notion,
  Obsidian, and GitLab's issues on page widths.
- Bringhurst, Butterick, Baymard, and WCAG 1.4.8 on line length.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **Dialogs, pickers, and the detail overlay** keep their widths: they float over the page, and the
  proposal names panes. A later change can bring them into the scale. See
  [discovery](discovery-01.md#overlays-and-the-phone).
- **The 1024 px jump goes**: a plain page's column grows at Astryx's `lg` breakpoint, a fourth width
  class the UI layout decision does not allow. Pages change width only at the three classes. See
  [discovery](discovery-01.md#astryx-breakpoints).
- **A page's title and crumbs** line up with its panes' left edge. Today a reading page's title sits
  at a 1,051 px column's edge, and its panes are centred at 692 px. See
  [discovery](discovery-01.md#measured-widths).

## Q1: How should a page and its panes get their width?

Design systems size pages from a short scale of named widths, picked by the kind of content. Polaris
has narrow (662 px), default (about 998 px), and full; Primer has medium, large, and xlarge, 768 to
1280 px. Side panes are fixed and narrow, 240 to 412 px. Uraeda has one rule, for prose, and a
default column for everything else. Q2 to Q4 set the scale's widths, if you pick A. More in
[discovery](discovery-01.md#the-rule).

Why it matters: it decides whether every later view picks a width from a list, or gets its own.

- **A (recommended). A short scale of named widths, set in the theme. It holds one reading pane, two
  reading panes side by side, and the whole window. It keeps the few special widths: the editor's
  100 columns, a session's column, the side column. Every page picks one, and its panes take it.**
  - [pro] one edge for each kind of page, and an agent never guesses a number.
  - [con] every page outside the documents changes width at once.
  - Why recommended: it is what Primer and Polaris do, and coherence ranks third in the UI
    principles.
- **B. Keep today's rules, and fix the outliers only: the feature page, the question cards, the 1024
  px jump.**
  - [pro] fewer pages change.
  - [con] the next page without a width still fills 1,200 px.
- **C. Let each pane fit its content, up to the reading pane's width.**
  - [pro] no pane is wider than what it holds.
  - [con] panes of one page end at different edges, and change width as their content changes.

**Answer:** A

## Q2: How wide is a page of rows, such as the inbox, settings, or the feature page?

Example: the feature page at 1920 px. Its Next, Sessions, and Timeline panes are 974 px wide today,
for a sentence and a button, a list, and ten steps. Inbox, Settings, and Sessions panes are 1,123
px, 117 characters of the UI font. A setting's description runs over 100 characters a line.

Polaris' single-column pages are 662 px, its default 998 px. GitLab users asked for its 1,280 px
list to match the 960 px of its other pages. This applies with a scale (A in Q1) or as an outlier
fix (B). More in [discovery](discovery-01.md#width-of-a-single-column-page-of-rows).

Why it matters: it sets the width of most pages, and whether moving from a document to the feature
page keeps the same edge.

- **A (recommended). One reading pane, 692 px at the default font, as the documents.**
  - Example: the feature page's panes are 692 px, centred, as the round's context is.
  - [pro] the same edge as every document, and rows of at most 72 characters of the UI font.
  - [con] a setting's control goes under its description when both do not fit on one line.
  - Why recommended: rows are read like prose, and one edge across pages is what GitLab's users
    asked for.
- **B. A width for rows, 100 characters of the UI font, about 960 px.**
  - Example: the feature page's panes are 960 px wide.
  - [pro] settings keep their controls beside their descriptions.
  - [con] a second edge, and long rows still read past 80 characters.
- **C. Today's column, 1,200 px.**
  - [pro] nothing changes.
  - [con] the feature page stays as the proposal describes it.

**Answer:** A: The same as priorities? Which is also a page of rows

Also when there's tabs, insets, or similar info, it's ok to get a larger pane as long as the _text_
colums take 692px

## Q3: How wide is a page with panes side by side, such as the home or New?

Example: the home at 1920 px shows two columns of panes, 552 px each, in the 1,200 px column. New
shows three cards of 365 px, then two panes of 554 px. A round is already two reading panes wide,
1,424 px, for its split question cards.

Why it matters: it decides whether the home's panes match the documents' panes.

- **A (recommended). Two reading panes and the gap between them, the round's width.**
  - Example: the home's two columns are 692 px each, and New's three cards about 450 px each.
  - [pro] each of the home's panes is a reading pane, the same as everywhere else.
  - [con] the home gets wider, 1,424 px instead of 1,200 px.
  - Why recommended: two of the scale's widths cover every page but the priorities.
- **B. Keep a page's column at 1,200 px for these two pages.**
  - [pro] the home stays as it is.
  - [con] a width of its own, outside the scale.

**Answer:** A

## Q4: How wide is the side column before you drag it?

Example: the feature page at 1920 px. Its side column holds two panes, Produced so far and Links,
two rows of figures and a branch name. It is 600 px wide today, a third of the window.

The same width serves a round's Outline and Notes, a spec's Contents, and a document's Session tab.
A drag keeps the width you chose, from 400 to 720 px, for every page. Primer's side panes are 240 to
320 px, Material's 360 to 412. More in [discovery](discovery-01.md#the-side-columns-default-width).

Why it matters: it sets how much room the page keeps beside its companions, on every document page.

- **A (recommended). 400 px, the least a column of rows takes, until you drag it.**
  - Example: the feature page's column is 400 px; its page keeps 200 px more.
  - [pro] the page keeps its room, and the column stays the same on every window.
  - [con] a session in the column is narrower until dragged.
  - Why recommended: the column holds companions, and a session reads best on its own page.
- **B. Today: a third of the window, 400 to 600 px.**
  - [pro] a session in the column has more room on a wide window.
  - [con] the feature page's two rows of figures keep 600 px.

**Answer:** A

## Q5: What happens to the side column on a half screen, when the page beside it gets too narrow?

Example: a spec, at an 800 px window. The sidebar is a rail, the side column 400 px, and the spec's
panes 271 px wide. Its prose reads about 25 characters a line, a third of the measure. At 1000 px,
about 49.

The [semi-wide guide](/specs/ui/semi-wide.md#the-page-shares-its-room) says the side column stays
there, and folds only on wide screens. Material puts a supporting pane under the content on small
windows. More in [discovery](discovery-01.md#the-side-column-on-semi-wide-screens).

Why it matters: it decides whether documents stay readable on a tablet or half a screen, and changes
a guide you set.

- **A (recommended). The side column folds to its rail when the page would keep less than a reading
  pane. Its tabs open over the page, as the sidebar's rail does.**
  - Example: at 800 px, the spec's panes are about 620 px, and the column's icons sit in a rail.
  - [pro] prose stays at about 80 characters a line on every window.
  - [con] the column's tabs take a click to reach on a half screen.
  - Why recommended: readable first is the first UI principle.
- **B. Only the feature page changes: its column's panes go under its own panes on semi-wide
  screens. Documents keep today's layout.**
  - [pro] documents keep their companions in view.
  - [con] a spec still reads at 25 characters a line at 800 px.
- **C. Keep today's layout.**
  - [pro] nothing changes.
  - [con] prose at 25 characters a line.

**Answer:** A: Hover should also work

## Q6: How wide is a round's question card, split into the question and its options?

Example: the recurring tasks round at 1920 px. Its context panes are 692 px; each question card
under them is 1,424 px, two reading panes. "When does a repetition end?", with two one-line options,
takes the same 1,424 px as a card with a diagram.

I read "some questions panes are too big" as these split cards. Bringhurst gives 40 to 50 characters
a line for text set in several columns, against 66 for one. More in
[discovery](discovery-01.md#the-question-cards-width).

Why it matters: it sets how a round reads, and changes the "two panes" width you chose for it.

- **A (recommended). Keep the split, each column at a measure for several columns: about 50
  characters for the question, 60 for the options.**
  - Example: the card is about 1,100 px, its question and options closer together.
  - [pro] the question and its options stay side by side, in a narrower card.
  - [con] a third width on the round's page, between one pane and two.
  - Why recommended: it keeps the side-by-side reading you asked for, at the measure columns call
    for.
- **B. One reading pane, the options under the question, on every card.**
  - Example: the card is 692 px, as wide as the context, its options under its text.
  - [pro] the whole round has one edge.
  - [con] a longer round to scroll, and the question leaves the screen as you read its options.
- **C. Today: two reading panes, 1,424 px.**
  - [pro] nothing changes.
  - [con] the cards stay as the proposal describes them.

**Answer:** A

## Q7: How wide is a spec's decision card?

Example: a spec at 1920 px. Its panes are 692 px. Its decision cards, "Repeating tasks" and "Due
dates", are 865 px, a quarter wider: they stick out on both sides. More in
[discovery](discovery-01.md#the-specs-decision-cards).

Why it matters: it decides whether a spec has one edge or two.

- **A (recommended). One reading pane, as every other pane of the spec.**
  - [pro] one edge for the whole spec.
  - [con] a decision's rules wrap a little more.
  - Why recommended: a decision's rules are prose, read best at the measure.
- **B. Keep them a quarter wider, so they stand out.**
  - [pro] the decisions stand apart from the rest.
  - [con] a width outside any scale.

**Answer:** B: Why would it be outside a scale? They can be their own width scale, for "big text"
panes?

## Q8: Where do the width rules live?

The [UI layout](/specs/decisions/ui-layout.md) decision says three width classes, and about 80
characters a line for prose. It says nothing on other panes. The guides in `specs/ui/` hold the
widths themselves, as numbers. A decision's rule binds every later feature, and changing it takes
your approval. More in [discovery](discovery-01.md#where-the-rules-live).

Why it matters: it decides whether a later view can pick its own width without asking you.

- **A (recommended). One new rule in the UI layout decision, that a page and its panes take a width
  of the theme's scale, checked by review. The widths themselves go in the guides.**
  - [pro] a page with its own width needs your approval.
  - [con] one more rule in a decision of nine.
  - Why recommended: the proposal asks for clear rules, and the one you would enforce is the scale.
- **B. The guides only, which agents read before a view.**
  - [pro] no decision changes.
  - [con] nothing binds a later view to the scale.

**Answer:** A

## Settled without the human

### Behaviour

- **The phone** keeps every pane at the screen's width, as the UI look decision asks. See
  [discovery](discovery-01.md#overlays-and-the-phone).
- **The priorities** keep their columns of 500 px across the window, and their single list.
- **The decisions page** keeps its list beside its reader, sized by its own split: it already
  follows reading widths.
- **A width you dragged** the side column to stays, read as before, within today's 400 to 720 px.

### Under the hood

- **Widths stay theme tokens**, never numbers in a view, as the UI components decision asks; the
  guides' tables are updated to the scale's names.
- **No test checks a page's width today**: the plan adds a check of each page's width at the three
  classes.

**Notes:**
