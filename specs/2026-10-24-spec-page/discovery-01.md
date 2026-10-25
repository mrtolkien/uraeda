# Discovery, round 01: Spec and plan pages in the terminal look

## Summary

A document reviewed for approval, in established products, reads as a rendered page with an outline
beside it. Comments attach to a selection or a block, gather as drafts, and leave with a verdict:
approve, request changes, or comment only. Tools that review revisions show what changed since the
reviewer's last pass. Agent tools add a chat beside the document that takes a quoted selection, and
show a plan as checkable tasks with their progress. Products differ most on how a change is drawn:
inline or side by side, by line, word, or block.

The proposal asks for the spec, the plan, and the data model in the terminal look of
[layout and look](/specs/done/2026-10-20-layout-look.md). Decision changes come first and most
visible, live mockups are framed as embeds, and navigation, comments, and the session sit beside the
page as on the questions page.

Today the spec page already draws each part of the format its own way, and the core computes each
decision's change word by word. It draws them in Astryx cards of the old look, beside a "Contents"
column that hides below 1100 px. A plan waiting for review is generic blocks with task badges, and
an approved plan loses even those. Live mockups are scaled iframes with a phone bezel and no desktop
frame. "Ask the agent" leaves for the session's page. The questions page, in implementation on its
branch, builds the right column of tabs this feature reuses.

## How other products do it

### Kiro

- A spec is three files: `requirements.md`, `design.md`, and `tasks.md`. Requirements use EARS,
  "WHEN [condition] THE SYSTEM SHALL [behavior]" ([Kiro specs](https://kiro.dev/docs/specs/),
  [feature specs](https://kiro.dev/docs/specs/feature-specs/)).
- Its Markdown Review opens a rendered document with a Comments panel and a document outline that
  marks the current section. Mermaid diagrams zoom and pan; wide tables scroll sideways
  ([Markdown review](https://kiro.dev/docs/ide/editor/markdown-review/)).
- A comment attaches to a selected passage, which it quotes. The panel groups comments under their
  nearest heading. "Send N to Kiro" sends them all, with their quotes, to the latest chat
  ([Markdown review](https://kiro.dev/docs/ide/editor/markdown-review/)).
- On a revision, a comment whose passage is gone is marked "document updated"; no diff view is
  described. Unsent comments are lost on reload
  ([Markdown review](https://kiro.dev/docs/ide/editor/markdown-review/)).
- Tasks show their status live, run one by one or in dependency waves with "Run all", and are
  audited through their diffs ([Kiro specs](https://kiro.dev/docs/specs/),
  [introducing Kiro](https://kiro.dev/blog/introducing-kiro/)). A third party reports "Task in
  progress" and "View changes" on each task
  ([Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).
- Böckeler found Kiro's specs "way too verbose for the small bug", and Spec Kit's "verbose and
  tedious to review". A good tool "would have to provide a very good spec review experience"
  ([Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).

### GitHub pull requests

- Comments attach to a line, a range, or a file. They stay pending until the review is submitted
  with one of Comment, Approve, or Request changes
  ([reviewing changes](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)).
- A file marked **Viewed** folds, and loses the mark when it changes again; a bar counts viewed
  files
  ([reviewing changes](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)).
- The rich diff of a prose file draws removed text struck on red, and added text on green. It cannot
  be commented on: comments are in the source view only, line by line
  ([non-code files](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files)).
- No official page describes a "changes since your last review" view. Bitbucket has one, per its
  blog ([iterative review](https://www.atlassian.com/blog/bitbucket/iterative-review), search
  snippet only).

### Spec Kit

- Spec Kit's spec has prioritized user stories with "Why this priority" and Given/When/Then
  scenarios, edge cases, numbered requirements, and measurable success criteria
  ([spec template](https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md)).
- Its tasks are checkboxes with an ID, a `[P]` mark for parallel tasks, a story label, and exact
  paths, in phases ending with checkpoints
  ([tasks template](https://raw.githubusercontent.com/github/spec-kit/main/templates/tasks-template.md)).
- It has no review UI: each step is reviewed in the agent's chat
  ([Spec Kit](https://github.com/github/spec-kit)).

### Google Docs, Notion, Linear, and Confluence

- Google Docs attaches comments to highlighted text, hides resolved ones, and moves between comments
  with J and K ([comments](https://support.google.com/docs/answer/65129)). Suggesting mode draws
  additions in colour and deletions struck through
  ([suggestions](https://support.google.com/docs/answer/6033474)). Its outline is built from
  headings ([outline](https://support.google.com/docs/answer/6367684)).
- Notion comments a selection, a block, or the page, in the margin
  ([comments](https://www.notion.com/help/comments-mentions-and-reminders)). Its history highlights
  changes but "doesn't capture every change"
  ([history](https://www.notion.com/help/duplicate-delete-and-restore-content)).
- Linear Docs mark sections an agent edited with blue lines in the margin, keep agent edits as
  checkpoints, and send a selection to the chat with "Add to chat"
  ([documents](https://linear.app/docs/documents)).
- Confluence resolves an inline comment whose text was cut and pasted, removing it from the page
  ([inline comments](https://support.atlassian.com/confluence/kb/keep-inline-comments-while-editing-confluence-pages/)).

### GitBook change requests

- A change request shows changed pages split, before left and after right, or inline. A floating
  navigator moves between changed blocks and ends with the review actions
  ([change requests](https://gitbook.com/docs/collaboration/change-requests)).

### Code review tools, between revisions

- Gerrit compares any old patch set with the current one, and marks each file "Reviewed"
  ([review UI](https://gerrit-review.googlesource.com/Documentation/user-review-ui.html)).
- Reviewable keeps "reviewed" marks per file and revision, so they lapse when a newer revision
  arrives ([reviews](https://docs.reviewable.io/reviews)).
- Phabricator carries old comments forward as "ghost" comments, and warns that their place can be
  wrong
  ([inline comments](https://secure.phabricator.com/book/phabricator/article/differential_inlines/)).

### Agent tools' plans

- Cursor's plan mode writes a plan with to-dos in an inline editor, built with one button
  ([plan mode](https://cursor.com/blog/plan-mode)). Plans written another way open as plain
  Markdown, without the to-dos, which users report as inconsistent
  ([forum](https://forum.cursor.com/t/markdown-build-plan-inconsistent-edit-preview-mode/158313)).
- Claude Code's plan mode offers "Yes" with auto or manual edits, or "No, keep planning"
  ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- Windsurf's plan file has an **Implement** button
  ([Cascade modes](https://docs.devin.ai/desktop/cascade/modes)).

### Prose diffs

- Wikipedia draws changed paragraphs side by side, words highlighted inside, with a − or + in the
  gutter so colour is not the only cue; moved paragraphs get linked arrows
  ([Help:Diff](https://en.wikipedia.org/wiki/Help:Diff)). An inline mode exists since MediaWiki 1.35
  ([MediaWiki diff](https://www.mediawiki.org/wiki/Help:Diff)).
- Word underlines insertions and strikes deletions, with a line in the margin. Word for iPhone has
  no side balloons, only inline marks
  ([track changes](https://support.microsoft.com/en-us/office/track-changes-in-word-197ba630-0f5f-4a8e-9a77-3712475e806a)).
- Draftable compares side by side with synced scrolling, and refuses small screens
  ([Draftable](https://www.draftable.com/compare)).
- git's `--word-diff` finds word changes inside line hunks
  ([git diff](https://git-scm.com/docs/git-diff)).

### Live previews

- Polypane draws each viewport as a plain pane titled with its name and size, and a scale value when
  not at 100%; it draws no device bezel ([panes](https://polypane.app/docs/intro-to-panes/),
  [global zoom](https://polypane.app/docs/global-zoom/)).
- Figma prototypes toggle "Show device frame"; without one, they fit the width or show at 100%
  ([device frames](https://help.figma.com/hc/en-us/articles/360040318013-Choose-a-device-and-model-for-prototypes)).
- tmux puts a pane's title in its border (`pane-border-status`), and draws borders single, double,
  or heavy (`pane-border-lines`)
  ([tmux](https://raw.githubusercontent.com/tmux/tmux/master/tmux.1)).
- Pure CSS bezels, devices.css and its kind, are photoreal and unmaintained since 2023
  ([picturepan2](https://github.com/picturepan2/devices.css),
  [marvelapp](https://github.com/marvelapp/devices.css)).

### What they have in common

1. A rendered reading view with an outline that follows the scroll.
2. Comments on a selection or a block, plus general comments, kept as drafts and sent with the
   verdict.
3. A verdict of approve, request changes, or comment, with comments allowed on an approval.
4. On a revision, what changed since the reviewer's last pass: compared revisions, or highlighted
   additions and removals.
5. A clear state for a comment whose text changed: outdated, "document updated", or a ghost.
6. Moving to the next comment or change from the keyboard.
7. Viewed or reviewed marks per part, lapsing when the part changes.
8. Resolved and unresolved comment threads.
9. Suggested edits the author accepts.
10. A plan as checkable tasks with live status, and actions per task: start, view its changes.
11. A chat beside the document that takes a quoted selection.
12. Live previews in a frame that says what it is, its size, and its scale.

## Standards and libraries

### Diffs: libraries and accessibility

- jsdiff (`diff`, 9.0.0) offers `diffWords`, `diffSentences`, and `diffArrays` with a comparator,
  7.9 kB gzipped ([jsdiff](https://github.com/kpdecker/jsdiff)). diff-match-patch's upstream was
  archived in 2024 ([diff-match-patch](https://github.com/google/diff-match-patch)). No maintained
  Markdown-aware diff exists on npm. None is needed: the core already diffs decisions, below.
- `<ins>` and `<del>` have the roles `insertion` and `deletion`; the strikethrough is presentation
  ([del](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/del),
  [ins](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ins)). JAWS, NVDA, and
  VoiceOver on iOS announce them
  ([TPGi](https://vispero.com/resources/screen-readers-support-for-text-level-html-semantics/),
  [Wikimedia](https://phabricator.wikimedia.org/T245409)).
- Adrian Roselli advises native elements without hidden "[deletion start]" text, a thicker
  strikethrough, and a wavy underline for insertions, so they do not read as links
  ([text-level styles](https://adrianroselli.com/2025/04/tweaking-text-level-styles-reprised.html)).
- WCAG 1.4.1 forbids colour as the only cue: red against green does not count
  ([use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)).

### Storybook embeds and scaled frames

- The project pins Storybook 10.6.2. An embed is `iframe.html?id=<story>&viewMode=story`
  ([embed](https://storybook.js.org/docs/sharing/embed)); viewport globals do not resize an embedded
  iframe, so the host sets the real width (read in Storybook's
  `node_modules/.pnpm/storybook@10.6.2*/dist/preview/runtime.js`).
- A scaled iframe keeps its unscaled layout box, so its wrapper takes the scaled size with
  `overflow: hidden`; `zoom` on an iframe changes its coordinates, `transform` does not
  ([transform](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transform),
  [Chromium on zoom](https://groups.google.com/a/chromium.org/g/blink-dev/c/W8j6RKDeRoM/m/FyCKOAG9AAAJ)).
- An iframe needs a `title`
  ([iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe),
  [H64](https://www.w3.org/WAI/WCAG22/Techniques/html/H64)). At 1440 px into a 700 px column, a
  frame is drawn at 49%, too small to read
  ([scaled blocks](https://css-tricks.com/scaled-proportional-blocks-with-css-and-javascript/)).

### The questions page's column

- The approved questions page spec, `specs/2026-10-24-questions-page/spec.md` on its branch, builds
  a right column of tabs at one width, a third of the window, 400 to 600 px, kept in the browser,
  with the open tab in the address. It owns "where the session sits beside a document, for the spec
  page to reuse".
- The [UI layout](/specs/decisions/ui-layout.md) decision, changed and applied on that branch, adds:
  "A feature's session MAY open beside any of the feature's documents, in the right column, at least
  400 px wide". Its consequence: "The questions, spec, and plan pages share one right column, where
  the session sits as a tab."

## The code

### Important reads

Screenshots of today's spec page, at 1440 and 402 px, were taken with
[`spec-shots.ts`](/packages/web/scripts/spec-shots.ts) and reviewed for this round; they are not
committed.

- [`FilePage.tsx`](/packages/web/src/FilePage.tsx) picks the page: a spec always gets
  [`spec/SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx); a plan waiting for review gets
  [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx); anything else, an approved plan and a
  standalone data model included, gets the generic
  [`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx).
- [`spec/SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx) (298 lines) puts the parts together in
  the format's order: "What you approve", "Your review, answered", decisions, stories, Data, how it
  is built, history, and the verdict. Each part is a [`Panel`](/packages/web/src/spec/Panel.tsx): an
  Astryx card on wide screens, a sticky head with breadcrumbs on the phone. It does not use the
  shell's titled [`Pane`](/packages/web/src/layout/Pane.tsx).
- [`spec/SpecOpening.tsx`](/packages/web/src/spec/SpecOpening.tsx) draws the block: the time and
  risk pills, the "You approve" lead, the other items, and the constitution's principles as badges.
- [`spec/DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx) (391 lines) and
  [`spec/RuleLine.tsx`](/packages/web/src/spec/RuleLine.tsx) draw a decision's change: a kind pill,
  the intent, field changes, unchanged parts folded, removed parts behind a red badge, and words
  added (green, underlined) or removed (red, dotted, never struck). Four other views use the card:
  the decision's branch page, the decisions page's branch change, candidates, and the decisions
  check.
- [`spec/StoryCard.tsx`](/packages/web/src/spec/StoryCard.tsx) draws badges, the journey, the
  mockup, and Given/When/Then rows with icons; more scenarios fold.
- [`spec/BuiltParts.tsx`](/packages/web/src/spec/BuiltParts.tsx) (385 lines) draws architecture
  units and tradeoffs, edge cases by importance with niche ones folded, and success criteria.
- [`spec/DataPart.tsx`](/packages/web/src/spec/DataPart.tsx) draws `data-model.md` inside the spec
  as "Data", one panel per section, its "Change" column as pills. It parses the file's sections in
  the web: the core reads no items from a data model
  ([`items.rs`](/crates/core/src/files/items.rs)).
- [`spec/SpecContents.tsx`](/packages/web/src/spec/SpecContents.tsx) is the "Contents"
  [`SideColumn`](/packages/web/src/layout/SideColumn.tsx), 320 px, with comment counts per part,
  shown from 1100 px only. It imports `jumpTo` from
  [`RoundNav.tsx`](/packages/web/src/RoundNav.tsx), which the questions page's plan deletes.
- [`review/useReview.tsx`](/packages/web/src/review/useReview.tsx),
  [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts), and
  [`Selection.tsx`](/packages/web/src/Selection.tsx): a tap selects a block's lines, a second tap
  extends the selection; the form opens under the block on wide screens, in a sheet on the phone.
  Comments are written to `spec-review.md` or `plan-review.md` by the core
  ([`review.rs`](/crates/core/src/actions/review.rs)).
- [`YourReview.tsx`](/packages/web/src/YourReview.tsx) and
  [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx) draw the verdict at the page's end: the
  comments, a general comment, a summary, the risk tier and plan review choices, and "Request
  changes" or "Approve", each with or without starting the agent.
- [`ReviewCommentForm.tsx`](/packages/web/src/ReviewCommentForm.tsx) offers "Ask the agent" in the
  comment form, except on a decision's lines. It quotes the lines and opens the session's page
  ([`useReviewActions.ts`](/packages/web/src/useReviewActions.ts),
  [`sessions.ts`](/packages/web/src/sessions.ts)).
- [`StoryEmbed.tsx`](/packages/web/src/StoryEmbed.tsx) (369 lines) and
  [`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx) (351 lines) draw a live story: a bar with a
  Phone/Desktop switch, comment and full-screen controls, and a sandboxed iframe. The desktop frame
  is 1440 px scaled to the column, without a frame; the phone frame is 402 px with a bezel on a gray
  stage. [`embedLayout.ts`](/packages/web/src/embedLayout.ts) lets an embed grow past its column
  into empty room.
- [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx): an HTML mockup linked from a spec stays a
  link, which opens its own page with a comment form.
- [`ReviewHeadings.tsx`](/packages/web/src/ReviewHeadings.tsx) gives a waiting plan's task headings
  a `done/total` badge; steps show as ☑ and ☐. The core reads a plan's tasks and steps only
  ([`plan.rs`](/crates/core/src/files/plan.rs)): not its waves, review focus, or test map.
- The core's decision change, [`decisions/change.rs`](/crates/core/src/decisions/change.rs) (400
  lines): each version is cut into parts; two parts match when they keep 60% of the shorter one's
  words, and a matched pair is compared word by word. No diff library is used anywhere.
- The questions page's branch: `SessionView.tsx` and `ColumnSession.tsx` are built there;
  `layout/DocumentColumn.tsx`, its tabs and width, is its Task 4, not started. Asking writes a quote
  that replaces the last one and keeps typed text (its Task 8).
- The sandbox does not build the spec page's fixtures: its specs and plans have no data model and no
  rich decision change ([`samples/projects.ts`](/packages/web/samples/projects.ts)); Storybook and
  the screenshots do ([`.storybook/fixture.ts`](/packages/web/.storybook/fixture.ts)).
- Git history: [redesign specs](/specs/done/2026-10-17-redesign-specs.md) set the page's order, the
  computed decision changes, and tap-anything comments;
  [spec page fixes](/specs/done/2026-10-18-spec-page-fixes.md) the unread items, Data, and the 1100
  px Contents; [layout and look](/specs/done/2026-10-20-layout-look.md) the look and the three
  widths, leaving this page for this feature.

### The proposal's path and existing actions

- **Opening a spec to review**: today the block card, then decisions. With the feature, the same
  order in titled panes, the column of tabs beside it.
- **Reading a decision's change**: today a card per decision, unchanged parts folded. With the
  feature, the look changes; the core's change stays.
- **Looking at a mockup**: today a scaled desktop iframe without a frame, or a phone with a bezel.
  With the feature, every live mockup is framed as an embed.
- **Commenting**: a tap on a block, then the form. Unchanged in function; the comments also gather
  in the column.
- **Asking the agent**: today it leaves for the session's page. With the feature, the session opens
  in the column, the selection quoted, as on the questions page; on the phone it stays the session's
  page.
- **Giving the verdict**: at the page's end today. It stays there; the column may hold it too.
- **A revision**: today "Your review, answered" lists each comment and what was done; nothing marks
  what changed in the spec. The time in the block counts only what changed
  ([spec reference](/skills/uraeda/references/spec.md#revising)), but the page does not show it.
- **An approved spec**: read-only, no verdict. Unchanged.
- **An approved plan**: generic blocks, task badges gone. With the feature, the plan page draws the
  same parts whatever its status.
- **A data model opened alone**: generic blocks. With the feature, the same parts as inside the
  spec.
- **Back and reload**: folds and the place are kept in the history entry
  ([`Folds.tsx`](/packages/web/src/Folds.tsx)); the open tab goes in the address, as the layout
  decision asks.

### Rules and their owners

- **A decision's change**: computed only in the core
  ([`change.rs`](/crates/core/src/decisions/change.rs)), drawn by `DecisionCard` for every page. A
  new look changes the shared card, and every page with it, as the
  [UI coherence](/specs/decisions/ui-coherence.md) decision asks.
- **A data model's sections**: parsed in the web, in `DataPart.tsx`, against the
  [stack](/specs/decisions/stack.md) decision's rule that parsing lives in the core.
- **Where the session sits beside a document**: the questions page's `DocumentColumn`, once built.
- **The quote sent to the session**: `quoted` in [`sessions.ts`](/packages/web/src/sessions.ts),
  plus `withQuote` from the questions page's branch.

### Likely changes

- [`spec/`](/packages/web/src/spec/): every part's look, through the shell's `Pane`.
  [`DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx), at 391 lines, splits before it
  grows, under every option of [the decisions' look](#the-decisions-look).
- [`SpecContents.tsx`](/packages/web/src/spec/SpecContents.tsx): becomes a tab of the questions
  page's column, under every option of [the column](#the-right-column).
- [`StoryEmbed.tsx`](/packages/web/src/StoryEmbed.tsx) and
  [`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx): the frame, under every option of
  [the frame](#framing-live-mockups); [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx) when HTML
  mockups draw inline.
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) and
  [`ReviewHeadings.tsx`](/packages/web/src/ReviewHeadings.tsx): a plan page of its own, with option
  A or B of [the plan page](#the-plan-page).
- [`crates/core/src/files/plan.rs`](/crates/core/src/files/plan.rs): waves and the plan's sections,
  with option A of [the plan page](#the-plan-page).
- [`crates/core/src/files/items.rs`](/crates/core/src/files/items.rs): a data model's sections,
  under every option.
- [`crates/core/src/decisions/change.rs`](/crates/core/src/decisions/change.rs) and
  [`view.rs`](/crates/core/src/view.rs): a spec's change since the reviewed commit, with option A or
  B of [changes since the last review](#changes-since-the-last-review).
- [`YourReview.tsx`](/packages/web/src/YourReview.tsx) and
  [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx): the Review tab, with option A of
  [the column](#the-right-column).
- [`packages/web/samples/`](/packages/web/samples/): the spec page's fixtures in the sandbox.

## The proposal

### Decisions first and most visible

The format already puts the decisions right after the block and "Your review, answered", and the
block names each one. "Most visible" is then a matter of look: the weight of their panes, and how
the change reads. See [the decisions' look](#the-decisions-look).

### A monitor or phone bezel

The proposal offers bezels as an example, "not a requirement". Bezels are drawings with round
corners, against the [UI look](/specs/decisions/ui-look.md)'s square corners, and they cost width;
terminal tools mark a live viewport with a titled border and its size. See
[framing live mockups](#framing-live-mockups).

### Navigation with comments

"Navigation comes second, with comments": today the Contents column counts comments per part, and
the list of comments and the verdict sit at the page's end. Whether the column also lists them, and
holds the verdict, is open. See [the right column](#the-right-column).

### What changed since the last review

The proposal does not mention revisions. Every review product compared offers what changed since the
reviewer's last pass, and the workflow already counts only the changes in a revision's time. This is
a gap in scope. See [changes since the last review](#changes-since-the-last-review).

### The plan page

The proposal names the plan beside the spec, with no detail. A plan is waiting for review only when
the human asks for it: by default it is auto-approved, and read during the implementation for its
progress. See [the plan page](#the-plan-page).

### A broken link

The proposal's "Why" links `questions-page.md` beside it, the draft that became the
[questions page feature](/specs/done/2026-10-24-questions-page.md). Its answer, the session in the
right column as a tab, is settled by that feature's approved spec.

## Worth it and feasibility

The spec is the workflow's main review, and the page already reads the format part by part: the work
is the look, the frames, the column reused from the questions page, and a plan page. Two parts are
new work beyond the look, each a question: what changed since the last review, a core comparison of
the spec, and the plan's waves and sections, a core reading. Worth it.

- **Outside behaviour**: the column, its tabs, and the session in a box are the questions page's,
  not built yet; this feature builds on them once that branch merges. The frames' scaling exists and
  is tested ([`story-embed.test.tsx`](/packages/web/src/__browser__/story-embed.test.tsx)). An HTML
  mockup in an iframe of the spec was checked in the [prototype](mockups/spec.html), in WebKit.
- **No guard is relaxed**: an HTML mockup drawn inline uses the sandbox the story frames already use
  ([`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx)).

## Approaches

Criteria come from the [proposal](proposal.md), the [UI look](/specs/decisions/ui-look.md),
[UI layout](/specs/decisions/ui-layout.md), [UI coherence](/specs/decisions/ui-coherence.md), and
[UI behaviour](/specs/decisions/ui-behaviour.md) decisions, WCAG 1.4.1, and the constitution's
"review effort matches impact". Each option is drawn in the [prototype](mockups/spec.html), over the
layout-look spec as it waited for review, with its three decision changes, and the questions page's
spec, data model, and plan.

### The decisions' look

How a decision's change reads, on every page that shows one. Builds on
[the code's decision change](#important-reads) and [prose diffs](#prose-diffs).

| Option                                                                          | Reads at a glance               | Phone                  | Colour-only cue          | Cost                         |
| ------------------------------------------------------------------------------- | ------------------------------- | ---------------------- | ------------------------ | ---------------------------- |
| A. A ledger: rules with a +, ~, or − sign, words marked inside, the rest folded | changed rules first, one column | the same column        | no: signs, wavy, struck  | the card's look              |
| B. Before and after, side by side, for each changed rule                        | both versions whole             | stacked, twice as long | no: labels               | the card's look, more height |
| C. Today's card, in the new look                                                | every section's pills           | as today               | removed words not struck | least                        |

### Framing live mockups

How a live story or HTML mockup shows it is an embed. Builds on [live previews](#live-previews) and
[Storybook embeds](#storybook-embeds-and-scaled-frames).

| Option                                                                     | Says "embed"            | Look                        | Width lost              |
| -------------------------------------------------------------------------- | ----------------------- | --------------------------- | ----------------------- |
| A. A live window: a double border, "live", the size and scale in its title | by its border and title | terminal, like tmux         | about 24 px             |
| B. Device bezels: a monitor with a stand, a phone with a notch             | by the device drawing   | round, drawn devices        | about 30 px, and height |
| C. A browser window: dots and an address bar                               | by the browser's chrome | a browser inside a terminal | none                    |

### The right column

What the column beside the spec holds, on top of the session that the layout decision already places
there. Builds on [the questions page's column](#the-questions-pages-column).

| Option                                                          | Comments in view | Verdict in view         | Tabs |
| --------------------------------------------------------------- | ---------------- | ----------------------- | ---- |
| A. Contents, Review (the comments and the verdict), and Session | in a tab         | in a tab and at the end | 3    |
| B. Contents and Session; comments counted in Contents           | counts only      | at the end only         | 2    |
| C. Contents and Session; the verdict in the status line         | counts only      | always                  | 2    |

### Changes since the last review

What a revision shows of the changes since the review that asked for them. Builds on
[code review tools](#code-review-tools-between-revisions) and
[the proposal's gap](#what-changed-since-the-last-review).

| Option                                                         | What the human sees                 | Cost                               |
| -------------------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| A. Changed parts marked, their words diffed, listed at the top | each change, and what it was before | the core compares the spec's parts |
| B. Changed parts marked and listed, without words              | where, not what                     | the same comparison, less drawing  |
| C. Nothing new: "Your review, answered" only                   | the answers, not the changes        | none                               |

### The plan page

What the plan's page puts first. Builds on [agent tools' plans](#agent-tools-plans) and
[the plan's reading in the core](#important-reads).

| Option                                                                      | During the build         | When waiting for review          | Cost                     |
| --------------------------------------------------------------------------- | ------------------------ | -------------------------------- | ------------------------ |
| A. Progress first: a bar, the waves, the current task open, the rest folded | where it is, at a glance | review focus and every task open | the core reads the waves |
| B. The file's order, each section a pane, tasks with their badges           | a long scroll            | as written                       | least                    |

### Needs no choice

- **An outline that follows the scroll**: Contents exists, with comment counts; it becomes the
  column's first tab, as on the questions page.
- **Draft comments sent with the verdict**: already how reviews work
  ([review files](/skills/uraeda/references/conventions.md#review-files)).
- **A three-way verdict**: approve and request changes exist; "approve with comments" too. A
  "comment only" review does not fit the workflow, whose review always ends in a verdict.
- **Outdated comments**: a review file quotes its lines at its commit, and the next review replaces
  it ([review files](/skills/uraeda/references/conventions.md#review-files)); comments do not travel
  across revisions.
- **Moving between comments by keyboard**: keyboard navigation is its own item in
  [the priorities](/specs/PRIORITIES.md).
- **Viewed marks per part**: a spec is approved in one sitting, read top to bottom; the outline
  marks the reader's place. Not needed.
- **Resolved threads**: comments are answered in the next revision's "Your review, answered", one
  item each.
- **Suggested edits**: a comment is free text the agent carries out; the format has no suggestion.
- **Actions per task, start or view its changes**: implementation runs from the workflow, not a task
  button, and a git view is in [the priorities](/specs/PRIORITIES.md) as its own item.
- **A chat taking a quoted selection**: the layout decision allows it, and the questions page builds
  it; the spec page quotes the selected lines.

## Not checked

- No official page for GitHub's "changes since your last review", or for Kiro's per-task button
  labels; Bitbucket's iterative review and Böckeler's report were read as secondary sources.
- Linear's project documents page returned 404; Copilot Workspace and Devin's planning page returned
  nothing usable.
- How VoiceOver on macOS announces `<ins>` and `<del>` varies between versions, per Wikimedia; not
  tested here.
- The prototype was checked in WebKit only, at 1440, 1205, and 402 px, in Mocha.
