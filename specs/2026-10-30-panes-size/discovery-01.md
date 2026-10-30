# Discovery, round 01: Panes size

## Summary

Design systems size content with a short scale of named widths, picked by the kind of content, not a
number per page. Prose gets a narrow column, about 66 to 80 characters a line. Lists, tables, and
dashboards get a wider one or the whole window. Side panes are fixed and narrow, 240 to 412 px, and
the main column flexes up to a cap. Products differ on the cap and on whether the human can widen a
page (Notion's Full width, Obsidian's readable line length).

The [proposal](proposal.md) asks for coherent pane sizes from clear rules, and names two culprits:
the feature page's panes, and some of a round's question cards. The web UI already has a rule for
prose: a reading pane is about 80 characters of prose wide, 692 px measured, centred. Every other
page has no rule of its own. It takes `Page`'s default column, 720 px under 1024 px and 1200 px from
1024 px, a breakpoint outside the three width classes. Its panes stretch to that column, whatever
they hold. A round's question cards are two reading panes wide, 1,424 px, under context panes of 692
px. The app counts about 20 width tokens, each set by its own rule.

## How other products do it

### GitHub Primer

- Pages are capped at 1280 px, "so paragraphs don't run too many words per line". Interstitial pages
  such as sign-in are capped at 320 px. On split pages, the content keeps a max width and stays
  centred ([Primer layout](https://primer.style/product/getting-started/foundations/layout/)).
- One column under 768 px, up to 2 from 768 px, and a third only from 1400 px, "only when needed"
  (same page).
- `PageLayout`'s pane takes a named width, small, medium, or large, 240 to 320 px, and can be made
  resizable, the width kept in the browser. Its content takes full, medium (768), large (1012), or
  xlarge (1280) ([PageLayout](https://primer.style/product/components/page-layout/),
  [source](https://raw.githubusercontent.com/primer/react/main/packages/react/src/PageLayout/PageLayout.module.css)).

### Shopify Polaris

- Width tokens: a primary column of 480 to 662 px, a secondary column of 240 to 320 px, a gap of 16
  px. The default page is the two together, about 998 px
  ([tokens](https://raw.githubusercontent.com/Shopify/polaris/main/polaris-react/src/components/AppProvider/global.css),
  [page layout](https://raw.githubusercontent.com/Shopify/polaris/main/polaris-react/postcss-mixins/page-layout.css)).
- A page is default, `narrowWidth` (the primary column, "intended for single-column layouts"), or
  `fullWidth`
  ([Page](https://raw.githubusercontent.com/Shopify/polaris/main/polaris-react/src/components/Page/Page.tsx)).
- The default width is for single-column task pages. The large one is for dashboards and lists with
  many columns. Settings put a narrow column of titles and descriptions beside a column of fields
  ([Shopify app layout](https://shopify.dev/docs/apps/design/layout)).

### GOV.UK

- Pages are at most 1020 px. Most use a two-thirds column "so lines don't get too long", which
  "would usually mean no more than 75 characters per line"
  ([layout](https://design-system.service.gov.uk/styles/layout/)).
- A text field is sized to what it expects: fixed character widths for known lengths, fractions of
  the parent otherwise ([text input](https://design-system.service.gov.uk/components/text-input/)).

### Material 3 and Android

- Window classes follow the window, not the device: compact under 600 dp, medium to 839, expanded to
  1199, large to 1599, extra-large beyond
  ([window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes)).
- List and detail show side by side only from expanded. A supporting pane goes under the content or
  into a sheet on compact, splits 50/50 on medium, and 70/30 on expanded
  ([canonical layouts](https://developer.android.com/guide/topics/large-screens/large-screen-canonical-layouts)).
- The scaffold's fixed pane is 360 dp, 412 dp from large, with 24 dp between panes
  ([`PaneScaffoldDirective`](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/adaptive/adaptive-layout/src/commonMain/kotlin/androidx/compose/material3/adaptive/layout/PaneScaffoldDirective.kt)).

### Apple

- `readableContentGuide` keeps text in "an area that can easily be read without forcing users to
  move their head", and scales with the text size. Apple says to use its width to size several
  columns too
  ([readableContentGuide](https://developer.apple.com/documentation/uikit/uiview/readablecontentguide)).

### Linear, Notion, Obsidian, GitLab, Confluence

- Linear centres the issue's content past a window width, so the column does not get "too broad",
  while its details panel grows with the screen
  ([changelog](https://linear.app/changelog/2021-06-03-issue-view-layout)).
- Notion has a per-page Full width toggle. Asked for a full-width default, Notion answers "Not yet,
  but a lot of users have asked for this!"
  ([help](https://www.notion.com/help/customize-and-style-your-content)).
- Obsidian's "Readable line length" is an on or off setting. Users have asked since 2020 for an
  adjustable width, and a wider one for tables
  ([forum](https://forum.obsidian.md/t/adjustable-readable-line-length/7564)).
- GitLab users asked to narrow the issues list from 1280 to the 960 px of other pages: different
  widths between pages made them harder to read
  ([issue 28319](https://gitlab.com/gitlab-org/gitlab/-/issues/28319)). Others asked for a wider
  layout so that 120-character diffs fit
  ([issue 18604](https://gitlab.com/gitlab-org/gitlab/issues/18604)).
- Confluence users asked for full-width pages by default
  ([CONFCLOUD-67503](https://jira.atlassian.com/browse/CONFCLOUD-67503)).

### What they have in common

- **A short scale of named widths**, three to five, never a number per page: Primer's medium, large,
  xlarge; Polaris' narrow, default, full; GOV.UK's fractions of one page.
- **The width follows the content's kind**: prose and single-column tasks narrow, lists with many
  columns and dashboards wide or full, interstitial pages the narrowest.
- **Side panes are fixed and narrow**, 240 to 412 px, and the main column flexes up to its cap.
- **Panes follow the width class**: one column on a phone, two from about 768 to 840 px, a third
  only on the widest windows.
- **One page width across pages** of the same kind: GitLab's users noticed when two lists differed.
- **A way to widen**, per page or globally, is a recurring request: Notion, Confluence, Obsidian.

## Standards and libraries

### Line length

- Bringhurst: 45 to 75 characters is satisfactory, 66 ideal; 40 to 50 for text set in several
  columns ([webtypography.net](https://webtypography.net/2.1.2)).
- Butterick: 45 to 90 characters, spaces included
  ([Practical Typography](https://practicaltypography.com/line-length.html)).
- WCAG 1.4.8, level AAA: a block of text is "no more than 80 characters" wide, or the user can
  change its width
  ([Understanding 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html)).
- Baymard: 50 to 75 characters, 80 at most; users tire past 100
  ([line length](https://baymard.com/blog/line-length-readability)).
- Every one scopes the rule to prose. None applies it to lists, tables, or dashboards.

### Field widths

- Baymard: a field's width matches the length of its expected input. Users who saw mismatched widths
  wondered whether they had misread the label
  ([form fields](https://baymard.com/blog/form-field-usability-matching-user-expectations)).

### Astryx breakpoints

- Astryx names five window breakpoints: `sm`, `md` 768, `lg` 1024, `xl` 1280, and `2xl`
  (`node_modules/@astryxdesign/core/src/theme/themeAdaptations.ts`). The app's three width classes
  use `md` and `xl` ([`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts)).

## The code

### Important reads

- [`layout/Page.tsx`](/packages/web/src/layout/Page.tsx): a page's column. Without a flag it is
  `--size-page-max` wide. `isReading` caps each pane at a reading pane, `isPaired` makes the page
  two reading panes wide, `isWriting` holds the editor's 108 columns, `isSession` 95 `ch`, `isFull`
  the window.
- [`theme/theme.ts`](/packages/web/src/theme/theme.ts): `--size-page-max` is 720 px, and 1200 px
  from Astryx's `lg`, 1024 px, a rule of the theme's adaptations. `--size-reading-pane` is the
  reading measure, about 80 characters, plus the pane's room and border. The file holds about 20
  other widths: the detail dialog's 108 `ch`, a form's 560 px, a picker's 640 px, a question card's
  split at 840 px, and more.
- [`layout/pane.stylex.ts`](/packages/web/src/layout/pane.stylex.ts): `--pane-prose` and
  `--pane-code`, the two widths a pane takes from its page.
- [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx): a pane takes `--pane-max` and
  `--pane-width` from its page. Without them, it fills its page's column.
- [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx): a card splits into question and options,
  5 to 6, once it is 840 px wide (`--size-round-split`). Split, it is two reading panes wide; with a
  table, a mockup, or a story, one column.
- [`spec/DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx): a spec's decision card is 1.25
  reading panes wide.
- [`layout/documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts): the side
  column is a third of the window, 400 to 600 px, until dragged, then 400 to 720 px. The feature
  page's column shares it
  ([`feature/FeatureColumn.tsx`](/packages/web/src/feature/FeatureColumn.tsx)).
- [`layout/Panes.tsx`](/packages/web/src/layout/Panes.tsx): a list and its detail, the detail 40%
  and at least 400 px; the decisions page passes its own columns (`decisions/useSplit.ts`).
- [`feature/FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx): a plain `Page`, so its
  Next, Sessions, and Timeline panes fill the default column.

### Measured widths

Measured in the sandbox (`vp run sandbox`), with Chromium at each window width, the sidebar open.
The UI font's character is 9.6 px.

| Page                                   | 1920 px window               | 1100 px window | 800 px window |
| -------------------------------------- | ---------------------------- | -------------- | ------------- |
| Round: context panes                   | 692                          | 692            | 671           |
| Round: question cards, split           | 1,424                        | one column     | one column    |
| Spec, plan, documents, proposal: panes | 692                          | 571            | 271           |
| Spec: decision cards                   | 865                          |                |               |
| Feature: Next, Sessions, Timeline      | 974                          | 571            | 271           |
| Feature: its side column's panes       | 562                          | 362            | 362           |
| Inbox, Settings, Sessions: panes       | 1,123                        | 971            |               |
| Home: two columns of panes             | 552 each                     | 476 each       |               |
| New: three cards, then two panes       | 365 each, then 554 each      | 314, then 478  |               |
| Decisions: list and reader             | 643 and 757                  | 445 and 574    |               |
| Priorities: columns                    | 500 each, the window's width | 500 each       |               |
| Phone, 400 px: every pane              | 384, the screen's width      |                |               |

What the numbers show:

- **The feature page.** At 1920 px, Next's button is 940 px wide for two words, and the side
  column's panes are 562 px wide for two rows of figures. At 800 px, the page keeps 271 px, less
  than its side column's 362 px, and under the guides' 400 px least for a column of rows.
- **Plain pages.** Inbox, Settings, and Sessions panes are 1,123 px wide, 117 characters of the UI
  font. A setting's description runs over 100 characters a line, prose set in the UI font.
- **Documents beside the side column.** At 800 px, a spec's and a plan's panes are 271 px wide:
  their prose reads about 25 characters a line, a third of the measure. At 1000 px, about 49.
- **The 1024 px jump.** A plain page grows from 720 to 1200 px at 1024 px, inside the semi-wide
  class.
- **The round.** Its context is 692 px wide and its cards 1,424 px, two edges on one page. Each
  split card's columns are about 600 and 720 px, whatever they hold: a card with three one-line
  options keeps the same width as a card with a diagram.
- **Titles.** On reading pages, the title and the crumbs sit at the page column's left edge, 1,051
  px wide at 1920 px, while the panes under them are centred at 692 px.

### The proposal's path and existing actions

- **Opening a feature**: its page draws Next, Sessions, Timeline, the record and notes, and the side
  column with Produced so far and Links. Every pane of the page fills the default column.
- **Reading a round**: the opening and context panes are one reading pane wide, centred; each card
  is two, split from 840 px.
- **Resizing the side column**: a drag keeps the width for every document page and the feature page,
  under `uraeda.documentColumn`. A width kept from before the change must still be read.
- **Folding the side column** with `]`: the page takes the room back. A centred page stays centred
  on the screen (`useScreenCentre`).
- **Choosing columns or one list on Priorities** (`v`): the list is 80 UI characters and its room.
  Unchanged by any option.
- **Fonts and reading size**: the reading measure follows the font picked
  ([Reading](/specs/ui/reading.md#fonts-by-role)), so a reading pane is 692 px only at the default
  font and size. A width set in `ch` of the UI font follows the UI font instead.

### Rules and their owners

- **The reading measure**, about 80 characters of prose: `--size-reading-measure` in `theme.ts`,
  copied as `--size-reading-pane`, `--pane-prose`, and in `QuestionCard.tsx`'s text width.
- **A page's column**: `--size-page-max` in `theme.ts`, used by `Page.tsx` and `Shell.tsx`.
- **A round's width**: `Page.tsx`'s `paired`, computed from `--pane-prose` again.
- **The side column's width**: `documentColumnWidth.ts`, with a session's own limits.
- **Columns of rows, 400 px at least**: `--size-pane-min` in `theme.ts`, and the priorities' 500 px
  in their own files ([Reading](/specs/ui/reading.md#line-length)).
- **The three width classes**: `useWidthClass.ts`. The theme's `lg` rule is a fourth breakpoint,
  outside it.

### Likely changes

Under every option:

- [`theme/theme.ts`](/packages/web/src/theme/theme.ts): the widths, renamed to the scale or not, and
  the `lg` rule of `--size-page-max`.
- [`layout/Page.tsx`](/packages/web/src/layout/Page.tsx): a page's width by its kind.
- [`feature/FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx) and
  [`feature/FeatureColumn.tsx`](/packages/web/src/feature/FeatureColumn.tsx).
- [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx), with the round's options.
- [`specs/ui/reading.md`](/specs/ui/reading.md), [`wide.md`](/specs/ui/wide.md),
  [`semi-wide.md`](/specs/ui/semi-wide.md), and
  [`space-and-motion.md`](/specs/ui/space-and-motion.md): the guides that state today's widths.

With a scale for every page ([the rule](#the-rule)):

- Every page that draws `Page` without a flag: `InboxPage`, `Home`, `RepositoryPages`, `FilePage`,
  `StoryPage`, `CommitPage`, `NewPage`, `SessionPage`, `TriagePage`, `decisions/CheckPage`,
  `decisions/BranchDecision`, `sign-in/SignInPage`, `settings/SettingsView`, and
  `feature/FeaturePage`.
- [`spec/DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx), with the decision cards'
  option.
- [`specs/decisions/ui-layout.md`](/specs/decisions/ui-layout.md), with the decision option.

With a narrower side column by default:
[`layout/documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts).

Tests that guard widths the feature may change:

- [`__tests__/columnWidth.test.ts`](/packages/web/src/__tests__/columnWidth.test.ts) and
  [`__tests__/document-column.test.ts`](/packages/web/src/__tests__/document-column.test.ts): the
  side column's auto width and its limits.
- No test checks a page's or a pane's width: only review does.

### Features in flight

- [Performance pass](/specs/2026-10-29-performance-pass/proposal.md), in implementation, changes
  `App.tsx`, `InboxList.tsx`, and the lists' cards, not their widths.
- [Onboarding and README](/specs/done/2026-10-30-onboarding-readme.md) adds a home `Setup` pane,
  which takes the home's width.
- The phone-bottom change, merged, rewrote `FeaturePage.tsx` and `FeatureColumn.tsx`: this branch
  starts after it.

## The proposal

### "Feature panes are too large"

The feature page has no width of its own: it takes every plain page's 1200 px column. Its panes hold
short content, a sentence and a button, a list of sessions, a timeline of steps. Its side column
takes a third of the window for two rows of figures and a branch name.

### "Some questions panes are too big"

The proposal does not say which. The measured candidates: the split card, two reading panes wide
whatever it holds; and a card holding a mockup or a story, which takes the page's whole column. The
earlier choice, "a round widens to two panes, so a question's card can hold the question beside its
answers", is in [Wide screens](/specs/ui/wide.md#the-frame).

### "Based on clear rules"

The proposal does not say where the rules live. The binding ones would go in the
[UI layout](/specs/decisions/ui-layout.md) decision, which today says three width classes and 80
characters for prose, but nothing on other panes. The guides hold the widths themselves.

### Overlays and the phone

"All panes sizes" could include dialogs, pickers, and the detail overlay, which are layers, not
panes. On the phone, every pane is already the screen's width, as the
[UI look](/specs/decisions/ui-look.md) decision asks.

## Worth it and feasibility

Cheap and contained: theme tokens, `Page`'s flags, three components, and the guides. No data, no
server, no dependency. The gain is the coherence the [UI guides](/specs/ui/README.md) rank third,
and fewer one-off widths for agents to guess. Risks: every page changes width at once, so the plan
reviews each at the three classes, and widths kept in the browser for the side column must stay
readable. Nothing relies on outside behaviour that is not already in use, and no guard is relaxed.

## Approaches

Criteria: the [UI principles](/specs/ui/README.md#the-principles-by-priority) (readable first,
coherent, no void), the [UI layout](/specs/decisions/ui-layout.md) decision (three width classes, 80
characters of prose, foldable and resizable columns), the
[UI components](/specs/decisions/ui-components.md) decision (sizes as theme tokens), and WCAG 1.4.8.

### The rule

How a page and its panes get their width.

| Option                                                | Coherence                       | Change           | Fits short content             |
| ----------------------------------------------------- | ------------------------------- | ---------------- | ------------------------------ |
| A. A short scale of named widths, each page picks one | one edge per kind of page       | every plain page | yes, by picking a narrow width |
| B. Fix the outliers only: feature page, cards, `lg`   | today's rules, fewer exceptions | a few files      | only where fixed               |
| C. Each pane fits its content, up to a cap            | panes of one page differ        | every pane       | yes, but edges jump            |

Sources: [what they have in common](#what-they-have-in-common), [measured widths](#measured-widths).

### Width of a single-column page of rows

Inbox, Settings, Sessions, Commit, a file, the feature page: pages of rows, not prose.

| Option                             | Width at 1920 px | Rows' text        | Same edge as documents |
| ---------------------------------- | ---------------- | ----------------- | ---------------------- |
| A. One reading pane                | 692 px           | 72 UI characters  | yes                    |
| B. A rows width, 100 UI characters | about 960 px     | 100 UI characters | no                     |
| C. Today's column                  | 1,200 px         | 117 UI characters | no                     |

Polaris' narrow page is 662 px, its default 998 px; GitLab's 960 px for lists
([Polaris](#shopify-polaris), [GitLab](#linear-notion-obsidian-gitlab-confluence)).

### The side column's default width

| Option                                         | At 1920 px | At 800 px |
| ---------------------------------------------- | ---------- | --------- |
| A. 400 px until dragged                        | 400        | 400       |
| B. Today: a third of the window, 400 to 600 px | 600        | 400       |

Primer's panes are 240 to 320 px, Material's 360 to 412 dp ([Primer](#github-primer),
[Material](#material-3-and-android)).

### The side column on semi-wide screens

At 800 px, the side column leaves a spec, a plan, or the feature page 271 px for its panes, about 25
characters of prose a line.

| Option                                                                | Page's panes at 800 px | Guides                                            |
| --------------------------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| A. The column folds to its rail when the page would keep under a pane | about 620 px           | departs from "the side column stays" at semi-wide |
| B. The feature page's column goes under its panes; documents as today | 670 and 271 px         | departs for the feature page only                 |
| C. Today                                                              | 271 px                 | under the 400 px least                            |

Material puts a supporting pane under the content on compact windows
([Material](#material-3-and-android)).

### The question card's width

| Option                                                    | Card at 1920 px | Columns' text              |
| --------------------------------------------------------- | --------------- | -------------------------- |
| A. Split, each column at a multi-column measure, 50 to 60 | about 1,100 px  | about 50 and 60 characters |
| B. One reading pane, options under the question           | 692 px          | 80 characters              |
| C. Today: two reading panes                               | 1,424 px        | about 60 and 75 characters |

Bringhurst gives 40 to 50 characters for text in several columns ([line length](#line-length)).

### The spec's decision cards

| Option                       | Width  |
| ---------------------------- | ------ |
| A. One reading pane          | 692 px |
| B. Today: 1.25 reading panes | 865 px |

### Where the rules live

| Option                                                        | Binding       | Agents find it    |
| ------------------------------------------------------------- | ------------- | ----------------- |
| A. A rule in the UI layout decision, the widths in the guides | yes, one rule | from the decision |
| B. The guides only                                            | no            | from `specs/ui/`  |

### Needs no choice

- **A way to widen a page**, as Notion and Obsidian have: Priorities already has its own switch, and
  no page here holds wide tables or diffs; left for a later request.
- **The phone**: every pane is already the screen's width.
- **The 1024 px breakpoint**: the decision allows three width classes only.
- **Titles aligned with their panes**: follows from the page's width once a page has one.

## Not checked

- Material's official pages on pane widths (m3.material.io returned 404 or needed JavaScript); the
  values come from AndroidX's source.
- Atlassian's grid values, seen only in a search snippet.
- Notion's default page width, which no source gives.
- Linear's documentation of its side panel (404).
