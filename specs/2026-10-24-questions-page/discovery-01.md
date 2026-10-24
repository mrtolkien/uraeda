# Discovery, round 01: Questions page in the terminal look

## Summary

A round of questions is a long, structured document the human reads once and answers in place. Tools
that put a chat beside a document (VS Code, Zed, JetBrains) dock it in a side column opposite the
navigation, resizable, and let it grow into a full editor tab when the column is too narrow.
Neovim's edgy.nvim stacks several views in one side bar, each under a title bar, collapsible and
pinned. Documentation sites mark kinds of text with titled, coloured callouts and keep an outline
beside the page that follows the scroll.

The proposal asks for the questions page in the terminal look the layout-look feature set: a
distinct look for the round's opening, the question's text always in view, "Example", "Why it
matters", and "Check these" drawn with weight, navigation second, and the session in the right
column as tabs beside the navigation. It also asks for lists that waste less width on the phone.

Today the page is the old look inside the new shell: a callout and plain headings for the opening,
Astryx cards for questions, a sticky header on the phone only, a 240 px index column on wide
screens, and "Ask the agent" leaving for the session's page. The session's page scrolls the window,
so drawing it in a column needs its scroll and its place-keeping moved to the column. The layout
decision's rule that a followed view is a page of its own stands against a session in a column.

## How other products do it

### Neovim: edgy.nvim and LazyVim

- edgy "easily create[s] and manage[s] predefined window layouts". It has four edge bars, left,
  bottom, right, and top, each a list of views ([edgy.nvim](https://github.com/folke/edgy.nvim)).
- Several views on one edge stack in that bar, each under its title in a window bar (`winbar`). A
  view can start `collapsed` to its title, and a `pinned` view keeps its title in the bar while it
  has no window ([edgy.nvim](https://github.com/folke/edgy.nvim)).
- A view's `size` is a minimum, 30 columns on the side edges by default. Edge bars do not resize
  like normal windows: edgy adds `<c-w>>` and `<c-w><` for the width, and `<c-w>=` to reset
  ([edgy.nvim](https://github.com/folke/edgy.nvim)).
- LazyVim's set-up stacks the file tree, buffers, git status, and symbols on the left, each pinned
  with its title. Its right edge holds a search-and-replace panel at 40% of the width, and its
  bottom edge a terminal at 40% of the height
  ([LazyVim's edgy extra](https://www.lazyvim.org/extras/ui/edgy)).
- aerial.nvim, the outline used in such a bar, marks the symbol nearest the cursor, and jumps with
  `{` and `}` ([aerial.nvim](https://github.com/stevearc/aerial.nvim)).

edgy has no tabs: views on one edge stack. "Tabs beside the navigation", the proposal's words, are
closer to a JetBrains tool window (below) drawn in edgy's titled bars. Judgement.

### VS Code

- The Secondary Side Bar sits opposite the Primary Side Bar, and "by default, contains the Chat
  view" ([user interface](https://code.visualstudio.com/docs/getstarted/userinterface)). It toggles
  with Ctrl+Alt+B, and views can be grouped by dropping one onto another
  ([custom layout](https://code.visualstudio.com/docs/configure/custom-layout)).
- Chat also opens as an editor tab, inline in the editor, or as a quick chat. Context is attached
  explicitly with `#` mentions; the docs advise "Attach important files explicitly"
  ([Copilot chat](https://code.visualstudio.com/docs/copilot/chat/copilot-chat)).
- Neither page documents a side bar's maximize or its narrow behaviour.

### Zed

- The agent panel docks at a side, 640 px wide by default when it is not `flexible`
  ([all settings](https://zed.dev/docs/reference/all-settings)).
- A selection in a buffer goes into the thread with one command, "agent: add selection to thread"
  ([agent panel](https://zed.dev/docs/ai/agent-panel)).

### JetBrains

- AI Chat is a tool window on the right toolbar, and "Show Chats in Editor Tabs" moves a chat into
  an editor tab "for more space"
  ([AI chat](https://www.jetbrains.com/help/ai-assistant/ai-chat.html)).
- One tool window holds several views as "tabs or a dropdown selector in the header", and
  Alt+Left/Right cycles them
  ([tool windows](https://www.jetbrains.com/help/idea/tool-windows.html)).

### Documentation sites

- GitHub alerts draw `> [!TYPE]` "with distinct colors and icons", and advise one or two per page,
  never back to back
  ([GitHub's formatting](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)).
- Obsidian callouts have 13 types, each a colour and a Lucide icon, foldable with `+` or `-`
  ([Obsidian callouts](https://obsidian.md/help/callouts)). MkDocs Material has 12, with an
  "example" and a "question" type
  ([admonitions](https://squidfunk.github.io/mkdocs-material/reference/admonitions/)).
- MkDocs Material scrolls its outline to keep the active heading visible (`toc.follow`), and keeps
  its tabs below the header while the page scrolls (`navigation.tabs.sticky`)
  ([navigation](https://squidfunk.github.io/mkdocs-material/setup/setting-up-navigation/)).

### What they have in common

- The chat docks opposite the navigation, resizable, and can grow to a full tab for more room.
- What the chat is about is attached explicitly: a mention, an "add selection" command, a button.
- Long documents mark each kind of text with a titled, coloured block and an icon.
- An outline beside the page marks where the reader is.

## Standards and libraries

### CSS: sticky positioning and lists

- `position: sticky` sticks to the nearest scrolling ancestor, and only "until meeting the opposite
  edge of its containing block": a header sticky inside its question's card stops with the card
  ([MDN, position](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)).
- Browsers set `padding-inline-start: 40px` on lists by default; outside markers hang outside the
  item's content box ([HTML rendering](https://html.spec.whatwg.org/multipage/rendering.html),
  [MDN, indenting lists](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Lists/Indenting)).
- `::marker` takes no padding or margin, so the gap between a bullet and its text is set by the
  item, not the marker
  ([MDN, ::marker](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::marker)).

### WAI-ARIA: tabs, splitters, landmarks

- Tabs are a labelled `tablist` of `tab`s, each pointing at its `tabpanel`; arrows move between tabs
  ([APG tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)).
- A resizable split is a focusable `separator` with a value, moved by arrows, Enter collapsing it
  ([APG window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)).
- Several `complementary` landmarks each need a unique label
  ([APG complementary](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/complementary.html)).

### Astryx

- The right column today is Astryx's `Layout` with a `LayoutPanel` and a `ResizeHandle`, kept
  between 280 and 560 px ([`SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx)).
- Lists are Astryx's `List` and `ListItem`, which draw their own markers in a hanging column
  ([`Blocks.tsx`](/packages/web/src/Blocks.tsx)).

## The code

### Important reads

- [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx): the page. Its opening, its question cards, its
  settled points, and Submit, with the index beside them on wide screens. It serves feature rounds
  and the two default-branch rounds, the inbox triage and the decisions check
  ([`TriagePage.tsx`](/packages/web/src/TriagePage.tsx),
  [`CheckPage.tsx`](/packages/web/src/decisions/CheckPage.tsx)), which have no session.
- [`RoundOpening.tsx`](/packages/web/src/RoundOpening.tsx): the crumbs, the title, the block as a
  generic callout, then the four context parts as plain headings. Nothing marks a part's kind.
- [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx) and
  [`Question.tsx`](/packages/web/src/Question.tsx): an Astryx `Card` on wide and semi-wide screens,
  in two columns from 840 px (`--size-round-split`). The header sticks only on the phone. "Why it
  matters" is a muted box; the round's "Example:" line is a plain paragraph of the context.
- [`RoundNav.tsx`](/packages/web/src/RoundNav.tsx), 331 lines: the count, Next or Submit, the index
  with the question at the top marked, and `n` and `p`. On the phone, the count in the top bar opens
  the index in a sheet. It is near the project's file limit
  ([code quality](/specs/decisions/code-quality.md)): a session tab beside it is a new file.
- [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx) and
  [`SettledGroups.tsx`](/packages/web/src/SettledGroups.tsx): the three groups as headings with
  bullets, each point with a comment form.
- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx): `?ask=<quote>` fills the composer with a
  quote. Its transcript follows the window's scroll:
  [`following.ts`](/packages/web/src/following.ts) can follow a scrolling box, but
  [`useKeepPlace.ts`](/packages/web/src/useKeepPlace.ts) and
  [`Transcript.tsx`](/packages/web/src/Transcript.tsx) read and set `window` directly.
- [`SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx): the session page's "Progress" column,
  resizable, foldable with `]`, its width kept in the browser.
- [`Blocks.tsx`](/packages/web/src/Blocks.tsx): every round's markdown. Callouts are a coloured bar,
  lists Astryx's `List`.
- [`useReviewActions.ts`](/packages/web/src/useReviewActions.ts): the spec page already asks the
  agent about a selection of lines, through the same `askAbout`.

### The proposal's path and existing actions

Measured in the sandbox (`vp run sandbox`) at 1440, 1205, and 390 px:

- **Reading the opening.** The block is a callout with a bar; Goal, Today, Scope, and Sources are
  headings over paragraphs, in the reading font. At 390 px a list's text starts 28.8 px right of a
  paragraph's, and a list inside the block's callout starts 47 px in: the proposal's note on
  bullets.
- **Answering.** At 1440 px the card splits in two; the question's title scrolls away with its
  context while the options are read. At 1205 px the same. On the phone the header sticks below the
  tabs.
- **Asking the agent.** "Ask the agent" calls `askAbout`, which navigates to the session's page with
  the question quoted in its composer. The round is left; Back returns to it, at its place
  ([`useRoundPosition.ts`](/packages/web/src/useRoundPosition.ts)).
- **Navigating.** `n` and `p` jump between unanswered questions on wide screens; the status line
  names them. The index marks the question at the top.
- **Submitting, an answered round, a round with stories.** Submit saves pending comments first. An
  answered round is read-only, with no index. A question whose options hold stories never splits.
  None of these change with the look; each must keep working in the new card.
- **The feature's agent unavailable, or a default-branch round.** No "Ask the agent", and so no
  session tab.

### Rules and their owners

- **How reading text draws**: [`Prose.tsx`](/packages/web/src/Prose.tsx), by the
  [UI coherence](/specs/decisions/ui-coherence.md) decision. The new blocks for "Example" and "Why
  it matters" draw their text through it.
- **How a callout draws**: `Blocks.tsx`, for every document. A new look for the round's block either
  changes every callout, or is a round-only part, which the coherence decision allows only with a
  reason in the plan.
- **The width classes**: [`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts), by the
  [UI layout](/specs/decisions/ui-layout.md) decision.
- **What the status line names**: [`statusHints.tsx`](/packages/web/src/statusHints.tsx); only keys
  that work.

### Likely changes

- `RoundPage.tsx`, `RoundOpening.tsx`, `QuestionCards.tsx`, `QuestionCard.tsx`, `Question.tsx`,
  `SettledPoints.tsx`, `SettledGroups.tsx`: the new look, under every option.
- `RoundNav.tsx`: the outline as a pane in the right column. A new file for the column's tabs or
  stack, with options A or B of [where the session opens](#where-the-session-opens).
- `SessionPage.tsx`, `Transcript.tsx`, `useKeepPlace.ts`, `following.ts`: a session drawn in a
  column, scrolling on its own, with any option but today's page.
- `SideColumn.tsx`: tabs or stacked views, a wider session width, and the half screen's cover, with
  [the half screen](#the-half-screen).
- `Blocks.tsx` or `Prose.tsx`: lists' indent on the phone; the callout's look if the round's block
  shares it.
- `specs/decisions/ui-layout.md`: with any option but today's page.
- The round's browser tests ([`round.test.tsx`](/packages/web/src/__browser__/round.test.tsx),
  [`round-cards.test.tsx`](/packages/web/src/__browser__/round-cards.test.tsx)) and stories.

## The proposal

### Tabs beside the navigation, like edgy

edgy stacks views on an edge; it has no tabs. The proposal's "tabs" and its "like edgy.nvim" are two
shapes: a tab bar that swaps the outline for the session, or two stacked, titled views, the outline
folding to its title. Both are drawn in the prototype.

### The session in a column against the layout decision

The [UI layout](/specs/decisions/ui-layout.md) decision says "a view the human follows SHOULD be a
page of its own", because a session "squeezed into a pane beside its list, was too narrow to
follow". A session in the right column goes against that SHOULD. The same column at 38% of a 1440 px
window is about 550 px, wider than the 320 px aside that rule was written about.

### Half a screen

At 1205 px, the human's half screen, a 460 px session leaves about 690 px to the round: one column
of options, about 60 characters a line. The proposal does not say whether the page then narrows or
the session covers it.

### Lists on the phone

The proposal's note asks for bullets that waste less width. The waste is 28.8 px at the first level,
and 47 px inside the block's callout, out of 352 px of text.

### What the session is asked about

The proposal asks about "a question". The spec page already asks about any selected lines, and a
settled point under "Check these" is what the human most often objects to. The proposal is silent on
both.

### What the spec page reuses

The [spec page draft](/specs/2026-10-24-spec-page/proposal.md) wants "the session beside the page as
on the questions page", and the [chat's right column draft](/specs/drafts/chat-right-column.md)
wants the session in a side column on every step. The shape chosen here becomes theirs.

## Worth it and feasibility

The human spends most of their time on this page, and every part of it exists: the work is the look,
the column, and moving the session's scroll into a box. No new dependency, no server change. Worth
it.

- **Outside behaviour**: sticky headers inside a card stop at the card's end, checked in the
  prototype in Chromium; not checked in WebKit or Firefox. The transcript scrolling in a box is not
  checked: `following.ts` supports it, the two window-bound files need a change.
- **No guard is relaxed.**

## Approaches

Criteria come from the proposal (question in view, readable context, "Check these" weighted,
navigation second, a session that "reads well"), the constitution's IV (review effort matches
impact), and the active [UI layout](/specs/decisions/ui-layout.md),
[UI look](/specs/decisions/ui-look.md), [UI coherence](/specs/decisions/ui-coherence.md), and
[UI behaviour](/specs/decisions/ui-behaviour.md) decisions.

### Where the session opens

Where the session draws on wide and semi-wide screens. Relies on
[edgy and LazyVim](#neovim-edgynvim-and-lazyvim), [JetBrains](#jetbrains), and
[the session's page](#important-reads).

| Option                                                                       | Question in view      | Session's room                     | Outline in view            | Cost                            |
| ---------------------------------------------------------------------------- | --------------------- | ---------------------------------- | -------------------------- | ------------------------------- |
| A. Right column, tabs Outline and Session; the column widens for Session     | yes, beside           | about 38% of the window, resizable | one click away             | a tab bar, the session in a box |
| B. Right column, stacked: the outline folded to its title, the session under | yes, beside           | same, minus two title bars         | its title and Next, always | a stack, the session in a box   |
| C. A split under the page and the outline, about 44% of the height           | yes, above            | the window's width, few lines      | yes                        | a split, the session in a box   |
| D. Today's page of its own                                                   | no: the round is left | the whole page                     | no                         | none                            |

### The half screen

Only with A or B of [where the session opens](#where-the-session-opens). Relies on
[half a screen](#half-a-screen).

| Option                                                   | Question's width at 1205 px | Covered                 |
| -------------------------------------------------------- | --------------------------- | ----------------------- |
| A. The column pushes the page, as on wide screens        | about 690 px                | nothing                 |
| B. The session covers the page's right part, as the rail | about 900 px under it       | the options' right part |

### The layout decision

What the [UI layout](/specs/decisions/ui-layout.md) decision says about a session beside a page.
Relies on
[the session in a column against the layout decision](#the-session-in-a-column-against-the-layout-decision)
and [what the spec page reuses](#what-the-spec-page-reuses).

| Option                                                                           | Reach                           |
| -------------------------------------------------------------------------------- | ------------------------------- |
| A. A feature's session MAY open beside any of its documents, in the right column | questions, spec, plan, later    |
| B. Only beside a round of questions                                              | this page; each later page asks |
| C. No change: the session stays a page                                           | none                            |

### The round's visual language

How the opening, "Example", and "Why it matters" show their kind. Relies on
[documentation sites](#documentation-sites) and the [UI look](/specs/decisions/ui-look.md)
decision's titled panes.

| Option                                                                                 | Kinds told apart               | Width on the phone          | Coherence                           |
| -------------------------------------------------------------------------------------- | ------------------------------ | --------------------------- | ----------------------------------- |
| A. Titled panes: the block with a verdict badge, each context part a pane with an icon | by border, title, icon, colour | panes lose their sides      | round-only parts, named in the plan |
| B. A sign column: a glyph per paragraph kind in a gutter, like Neovim's                | by glyph and colour            | the gutter takes about 3 ch | round-only parts                    |
| C. Today's callout and headings, recoloured                                            | by heading only                | as today                    | shared callout                      |

### Keeping the question in view

Relies on [CSS sticky](#css-sticky-positioning-and-lists).

| Option                                                                            | Works at               | Limit                                              |
| --------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| A. The card's header sticks at the top while its card is on screen                | every width            | takes two or three lines of height                 |
| B. On a split card, the left column (title and context) sticks beside the options | wide, card over 760 px | a left column taller than the screen hides its end |
| C. Today: sticky on the phone only                                                | the phone              | the title scrolls away on desktop                  |

### The weight of "Check these"

| Option                                                                    | Weight           | Reading order         |
| ------------------------------------------------------------------------- | ---------------- | --------------------- |
| A. A strong peach pane at the end; Behaviour plain, Under the hood folded | high, at the end | as the file           |
| B. The same pane before the first question                                | highest          | differs from the file |
| C. Today: three equal headings                                            | equal            | as the file           |

### What the session can be asked about

Relies on [what the session is asked about](#what-the-session-is-asked-about).

| Option                                             | Entry points           | Cost                            |
| -------------------------------------------------- | ---------------------- | ------------------------------- |
| A. Each question, and each settled point           | two buttons, one quote | small                           |
| B. Each question only, as today                    | one                    | none                            |
| C. Any selection of the round, as on the spec page | every block            | the spec page's selection, here |

### Needs no choice

- **The outline following the scroll**: exists ([`RoundNav.tsx`](/packages/web/src/RoundNav.tsx));
  it moves into the right column's pane.
- **Lists on the phone**: a tighter hanging indent, a choice of measure the proposal's note already
  asks for.
- **The session on the phone**: the [UI layout](/specs/decisions/ui-layout.md) decision makes views
  pages on narrow screens; the page exists.
- **Growing the session to a full page**: the session's page exists; a link from the column reaches
  it, as JetBrains' "editor tab" does.
- **The open tab in the address**: the layout decision's "An open detail, tab, or sheet MUST be in
  the URL" decides it.
- **Default-branch rounds**: they have no session, so they draw the new look with the outline alone.

## Not checked

- JetBrains' page on asking in chat returned 404, so its selection context is not verified.
- Zed's dock position setting was past what was read of its settings page.
- VS Code's and Docusaurus' pages say nothing of a maximized side bar, a narrow side bar, or an
  outline's mobile behaviour.
- The prototype in WebKit and Firefox, and inside Uraeda's own mockup frame.
