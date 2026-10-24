---
status: auto-approved
spec-revision: 1
---

# Plan: Spec and plan pages in the terminal look

**Goal:** the spec, the plan, and the data model draw in titled panes, a decision's change reads as
a ledger on every page, every live mockup draws in a live window, a right column of Contents,
Review, and Session sits beside the spec and the plan, and a revision marks what changed since your
review.

**Architecture:** seven owners, as the [spec's architecture](spec.md#architecture) names them. The
**core** owns every reading: a data model's sections and tables (`Items.dataModel`), a plan's lead
paragraphs (`PlanItems.lead`), a paragraph that embeds an HTML mockup with its width
(`VersionView.mockups`), and the spec's change since the reviewed commit (`FileView.sinceReview`),
built on the decision change's own cutting and matching, moved to a module both use. The **pane**
(`layout/Pane.tsx`) owns every titled border: it gains the decisions' tones and the live window's
double sapphire border. The **decision ledger** (`spec/DecisionCard.tsx`, split into `spec/ledger/`)
owns how a change reads on every page that draws one. The **live window** (`StoryEmbed.tsx`,
`StoryFrames.tsx`) owns how a story or an HTML mockup reads, wherever `Blocks` draws one. The
**spec's parts** (`spec/`) own the spec's look, in `Pane`s; `spec/Panel.tsx` goes. The **document's
column** is the questions page's `layout/DocumentColumn.tsx`; the spec's and the plan's tabs are put
together by `spec/SpecColumn.tsx`, which owns the Review tab and the phone's status line. The **plan
page** (`PlanPage.tsx`) replaces `ReviewPage.tsx` and the generic page for plans. The verdict's
choices, the risk tier and plan review, move from `ReviewVerdict`'s local state to the review
(`useReview`), so the Review tab's buttons and the page's end commit the same verdict.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both. Its
approval comments, in [spec-review.md](spec-review.md), are carried out as
[Review comments](#review-comments) says.

## Review focus

1. **A spec reviewed at a commit that still exists, but whose review was an approval with
   comments.** An approval leaves no `changes-requested` review for the revision: no "Since your
   review" pane, no Δ, as on a first revision. Task 2.
2. **A spec whose frontmatter alone changed since the review** (`revision: 1` to `revision: 2`,
   `status`). The frontmatter is not a part: no part is marked, and the pane says "No part changed
   since your review." rather than "0 parts changed". Task 2 for the core, Task 12 for the pane.
3. **A changed part inside a story's key scenario and its journey at once.** Each is listed and
   marked on its own, named "US2's journey" and "US2, key scenario 1", and the Contents row of US2
   carries one Δ. Task 12.
4. **Approving from the Review tab after setting the risk tier at the page's end, then switching
   tabs.** The tier set at the end is the one committed: the choices live in the review, not in a
   mounted form. Task 10.
5. **Asking about a removed rule of a decision.** The quote names the default branch's file and
   lines, the rule's removed words quoted, and the header says "removed": "About the removed rule of
   specs/decisions/task-storage.md, lines 16–17:". Task 11.
6. **An HTML mockup link with a `?w=` query and an `#anchor`.** The window loads the page with its
   anchor, at the width the query names, 1440 px without one; the query never reaches the served
   path. Task 1 for the core, Task 5 for the window.
7. **The column folded with `]`, then a live window's full screen.** Folded, the window grows with
   the spec, and its scale says so; full screen shows it at 100%, whatever the column. Task 5 for
   the scale, Task 10 for the fold.

## Global constraints

From the spec, exactly:

- The block's pane: titled "Spec to review, revision 2, about 10 minutes." on a revision, "Spec to
  review, about N minutes." on a first one, its "You approve" item first. An approved spec draws the
  same panes, titled by its block's first line ("Approved on 2026-10-24."), without the Review tab
  or the verdict.
- "Decisions · 1 new, 1 changed, 1 removed" right after "Your review, answered", each decision a
  pane: green when new, mauve when changed, red when removed. A decision not listed in the spec:
  "Not listed in the spec", as today. No decision listed or changed: "Decisions" shows the relied-on
  table only.
- The ledger: changed rules first, each with a sign, `+` added, `~` changed, `−` removed; a changed
  rule's added words underlined (wavy) in `<ins>`, removed words struck in `<del>`; a new decision's
  rules read plain with `+`, a removed decision's struck with `−`; unchanged rules fold under "N
  rules unchanged"; the other sections fold under "Why, alternatives, consequences · N changed".
- The live window: a double border in the theme's sapphire, titled "live · <name> · <width> px",
  then its scale in percent; on a hatched background; a full-screen button showing it at 100%. A
  phone mockup at 1440 px shows at 402 px wide, 100%. A mockup that fails to load: "This mockup
  could not be loaded." and a link to its page.
- The column: Contents, Review, and Session, Contents open, 480 px at 1440 px (the questions page's
  width rule). Review lists the comments with their places, a tap jumping to each, then "Request
  changes" and "Approve". At 390 px: no column; the status line holds "Contents", the comment count,
  and "Verdict".
- Asking: "About specs/decisions/task-storage.md, lines 15–16:" then the rule quoted, in the Session
  tab's composer. On the phone, the session's page opens with the quote, and Back returns to the
  block. No agent, or a spec on the default branch: no Session tab and no "Ask the agent".
- Since your review: "Since your review · 3 parts changed", each part marked Δ in the page and in
  Contents, its words marked as a decision's are; a part removed shows struck under "1 part
  removed". The reviewed commit gone: no Δ, and the pane reads "The version you reviewed is not in
  git anymore."
- The plan page: the file's order, each section a pane, each task a pane titled "Task 1 · <title>"
  with its `done/total` badge, waiting for review or not; a plan with no tasks draws its sections
  only.
- A comment typed, then the tab switches or the width class changes: the text stays, marked unsaved.

From the active decisions the code touches, word for word:

- [Stack](../decisions/stack.md): "Workflow logic, parsing, validation, and states MUST live in the
  Rust core, and TypeScript MUST reach them only through the binding, never reimplemented." "The web
  UI MUST draw workflow files from the core's document tree, never parsing their markdown." "The
  server MUST NOT let a preview's frame save, create, or open files, through Storybook or otherwise,
  and the web UI MUST sandbox previews apart from Uraeda's origin."
- [UI look](../decisions/ui-look.md): "The UI MUST look like a terminal tool: square corners, and
  content grouped in bordered panes whose title sits in their top border." "A new colour scheme MUST
  be added as a named scheme of the same theme, never as styles in a view." "Every text colour MUST
  reach 4.5:1 against its background, and borders and controls 3:1, in every scheme."
- [UI layout](../decisions/ui-layout.md): "The UI MUST adapt to three width classes, narrow,
  semi-wide, and wide, not to the device, through the theme and never per-view media queries." "On
  narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and
  dialogs." "An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change
  keeps it." "A feature's session MAY open beside any of the feature's documents, in the right
  column, at least 400 px wide; everywhere else it stays a page of its own."
- [UI coherence](../decisions/ui-coherence.md): "A kind of information MUST be drawn by one shared
  component on every page that shows it." "A change to how information is drawn MUST be made in its
  shared component, so every page follows." "Reading text MUST be drawn through `Prose`."
- [UI behaviour](../decisions/ui-behaviour.md): "Text MUST save only on an explicit action, and
  unsaved text MUST be marked and never dropped without asking." "Back and reload MUST keep the
  human's place and what they were reading." "Every action MUST work by tap and by keyboard, never
  by hover alone." "folded content MUST NOT be mounted".
- [UI components](../decisions/ui-components.md): "Views MUST use Astryx components wherever one
  fits the job, and be styled only through its theme, with no global stylesheet or inline styles."
  "A raw element MAY stand in for a missing Astryx component, with a reason, and the plan MUST list
  it as an Astryx gap."
- [UI checks](../decisions/ui-checks.md): "UI tests MUST drive the UI as a user does, and MUST NOT
  assert markup, class names, or pixels." "Before handing over a UI change, the agent MUST review
  screenshots of every changed view at both sizes and in both themes against the decisions, and
  commit them." Widths the spec states in px are measured in browser tests, as the questions page's
  are.
- [Preview](../decisions/preview.md): "A spec's mockups and named states of views MUST be stories
  written with the real components, next to them." "Storybook MUST run Uraeda's real server over
  fixture data, and stories MUST NOT fake its responses."
- [Code quality](../decisions/code-quality.md): TypeScript files at most 500 lines, functions 100,
  depth 4, parameters 7; Rust functions 100 lines, 7 arguments; "a new marker MUST NOT be added
  unless a human approves it in the plan".
- [Toolchain](../decisions/toolchain.md): "After every task, fast MUST check formatting, lint,
  types, affected focused tests and boundary checks, and name broader checks deferred to ready." "An
  agent MUST run `vp run ready` before pushing a branch." Run everything inside `nix develop -c`.

Existing guarantees to keep: comments on a spec's blocks and a decision's parts save with their
lines ([`spec-decisions.test.tsx`](/packages/web/src/__tests__/spec-decisions.test.tsx),
[`review.test.tsx`](/packages/web/src/__tests__/review.test.tsx)); folds kept on Back
([`__browser__/review.test.tsx`](/packages/web/src/__browser__/review.test.tsx)); a story's comments
and picks ([`story-comments.test.tsx`](/packages/web/src/__browser__/story-comments.test.tsx)); the
story frame's lazy loading, foreign messages ignored, and sandbox
([`story-embed.test.tsx`](/packages/web/src/__browser__/story-embed.test.tsx)); the mockup page and
its comments ([`mockup.test.tsx`](/packages/web/src/__tests__/mockup.test.tsx)); the decision's own
page, the decisions page's branch change, candidates, and the decisions check drawing a change; the
questions page as its branch builds it.

## Code read

The [discovery's map](discovery-01.md#the-code) holds; read in full for this plan:

- **Core.** [`decisions/parts.rs`](/crates/core/src/decisions/parts.rs): `version(text)` cuts a
  markdown file into `##` sections of parts (a paragraph, an item at any depth, a table row, a code
  block), whitespace collapsed. [`decisions/change.rs`](/crates/core/src/decisions/change.rs):
  `compare` matches parts by an exact LCS, then pairs the rest when they keep 60% of the shorter
  one's words, and diffs a pair word by word into `Run`s; `part_change` adds a rule's strength and
  splits its "Checked by", which is the decision's own. Both modules are private to `decisions`.
  [`api.rs`](/crates/core/src/api.rs) `file_view` fills `decision_changes` and `answered` for a
  spec; [`api/answered.rs`](/crates/core/src/api/answered.rs) finds, for revision 2 or more, the
  first commit carrying the current revision and reads its `spec-review.md` when
  `changes-requested`; [`files/review.rs`](/crates/core/src/files/review.rs) `Review.commit` is the
  branch tip's 7-character hash at the review's first comment
  ([`actions/review.rs`](/crates/core/src/actions/review.rs)); an approval without comments deletes
  the review. Git: `Git::resolve`, `read_file`, `path_changes` ([`git.rs`](/crates/core/src/git.rs),
  [`git/log.rs`](/crates/core/src/git/log.rs)). `FileView` is also built by
  [`api/answers/default_round.rs`](/crates/core/src/api/answers/default_round.rs). Items:
  [`files/items.rs`](/crates/core/src/files/items.rs) `items()` has no arm for
  `FileKind::DataModel`; `PlanItems { tasks }`; [`files/spec.rs`](/crates/core/src/files/spec.rs)
  `story_mockups` and `mockup()` recognise `mockups/<file>.html` links for `SpecItems.mockups` only;
  [`files/stories.rs`](/crates/core/src/files/stories.rs) `story_links` and `only_link` find a
  paragraph holding one link alone; [`workspace/links.rs`](/crates/core/src/workspace/links.rs)
  `resolve` drops a link's `?query`. The binding is regenerated by `vp run binding:build`, and
  `packages/binding/index.d.ts` is committed. Tests: `crates/core/tests/` with `common/`
  (`TestRepo`, `texts.rs`), [`decision_change.rs`](/crates/core/tests/decision_change.rs),
  [`items.rs`](/crates/core/tests/items.rs).
- **Pane and theme.** [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx): tones `attention`,
  `example`, `problem`, `fold`, `isOpenOnPhone`.
  [`theme/theme.ts`](/packages/web/src/theme/theme.ts) has no sapphire; Catppuccin's sapphire is
  `#74c7ec` (Mocha) and `#209fb5` (Latte), to be paired for contrast as `pair()` does;
  [`theme-tokens.test.ts`](/packages/web/src/__tests__/theme-tokens.test.ts) checks every
  `--color-border-<hue>` at 3:1 and every `--color-text-*` at 4.5:1.
- **The ledger's users.** `DecisionCard` (391 lines) is drawn by
  [`spec/DecisionCards.tsx`](/packages/web/src/spec/DecisionCards.tsx),
  [`feature/Record.tsx`](/packages/web/src/feature/Record.tsx),
  [`decisions/BranchChange.tsx`](/packages/web/src/decisions/BranchChange.tsx),
  [`decisions/BranchDecision.tsx`](/packages/web/src/decisions/BranchDecision.tsx) (`full`), and
  [`decisions/Candidates.tsx`](/packages/web/src/decisions/Candidates.tsx);
  [`spec/RuleLine.tsx`](/packages/web/src/spec/RuleLine.tsx) draws runs and strengths.
- **Frames.** [`StoryEmbed.tsx`](/packages/web/src/StoryEmbed.tsx) (369) draws a `figure`, a bar,
  the Phone/Desktop switch, picks, and full screen;
  [`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx) (351) scales the 1440 px desktop to its
  room, never the phone, sandbox `allow-scripts allow-popups`, lazy `src`;
  [`embedLayout.ts`](/packages/web/src/embedLayout.ts) `useOutgrow` and `useFullScreen`, which does
  not change the scale. [`Blocks.tsx`](/packages/web/src/Blocks.tsx) (491) `BlockNode` draws
  `StoryNode` for a story paragraph; an HTML mockup link is a plain link
  ([`links.tsx`](/packages/web/src/links.tsx) `pathLink`). The server serves mockups at
  `/r/<repo>/mockups/<secret>/<path>` with `content-security-policy: sandbox allow-scripts`
  ([`packages/server/src/files.ts`](/packages/server/src/files.ts)), as
  [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx) frames them.
- **The spec page.** [`spec/SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx) wires
  [`SpecOpening`](/packages/web/src/spec/SpecOpening.tsx),
  [`ReviewAnswers`](/packages/web/src/spec/ReviewAnswers.tsx), `DecisionCards`,
  [`StoryCard`](/packages/web/src/spec/StoryCard.tsx),
  [`DataPart`](/packages/web/src/spec/DataPart.tsx) (parses sections in the web),
  [`BuiltParts`](/packages/web/src/spec/BuiltParts.tsx) (385),
  [`SpecHistory`](/packages/web/src/spec/SpecHistory.tsx), each in a
  [`Panel`](/packages/web/src/spec/Panel.tsx);
  [`SpecContents`](/packages/web/src/spec/SpecContents.tsx) is a 320 px `SideColumn` shown from 1100
  px, with `entriesOf` and comment counts, no part marked.
- **Review.** [`review/useReview.tsx`](/packages/web/src/review/useReview.tsx): `Review`,
  `ReviewHost`, `ReviewIntro`, `ReviewEnd`; [`YourReview.tsx`](/packages/web/src/YourReview.tsx) and
  [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx): `Verdicts` (not exported) and the
  choices in `useState(initialChoices(spec))`;
  [`ReviewCommentForm.tsx`](/packages/web/src/ReviewCommentForm.tsx) offers "Ask the agent" except
  on a decision's lines (`!selection.decision`);
  [`useReviewActions.ts`](/packages/web/src/useReviewActions.ts) `ask` quotes the spec's own lines
  with `askAbout` and `quoted` ([`sessions.ts`](/packages/web/src/sessions.ts)). Typed comments are
  kept by [`fields/unsaved.ts`](/packages/web/src/fields/unsaved.ts).
- **The questions page's parts, merged on this branch.**
  [`layout/DocumentColumn.tsx`](/packages/web/src/layout/DocumentColumn.tsx) (`DocumentColumn`,
  `ColumnTab`, `useColumnTab`), [`ColumnSession.tsx`](/packages/web/src/ColumnSession.tsx)
  (`ColumnSession({ draft, folder })`; `WithSessionColumn` is `TEMPORARY`),
  [`useDraft.ts`](/packages/web/src/useDraft.ts), [`roundJump.ts`](/packages/web/src/roundJump.ts)
  (`jumpTo`, `useQuestionAtTop`, `afterSheetCloses`),
  [`RoundOutline.tsx`](/packages/web/src/RoundOutline.tsx) for the marked row. Its Task 8, not built
  yet when this plan was written, adds `withQuote(text, quote)` to `sessions.ts` and wires the
  round's column.
- **Plans.** [`FilePage.tsx`](/packages/web/src/FilePage.tsx) routes a waiting plan to
  [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) with
  [`ReviewHeadings.tsx`](/packages/web/src/ReviewHeadings.tsx)'s badges, any other plan and a data
  model to the generic [`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx).
- **Fixtures.** `addSpecFeature` in
  [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts) builds `fixtures/spec-page/`
  (the recurring-tasks spec: Repeating tasks new, Task storage changed, Task history removed, Due
  dates changed unlisted, US4 linking `mockups/title.html`, a data model) in one commit, its review
  naming the fake commit `4f2a9c1`. The sandbox
  ([`samples/projects.ts`](/packages/web/samples/projects.ts)) does not add it; Storybook does
  ([`.storybook/fixture.ts`](/packages/web/.storybook/fixture.ts)).
- **Tests and commands.** UI tests in `packages/web/src/__tests__/` (`renderPage`, `atWidth`,
  `fakeAgent`); browser tests in `src/__browser__/` in WebKit (`atSize`, `show`, `drawn`,
  `checkPage`, `checkAccessibility`, `colorScheme`). Spec page tests: `spec-page`, `spec-decisions`,
  `spec-parts`, `spec-stories`, `review` (UI); `spec`, `spec-parts`, `review`, `story-embed`
  (browser). Commands: `nix develop -c vp run fast`; `nix develop -c vp test <file>`;
  `nix develop -c vp test --project desktop|phone <file>`;
  `nix develop -c cargo nextest run -p uraeda-core`; `nix develop -c vp run binding:build`;
  `nix develop -c vp run ready`. Screenshots: `packages/web/scripts/spec-shots.ts`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Complexity tracking

| New or grown                                                            | Why                                                                                                      | Simpler alternative rejected                                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `crates/core/src/compare/` (parts and matching, out of `decisions/`)    | the spec's revision and a decision's change match and diff parts by one rule, as the spec asks           | a copy of the 60% rule for specs, two homes for one rule                            |
| `FileView.sinceReview`, `Items.dataModel`, `PlanItems.lead`, `mockups`  | the stack decision keeps reading in the core: the Δ marks, the data panes, the plan's panes, HTML embeds | the web reading the data model, "**Goal:**", and `?w=` from spans, which it forbids |
| `Pane` tones `new`, `changed`, `removed`, `live`; the sapphire tokens   | decisions and live windows are titled borders, one shared pane as coherence asks                         | a ledger card and a window with their own borders                                   |
| `spec/ledger/` (the ledger's rows and folds, out of `DecisionCard.tsx`) | `DecisionCard.tsx` is at 391 lines and the ledger grows it                                               | growing the file past 500 lines                                                     |
| `spec/builtParts/` split of `BuiltParts.tsx` (385)                      | the panes grow it                                                                                        | growing the file past 500 lines                                                     |
| `spec/SpecColumn.tsx`, `spec/ReviewTab.tsx`                             | the spec's and the plan's tabs, the Review tab, and the phone's status line, shared by the two pages     | the tabs written twice, in `SpecPage` and `PlanPage`                                |
| `PlanPage.tsx`, replacing `ReviewPage.tsx` and `ReviewHeadings.tsx`     | one page for a plan, waiting or not                                                                      | two pages, one losing the badges                                                    |
| The verdict's choices in `useReview`                                    | two places commit one verdict (Review focus 4)                                                           | two forms with their own state, which disagree                                      |
| Astryx gap: the live window's hatched stage                             | no Astryx surface has a pattern; drawn with a `repeating-linear-gradient` of theme tokens, in StyleX     | a plain stage, which the human picked against                                       |
| Astryx gap: `<ins>`, `<del>`, and the ledger's sign                     | no Astryx component marks inserted or deleted words; raw elements styled on theme tokens                 | Astryx `Text` spans, which lose the insertion and deletion roles                    |

## Review comments

- **C1** (general): "constitution checks should be after a line break, it's weird atm". In the block
  pane, the constitution's principles and the risk tier's reason start on a line of their own, under
  a rule, at the pane's foot, apart from the block's items and the text before the first section.
  Task 9, with a test that they follow a separator.
- **C2** (the block, "builds on the questions page's column"): "Start by already catching up to its
  worktree, it's almost done". The questions page's branch is merged into this one before the plan
  (merge `d07740c3`), and again before Task 10 and before the final review, so the column, its
  session, and `withQuote` are that branch's.
- **C3** (SC-005): "We'll likely review that so it's pretty low importance... The right tab is a bit
  too big in 1440px width". The column keeps the questions page's width rule, 480 px at 1440 px, as
  US4 says: it is one component and one width for both pages, and changing it changes the questions
  page too. The pull request names it for the human's review; dragging it narrower is kept for every
  document.

## Test map

Core tests parse strings and fixtures, and build git repositories with `TestRepo`. UI tests render
the app over a copy of `fixtures/repo` with the spec-page feature added (`addSpecFeature`) in jsdom,
with the fake agent; the revision is `addRevisedSpec`, Task 12: revision 1 committed, its review
naming that real commit, then revision 2. Browser tests run the real app in WebKit at 390 (phone),
1205 (semi), and 1440 px (desktop), in both schemes where a colour or a border is checked.

| Requirement                                       | Task   | Test                                                                                                                        |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| US1 key 1 (block pane title, "You approve" first) | 9      | `__tests__/spec-panes.test.tsx` "the block is a pane titled by its revision and time"                                       |
| US1 key 2 (Decisions after answers, tones)        | 4, 9   | `spec-panes.test.tsx` "Decisions · 1 new, 1 changed, 1 removed follows the answers"; tones in `__browser__/ledger.test.tsx` |
| US1 key 3, US4 more 1 (phone status line)         | 10     | `__tests__/spec-column.test.tsx` "on the phone, the status line holds Contents, the count, and Verdict"                     |
| US1 more 1, 2 (Data panes, alone)                 | 1, 9   | `crates/core/tests/items.rs` `data_model_sections`; `spec-panes.test.tsx` "the data model alone draws the same panes"       |
| US1 more 3 (approved spec)                        | 9, 10  | `spec-panes.test.tsx` "an approved spec draws its panes, no Review tab, no verdict"                                         |
| US2 key 1, 2, 3 (signs, marked words, folds)      | 4      | `__tests__/ledger.test.tsx` "task storage reads as a ledger"; "a new decision's rules read plain"                           |
| US2 more 1 (rules unchanged fold)                 | 4      | `ledger.test.tsx` "unchanged rules fold under their count, and unfold"                                                      |
| US2 more 2, 3 (decisions page, unlisted)          | 4      | `ledger.test.tsx` "the decisions page shows the same ledger"; `spec-decisions.test.tsx` unlisted kept                       |
| US3 key 1, more 1, 2 (window title, scale, phone) | 5      | `__browser__/live-window.test.tsx` "a story's window says live, its size, and its scale"                                    |
| US3 key 2 (HTML mockup live)                      | 1, 5   | `crates/core/tests/stories.rs` `html_mockups`; `__tests__/spec-stories.test.tsx` "an HTML mockup draws live"                |
| US3 key 3 (full screen at 100%)                   | 5      | `live-window.test.tsx` "full screen shows the mockup at 100%"                                                               |
| US4 key 1 (column 480 px, three tabs)             | 10     | `__browser__/spec-column.test.tsx` "at 1440 px the column is 480 px, Contents open"                                         |
| US4 key 2 (Review lists, jumps, buttons)          | 10     | `spec-column.test.tsx` (UI) "Review lists the comments, jumps to each, then the verdict"                                    |
| US4 key 3 (Ask on a decision's rule)              | 11     | `__tests__/spec-asking.test.tsx` "asking about a rule quotes the decision's file and lines"                                 |
| US4 more 2 (typed comment through tabs)           | 10     | `spec-column.test.tsx` (UI) "a typed comment stays through tabs and widths"                                                 |
| US4 more 3 (approve from Review)                  | 10     | `spec-column.test.tsx` (UI) "approving from Review commits the tier set at the end"                                         |
| US4 more 1 (phone asking, Back)                   | 11     | `spec-asking.test.tsx` "on the phone, asking opens the session's page, Back returns"                                        |
| US5 key 1, 2 (since pane, Δ, words)               | 2, 12  | `crates/core/tests/since_review.rs` `revision_two_changes`; `__tests__/since-review.test.tsx` "the changed parts"           |
| US5 more 1 (first revision)                       | 2, 12  | `since_review.rs` `first_revision_has_none`; `since-review.test.tsx` "no pane on a first revision"                          |
| US5 more 2 (removed part)                         | 2, 12  | `since_review.rs` `removed_part`; `since-review.test.tsx` "a removed part folds, struck"                                    |
| US6 key 1, 2 (plan page)                          | 1, 7   | `items.rs` `plan_lead`; `__tests__/plan-page.test.tsx` "the plan draws its sections and tasks in panes"                     |
| Edge: typed comment through tab or width (High)   | 10     | as US4 more 2                                                                                                               |
| Edge: reviewed commit gone (High)                 | 2, 12  | `since_review.rs` `missing_commit`; `since-review.test.tsx` "the version you reviewed is not in git anymore"                |
| Edge: no agent, default branch                    | 11     | `spec-asking.test.tsx` "without an agent, no Session tab and no Ask"                                                        |
| Edge: HTML mockup fails to load                   | 5      | `live-window.test.tsx` "a missing mockup says so, with a link to its page"                                                  |
| Edge: removed decision                            | 4      | `ledger.test.tsx` "a removed decision's rules are struck, with −"                                                           |
| Edge: column folded                               | 10     | `spec-column.test.tsx` (browser) "folded, a live window grows"                                                              |
| Edge: no decision                                 | 4      | `ledger.test.tsx` "without a change, Decisions holds the relied-on table only"                                              |
| Edge: plan with no tasks                          | 7      | `plan-page.test.tsx` "a plan with no tasks draws its sections"                                                              |
| SC-001 (not by colour)                            | 4, 12  | `ledger.test.tsx` and `since-review.test.tsx`: every change has a sign and its `insertion` or `deletion` role               |
| SC-002 (contrast)                                 | 3, 13  | `theme-tokens.test.ts` (sapphire, decision tones); `checkAccessibility` on the spec and plan in both schemes                |
| SC-003 (revision fixture)                         | 12     | `since-review.test.tsx` "every changed part is marked, no other"                                                            |
| SC-004 (two taps)                                 | 10, 11 | `spec-column.test.tsx` and `spec-asking.test.tsx`: tap a block, then Comment or Ask the agent                               |
| SC-005 (no jump)                                  | 10     | `spec-column.test.tsx` (browser) "switching tabs moves no part"                                                             |
| SC-006 (phone width)                              | 4, 5   | `ledger.test.tsx` (browser) and `live-window.test.tsx`: `checkPage` at 390 px                                               |
| Review focus 1                                    | 2      | `since_review.rs` `approved_with_comments_has_none`                                                                         |
| Review focus 2                                    | 2, 12  | `since_review.rs` `frontmatter_alone`; `since-review.test.tsx` "no part changed since your review"                          |
| Review focus 3                                    | 12     | `since-review.test.tsx` "a journey and a scenario of one story are listed apart"                                            |
| Review focus 4                                    | 10     | as US4 more 3                                                                                                               |
| Review focus 5                                    | 11     | `spec-asking.test.tsx` "asking about a removed rule names it removed"                                                       |
| Review focus 6                                    | 1, 5   | `stories.rs` `html_mockup_width_and_anchor`; `live-window.test.tsx` "the query sets the width"                              |
| Review focus 7                                    | 5, 10  | `live-window.test.tsx` full screen; `spec-column.test.tsx` folded                                                           |

## Waves

1. Tasks 1, 2, 3: the core's readings, the core's revision change, and the pane's tones and
   sapphire. Independent: Task 1 touches `files/items.rs`, `files/plan.rs`, `files/stories.rs`,
   `view/version.rs`; Task 2 `decisions/`, a new `compare/`, `api.rs`, `api/answered.rs`, `view.rs`;
   Task 3 `Pane.tsx` and the theme. Shared: Tasks 1 and 2 each regenerate
   `packages/binding/index.d.ts` and `index.js`; the later merge regenerates them once more.
2. Tasks 4, 5, 6, 7: the ledger, the live window, the built parts, and the plan page. Each its own
   files: Task 4 `DecisionCard`, `RuleLine`, `DecisionCards`, `spec/ledger/`; Task 5 `StoryEmbed`,
   `StoryFrames`, `embedLayout`, `Blocks`, `stories.tsx`; Task 6 `BuiltParts` and
   `spec/builtParts/`; Task 7 `PlanPage.tsx`, `FilePage.tsx`, `ReviewPage.tsx`,
   `ReviewHeadings.tsx`. Shared: each may add helpers to `src/__tests__/helpers.tsx`.
3. Task 9 alone, after Task 8 is merged: Task 8 is the questions page's branch merged again, a step
   of its own.
4. Task 10: the column.
5. Task 11: asking.
6. Task 12: since your review.
7. Task 13: the sandbox, the stories, the screenshots, and the mockup's README.

---

## Task 1: The core reads data models, plan leads, and HTML mockup embeds

**Files:**

- Create: `crates/core/src/files/items/data_model.rs` (`DataModelItems` and its types, beside
  `items/round.rs` and `items/spec.rs`)
- Modify: `crates/core/src/files/items.rs` (`Items.data_model`, `PlanItems.lead`),
  `crates/core/src/files/plan.rs` (`lead`), `crates/core/src/files/stories.rs` (`MockupEmbed`,
  `mockup_embeds`), `crates/core/src/view/version.rs` (`VersionView.mockups`),
  `api/answers/default_round.rs`, which builds a version (`api/drafts.rs` does not),
  `packages/server/src/fate/sources.ts` (its empty version gains `mockups: []`),
  `packages/binding/index.d.ts` and `index.js` (generated)
- Test: `crates/core/tests/items.rs`, `crates/core/tests/stories.rs`

**Interfaces:**

- Produces, in the binding:
  - `Items.dataModel?: DataModelItems` for `data-model.md`, with
    `DataModelItems { intro: Array<number>; sections: Array<DataSection> }`,
    `DataSection { title: string; anchor: string; heading: number; blocks: Array<number>; tables: Array<DataTable> }`,
    `DataTable { block: number; changes: Array<RowChange> }`,
    `RowChange { row: number; kind: "new" | "changed" | "removed" }`: `intro` the top-level blocks
    before the first `##` but the `#` title; a section per `##` with its blocks; a table's `changes`
    read from its column headed "Change", its cells "New", "Changed", "Removed".
  - `PlanItems.lead: Array<PlanLead>`, `PlanLead { label: string; block: number; text: Span[] }`:
    each top-level paragraph before the first `##` whose first span is strong text ending in ":",
    such as "**Goal:**", its label the strong text without the colon ("Goal", "Architecture",
    "Spec"), its text the paragraph's spans after the label and the space after it.
  - `VersionView.mockups: Array<MockupEmbed>`,
    `MockupEmbed { path: string; anchor?: string; width: number; label: string; block: number }`:
    each paragraph holding one link alone to an `.html` file under a `mockups` folder at any depth,
    `width` from the link's `?w=` query, 1440 without it, `anchor` after its `#`; `path` from the
    repository's top level, without query or anchor.

- [x] **Step 1: Write the failing tests.** `items.rs`: the spec-page fixture's `data-model.md`
      (`fixtures/spec-page/branch/specs/2026-10-17-spec-page/data-model.md`) has sections "Task" and
      "Repeat rule" in order, each table's changes "new" and "changed" on the rows the file gives
      (`data_model_sections`); the example plan's lead is "Goal", "Architecture", "Spec"
      (`plan_lead`); a plan without a lead has none. `stories.rs`: `[Title](mockups/title.html)`
      alone in a paragraph gives width 1440; `[Phone](mockups/spec.html?doc=x&w=390#dec-1)` gives
      width 390 and anchor `dec-1`, path without the query (`html_mockup_width_and_anchor`, Review
      focus 6); a link inside a sentence, or to `mockups/x.png`, gives none. Breaks: a query left in
      the path; a "Change" cell read from the wrong column.
- [x] **Step 2: Run them to check they fail**: `nix develop -c cargo nextest run -p uraeda-core`.
      Expected: FAIL, no field `data_model` on `Items`.
- [x] **Step 3: Implement**, the readings in `items.rs`, `plan.rs`, and `stories.rs`; regenerate the
      binding with `nix develop -c vp run binding:build`. The web's `DataPart` keeps parsing until
      Task 9 replaces it.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(spec-page): the core reads data models, plan leads, and HTML mockups"`.

## Task 2: The spec's change since your review, in the core

**Risky:** the matching of parts moves out of the decisions' module, shared by every decision's
change and the spec's revision; a regression changes every page that draws a decision.

**Files:**

- Create: `crates/core/src/compare.rs` and `crates/core/src/compare/` (`parts.rs`, `matching.rs`):
  the cutting, matching, and word diff moved from `decisions/parts.rs` and `decisions/change.rs`
  first, in a `refactor` commit; `crates/core/src/api/since.rs`
- Modify: `crates/core/src/decisions/change.rs`, `crates/core/src/decisions.rs`,
  `crates/core/src/api.rs` (`file_view`), `crates/core/src/api/answered.rs` (returns the review's
  commit too), `crates/core/src/view.rs` (`FileView.since_review`),
  `crates/core/src/api/answers/default_round.rs`, `packages/binding/index.d.ts` and `index.js`
- Test: `crates/core/tests/since_review.rs` (create), `crates/core/tests/decision_change.rs`
  unchanged and passing

**Interfaces:**

- Produces: `FileView.sinceReview?: SinceReview` for a spec at revision 2 or more whose answered
  review requested changes, with
  `SinceReview { revision: number; found: boolean; parts: Array<SinceChange> }` and
  `SinceChange { kind: "changed" | "added" | "removed"; heading: string; before?: LineRange; after?: LineRange; runs: Array<Run> }`.
  `revision` is the reviewed revision, `found` false when the review's commit does not resolve or
  holds no spec, and `parts` then empty. The spec at the review's commit is compared with the one
  the page shows (the committed one while it waits), part by part with the decisions' rule: `##`
  sections, 60% of the shorter part's words to pair, word runs; the frontmatter is not a part, and
  no strength or check is read. `heading` is the text of the nearest heading above the part, on its
  side (`before` for a removed part). Kept parts are left out. `DecisionChange` and `compare` are
  unchanged.

- [x] **Step 1: Move the parts and the matching to `compare/`**, unchanged, `decisions/change.rs`
      keeping the strength and the check: `decision_change.rs` and `branch_changes.rs` pass before
      and after. Commit `refactor(spec-page): the matching of parts in a module of its own`.
- [x] **Step 2: Write the failing tests** in `since_review.rs`, on a `TestRepo` whose branch commits
      the spec at revision 1, then `spec-review.md` `changes-requested` with `commit:` that commit's
      short hash, then revision 2: `revision_two_changes` (US2's journey "for 3 seconds" to "for 5
      seconds" is one `changed` part under "US2: Complete a repeating task", runs
      `=for -3 +5     =seconds`; a `## Your review` section added is `added` parts under "Your
      review"; a reworded part elsewhere is `changed`, nothing else); `first_revision_has_none`;
      `removed_part` (a paragraph gone is `removed`, its `before` lines, no `after`);
      `missing_commit` (the review's commit `4f2a9c1` does not resolve: `found` false, no parts);
      `frontmatter_alone` (only `revision` and `status` differ: `found` true, no parts, Review focus
      2); `approved_with_comments_has_none` (the review at revision 2's first commit is `approved`:
      no `sinceReview`, Review focus 1). Breaks: the frontmatter compared as a part; the review read
      from the tip instead of the revision's first commit.
- [x] **Step 3: Run them to check they fail**:
      `nix develop -c cargo nextest run -p uraeda-core --test since_review`. Expected: FAIL, no
      field `since_review` on `FileView`.
- [x] **Step 4: Implement** in `api/since.rs`, reading through `answered`'s walk and `Git::resolve`
      and `read_file`; regenerate the binding. Once green, make the break of a review read from the
      tip, see `revision_two_changes` fail, revert, and report it in the commit body.
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, and the core bench of
      `branch_changes.rs`. Expected: PASS, the bench under its 100 ms.
- [x] **Step 6: Commit**:
      `git commit -m "feat(spec-page): the spec's change since your review, in the core"`.

## Task 3: The pane's tones for decisions and live windows

**Files:**

- Modify: `packages/web/src/theme/theme.ts` (Catppuccin's sapphire as a role, paired for contrast,
  giving `--color-border-sapphire` and `--color-text-sapphire`), `src/layout/Pane.tsx`
- Test: `src/__tests__/theme-tokens.test.ts` (sapphire's border at 3:1, text at 4.5:1),
  `src/__tests__/titled-pane.test.tsx`

**Interfaces:**

- Produces: `PaneTone` gains `"new"` (green border and title), `"changed"` (mauve), `"removed"`
  (red), and `"live"` (sapphire, the border double, three times the border's width). `Pane` gains
  `actions?: ReactNode`, drawn in the top border at its end, as the live window's buttons are, and
  `titleSuffix?: ReactNode`, drawn after the title in the secondary text colour, as "· 1440 × 900 ·
  49%" is; its accessible name stays its `title`.

- [x] **Step 1: Write the failing tests.** `theme-tokens.test.ts`: sapphire's border reaches 3:1 and
      its text 4.5:1 on body and surface, in Latte and Mocha. `titled-pane.test.tsx`: a pane with
      `actions` names its region by its title alone and holds the action's button; a pane with
      `titleSuffix` reads its suffix after its title. Break: the suffix read in the region's name.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/theme-tokens.test.ts`. Expected: FAIL, no
      `--color-border-sapphire`.
- [x] **Step 3: Implement**, the colours from the theme's tokens only.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(spec-page): the pane's tones for decisions and live windows"`.

## Task 4: The decision ledger, on every page

**Risky:** the decision card is shared by the spec page, the decision's page, the decisions page,
candidates, and the decisions check.

**Files:**

- Create: `packages/web/src/spec/ledger/` (the rows, their signs, and the folds, out of
  `DecisionCard.tsx`, in a `refactor` commit first)
- Modify: `src/spec/DecisionCard.tsx`, `src/spec/RuleLine.tsx`, `src/spec/DecisionCards.tsx`
- Test: `src/__tests__/ledger.test.tsx` (create), `src/__browser__/ledger.test.tsx` (create),
  `src/__tests__/spec-decisions.test.tsx` and the decisions pages' tests, which follow the ledger
  (R2)

**Interfaces:**

- Consumes: `Pane`'s tones `new`, `changed`, `removed` (Task 3).
- Produces: `DecisionCard`'s props unchanged. It draws a `Pane` toned by its kind, titled by the
  decision's title, its kind badge and "Not listed in the spec" in the title, its fields' change
  ("active → proposed") after it, the spec's sentence, then the ledger: the intent; "Rules" with
  each part not kept first, each row a sign (`+`, `~`, `−`, named "Added", "Changed", "Removed" for
  screen readers), its strength, its words through `Runs` with `<ins>` (wavy underline) and `<del>`
  (struck) for a changed rule, plain for a part added or removed whole, struck for removed; kept
  rules folded under "N rules unchanged" (one "rule unchanged"); the other sections folded under
  "Why, alternatives, consequences · N changed"; a new decision's other sections folded under "Why,
  alternatives, consequences"; with `full`, every section open, as on the decision's own page. Each
  row stays tappable for a comment as today; a fold holding a pending comment or the selection
  opens. `DecisionCards` titles nothing itself; it draws the relied-on table in a pane "Relied on ·
  N" after the cards, alone when there is no change.

- [x] **Step 1: Move the rows and folds to `spec/ledger/`**, unchanged, in a `refactor` commit:
      `spec-decisions.test.tsx` passes before and after.
- [x] **Step 2: Write the failing tests.** `ledger.test.tsx`, on the spec-page fixture: in the
      region "Task storage", the row holding "Data MUST be stored in IndexedDB" is named "Changed"
      and its insertion reads "only"; "An upgrade that cannot read a saved value MUST clear it" is
      "Added"; "Components MUST NOT call IndexedDB" is "Removed", inside a deletion; "Why,
      alternatives, consequences · 1 changed" is a collapsed button and its text is not in the page;
      "Repeating tasks": every rule "Added", no insertion inside; "Task history": every rule
      "Removed"; "1 rule unchanged" unfolds on a tap; the decisions page's branch change of task
      storage shows the same rows; a spec without a change shows "Relied on" alone. Browser, desktop
      and phone: the panes' border colours differ by kind, a removed word is struck
      (`text-decoration-line` computed on the deletion, the one style check SC-001 needs), and
      `checkPage` passes at 390 px (SC-006). Break: the sign drawn only as a colour.
- [x] **Step 3: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/ledger.test.tsx`. Expected: FAIL, no row named
      "Changed".
- [x] **Step 4: Implement.** No Astryx `Collapsible` around folded rows: the pane's or the ledger's
      fold mounts nothing folded.
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, `ledger.test.tsx` in both
      browser projects, and the UI tests of the decisions pages
      (`nix develop -c vp test src/__tests__/decision`). Expected: PASS.
- [x] **Step 6: Commit**: `git commit -m "feat(spec-page): a decision's change as a ledger"`.

## Task 5: The live window, for stories and HTML mockups

**Files:**

- Create: `packages/web/src/LiveWindow.tsx` (the window's pane, title, and full screen, out of
  `StoryEmbed.tsx` and `StoryFrames.tsx`, in a `refactor` commit first), `src/LiveFrame.tsx` (the
  hatched stage, the scaled frame, its lazy loading; full screen at 100%), `src/MockupEmbed.tsx` (an
  HTML mockup in the window), `src/EmbedNode.tsx` (`Blocks`' story or mockup paragraph, out of
  `Blocks.tsx`, at 491 lines), `src/theme/windowIcons.ts` (the monitor, phone, and full-screen
  glyphs; `lucide.ts` is at its 500 lines)
- Modify: `src/StoryEmbed.tsx`, `src/StoryFrames.tsx`, `src/embedLayout.ts` (`useOutgrow` grows
  toward a mockup's own width), `src/Blocks.tsx`, `src/stories.tsx` (the version's mockups beside
  its stories, `useMockupAt`), `src/views.ts`, `FilePage.tsx`, `spec/SpecPage.tsx`, `ReviewPage.tsx`
  (pass `mockups`), `src/layout/Pane.tsx` (the title wraps before its actions, or under them where
  they leave it under 160 px), `packages/binding/test-utils.ts`
  (`addSpecFeature({ stories: true })`, `addSpecStories`); the core's `MockupEmbed.query` (wave 1's
  review)
- Test: `src/__browser__/live-window.test.tsx` (create), `src/__browser__/story-embed.test.tsx` (the
  bezel and the bar follow the window, R3), `src/__tests__/spec-stories.test.tsx` ("link an HTML
  one" becomes "draws live")

**Interfaces:**

- Consumes: `Pane`'s `live` tone, `actions`, `titleSuffix` (Task 3); `VersionView.mockups` (Task 1).
- Produces: every live story and HTML mockup drawn by `Blocks` is a `Pane` toned `live`, titled
  "live · <label>", suffixed "· <width> px · <scale>%", a phone or monitor icon by width, its
  actions the comment and pick controls and "Full screen", on a hatched stage. A desktop width is
  scaled to the window's room, a phone width shown at its size, 100%, wherever it fits, scaled down
  where it does not; full screen shows it at 100%, the browser's own, or where it has none for an
  element, as on an iPhone, the window as an overlay covering the screen, which the button, Escape,
  and Back leave. A story keeps its Phone/Desktop switch; an HTML mockup shows at its link's width.
  `MockupEmbed({ folder: string; mockup: MockupEmbed })`: the served path with its anchor, in the
  same sandbox as `MockupPage`'s frame, lazy; a failed load draws "This mockup could not be loaded."
  and a link "Open the mockup's page" to `/f/<folder>/mockups/<name>`. Built:
  `MockupEmbed({ folder, id?, mockup })`; the frame loads the served path, then the link's query
  (`MockupEmbed.query`) and anchor; a `HEAD` request tells a failed load, which the sandboxed frame
  cannot. A story's window stays one element through its states, its controls drawn into the top
  border through a portal. On the phone a story opens at the phone's width, with the switch as named
  icons (R7).

- [x] **Step 1: Move the frame's title, stage, and scale to `LiveWindow.tsx`**, unchanged, in a
      `refactor` commit: `story-embed.test.tsx` passes before and after.
- [x] **Step 2: Write the failing tests.** `live-window.test.tsx`, over the spec-page fixture with a
      preview: at 1440 px the "Repeat menu, open" window is a region named "live · Repeat menu,
      open", its title reading "1440 px" then a percent below 100; the phone switch reads "402 px ·
      100%"; at 390 px, once Desktop is picked (R7), a desktop story's percent is below 50, its
      title clear of its buttons, and the page passes `checkPage`; "Full screen" shows "100%"; US4's
      `mockups/title.html` is a window "live · Title with a repeat phrase" whose frame shows "every
      monday"; a link `?w=390#x` loads at 390 px with its anchor (Review focus 6); a missing mockup
      shows "This mockup could not be loaded." and the link. Break: the scale kept in full screen.
- [x] **Step 3: Run them to check they fail**:
      `nix develop -c vp test --project desktop src/__browser__/live-window.test.tsx`. Expected:
      FAIL, no region "live · Repeat menu, open".
- [x] **Step 4: Implement.** The hatched stage is the Astryx gap of
      [Complexity tracking](#complexity-tracking); the frame's sandbox stays
      `allow-scripts     allow-popups` for stories and `allow-scripts` for HTML mockups.
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, then
      `live-window.test.tsx`, `story-embed.test.tsx`, `story-comments.test.tsx`, and
      `story-variants.test.tsx` in both browser projects, and `spec-stories.test.tsx`. Expected:
      PASS.
- [x] **Step 6: Commit**: `git commit -m "feat(spec-page): live mockups in a live window"`.

## Task 6: How it is built, in panes

**Files:**

- Create: `packages/web/src/spec/builtParts/` (the edge cases and the criteria, and what the parts
  share, out of `BuiltParts.tsx`, in a `refactor` commit first); `src/theme/lucideParts.ts`
  (Lucide's `shield` and `lightbulb`, beside `lucide.ts`, near its size limit)
- Modify: `src/theme/icons.ts` (`uraeda:layers`, `uraeda:shield`, `uraeda:ruler`,
  `uraeda:lightbulb`)
- Modify: `src/spec/BuiltParts.tsx`
- Test: `src/__tests__/spec-parts.test.tsx`

**Interfaces:**

- Produces: `BuiltParts`' props unchanged. Architecture, "Edge cases · N", "Success criteria · N",
  and Assumptions are `Pane`s with their icons and their part's anchor as id; the counts are
  `Pane`'s `count`, so the regions keep the part's name (R8); niche edge cases fold under "N niche
  cases" inside the edge cases' pane, not mounted while folded (R9); nothing else changes.

- [x] **Step 1: Split `BuiltParts.tsx`**, unchanged, in a `refactor` commit; `spec-parts.test.tsx`
      passes before and after.
- [x] **Step 2: Write the failing tests**: regions "Architecture", "Edge cases", "Success criteria",
      and "Assumptions", the headings "Edge cases · N" and "Success criteria · N", N the spec-page
      fixture's counts of rows and criteria, written as numbers in the test; the niche fold a
      collapsed button whose cases are not in the page. Break: niche cases hidden but mounted.
- [x] **Step 3: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/spec-parts.test.tsx`. Expected: FAIL, no heading named
      "Edge cases · 5".
- [x] **Step 4: Implement.**
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, and `spec-parts.test.tsx`
      in both browser projects. Expected: PASS.
- [x] **Step 6: Commit**: `git commit -m "feat(spec-page): how it is built, in panes"`.

## Task 7: The plan page

**Files:**

- Create: `packages/web/src/PlanPage.tsx`
- Create: `packages/web/src/planParts.ts` (the plan's opening runs and sections, from the tree)
- Modify: `src/FilePage.tsx` (every plan to `PlanPage`); `src/views.ts` (selects `PlanItems.lead`);
  `src/YourReview.tsx` (takes `Band` from `ReviewHeadings.tsx`)
- Delete: `src/ReviewPage.tsx`, `src/ReviewHeadings.tsx`
- Test: `src/__tests__/plan-page.test.tsx` (create); `src/__tests__/review.test.tsx`'s plan test
  moves there (R4)

**Interfaces:**

- Consumes: `PlanItems.lead` (Task 1); `Pane` (Task 3).
- Produces: `PlanPage({ file: File })`: crumbs, the title (its anchor as id), its status badge, then
  a `Pane` per lead paragraph titled by its label (Goal, Architecture, Spec), its text without the
  label, `lead-<label as an anchor>` as id (`lead-goal`); a `Pane` per `##` section titled by its
  heading, its anchor as id; a `Pane` per task titled "Task N · <title>" with its `done/total`
  badge, its heading's anchor as id (a link `plan.md#task-5-…` lands on it), its steps drawn as
  today. Waiting for review, the review's selection, comments, and `ReviewEnd`, as `ReviewPage` had,
  the title and each section's heading line (drawn as written at its pane's top) selectable too;
  otherwise read-only. Task 10 adds its column.

- [x] **Step 1: Write the failing tests** in `plan-page.test.tsx`: the questions page's plan as a
      fixture plan (`fixtures/plan-page/plan.md`, a copy of
      `specs/2026-10-24-questions-page/plan.md` at this plan's commit), auto-approved: regions
      "Goal", "Architecture", "Review focus", "Global constraints", "Waves", then "Task 1 · The
      session's view, scrolling in the round's column" holding "6/6" (R10); waiting for review, the
      same regions and "Approve"; a plan with no tasks has its sections and no task region; the
      plan-review fixture's "Task 5 · Repeats typed in the title" holds "2/5". Break: an approved
      plan drawn by the generic page.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/plan-page.test.tsx`. Expected: FAIL, no region "Goal".
- [x] **Step 3: Implement.**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, `plan-page.test.tsx`,
      `review.test.tsx`. Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(spec-page): the plan page in panes"`.

## Task 8: Catch up with the questions page

- [x] **Step 1: Merge the questions page's branch** (`git merge 2026-10-24-questions-page`), keeping
      both sides' code; a conflict in a file this plan's tasks changed keeps both behaviours, and a
      conflict needing a choice the specs do not settle is a reason to stop.
- [x] **Step 2: Run the validation**: `nix develop -c vp run ready`. Expected: PASS, or failures the
      questions page's branch already has, written in the merge commit's body.
- [x] **Step 3: Check this box and commit** with the merge.

## Task 9: The spec's parts in panes

**Files:**

- Modify: `packages/web/src/spec/SpecPage.tsx`, `src/spec/SpecOpening.tsx`,
  `src/spec/ReviewAnswers.tsx`, `src/spec/StoryCard.tsx`, `src/spec/DataPart.tsx` (from
  `Items.dataModel`), `src/spec/SpecHistory.tsx`, `src/spec/parts.ts`, `src/FilePage.tsx` (a data
  model alone to `DataModelPage`), `src/views.ts` (`dataModel`), `src/layout/Pane.tsx` (a pane's
  heading is `<id>-title`, R14), `src/spec/SpecContents.tsx` and `src/Folds.tsx` (jumps, R14),
  `src/theme/lucideParts.ts` and `src/theme/icons.ts` (`badge-check`, `map`, `scale`, `database`)
- Create: `src/spec/DataModelPage.tsx`
- Delete: `src/spec/Panel.tsx`
- Test: `src/__tests__/spec-panes.test.tsx` (create); `spec-page.test.tsx`, `spec-parts.test.tsx`,
  `spec-stories.test.tsx`, `review.test.tsx`, and `__browser__/spec.test.tsx`, `review.test.tsx`,
  `attach.test.tsx` follow the panes (R2, R13)

**Interfaces:**

- Consumes: `Items.dataModel` (Task 1); `Pane` (Task 3); the ledger (Task 4); `BuiltParts` (Task 6).
- Produces: the spec page's parts as `Pane`s, the format's order kept: the block's pane, active
  (mauve), titled as the [global constraints](#global-constraints) say, "You approve" first, the
  other items, the text before the first section, then, after a separator, the time and risk pills,
  the principles, and the risk's reason (C1); "Your review, answered"; a heading "Decisions · 1 new,
  1 changed, 1 removed" with the ledger's panes; "User stories · N" with a pane per story titled
  "US1 · <title>" and its priority; "Data · data-model.md · N" with a pane per section, its changes
  as badges; "How it is built"; history folded in a pane, not mounted while folded, as a story's
  more scenarios are. The ids of `parts.ts` stay, for Contents. On the phone, no band and no
  sticking head; a story's pane keeps only its top border (R13). `DataModelPage({ file })` draws a
  data model alone with the same panes.

- [x] **Step 1: Write the failing tests** in `spec-panes.test.tsx`, on the spec-page fixture: the
      first region is "Spec to review, revision 2, about 10 minutes." holding "You approve" before
      any other item (US1 key 1); the principles come after a separator in that region (C1); a
      heading "Decisions · 1 new, 1 changed, 1 removed" follows the region "Your review, answered"
      (US1 key 2); "Data" holds regions "Task" and "Repeat rule" after the stories, their "New" and
      "Changed" badges (US1 more 1); `/f/<folder>/data-model.md` shows the same regions (US1 more
      2); the approved fixture shows the panes and no "Approve" (US1 more 3). Break: a data model
      parsed again in the web, which the core's sections would not match.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/spec-panes.test.tsx`. Expected: FAIL, no region "Spec to
      review, revision 2, about 10 minutes.".
- [x] **Step 3: Implement**, deleting `Panel.tsx` and `DataPart`'s parsing.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, the spec page's UI tests,
      and `spec.test.tsx` and `spec-parts.test.tsx` in both browser projects. Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(spec-page): the spec's parts in titled panes"`.

## Task 10: Contents and Review beside the spec and the plan

**Files:**

- Create: `packages/web/src/spec/SpecColumn.tsx` (the tabs of the spec and the plan, the phone's
  status line and sheets), `src/spec/ReviewTab.tsx`
- Modify: `src/spec/SpecContents.tsx` (a tab's panel: the rows, the part at the top marked, counts),
  `src/spec/SpecPage.tsx`, `src/PlanPage.tsx`, `src/review/useReview.tsx` (`choices`),
  `src/ReviewVerdict.tsx` (exports `Verdicts`, reads `choices` from the review),
  `src/YourReview.tsx`
- Test: `src/__tests__/spec-column.test.tsx` (create), `src/__browser__/spec-column.test.tsx`
  (create); `spec-page.test.tsx`'s Contents tests follow the tab (R2)

**Interfaces:**

- Consumes: `DocumentColumn`, `useColumnTab` (questions page); `jumpTo`, `useQuestionAtTop`,
  `afterSheetCloses` (`roundJump.ts`); `PlanPage` (Task 7); the spec's panes (Task 9).
- Produces: `Review.choices: [Choices, (choices: Choices) => void]`, kept by `useReview` for the
  page's life; `ReviewVerdict` and `Verdicts` read it, so either commits what the end's form set.
  `SpecColumn({ content: ReactNode; contents: ReactNode; file: File; review: Review | undefined; extra?: ReadonlyArray<ColumnTab> })`:
  on wide and semi-wide screens, a `DocumentColumn` labelled "The spec's column" or "The plan's
  column" (R16) with "Contents", then "Review" with the comments' count while a review waits, then
  `extra` (Task 11's Session); on narrow screens, a `TopBarSlot` with "Contents" and the count
  opening sheets of the same panels, and "Verdict" bringing the page's end's verdict into view, its
  first enabled button focused (`toVerdict`, `VERDICT_ID` in `ReviewVerdict.tsx`). A panel jumps
  through `useColumnGo()` (`spec/columnGo.ts`), which closes the phone's sheet first.
  `ReviewTab({ review: Review; file: File })`: "N comments, unsent", each comment a button named by
  its place that jumps to it, "General comment", then `Verdicts`, and "Risk tier, plan review, and
  your summary are with the verdict at the page's end." with a link there. A comment's button brings
  its block to the middle of the screen and focuses its toggle (`jumpToComment`, through each
  pending note's id `comment-<n>`). The verdict's commit is `useVerdict(file, choices, refusals)`,
  shared by the end and the tab. Contents marks the part at the top with `useQuestionAtTop` over its
  ids; its groups read "Decisions · N" (the decisions listed) and "User stories · N". The plan page
  has Contents (its panes) and, waiting, Review.

- [x] **Step 1: Write the failing tests.** UI (`spec-column.test.tsx`): Contents is the selected tab
      with "What you approve", "Decisions · 3", each decision, each story; two comments, on a rule
      and a scenario, are listed in Review with their places, and a tap on the second scrolls to it
      and focuses its block (US4 key 2); set the tier to medium at the end (the fixture's is already
      high), open Review, Approve: the commit carries `risk-tier: medium` (US4 more 3, Review focus
      4); type a comment, switch to Review and back, then cross to 402 px and back: the text is
      there, "Unsaved changes" (US4 more 2); 402 px: the status line holds "Contents", "2" (named "2
      comments"), and "Verdict", each opening its sheet or jumping (US1 key 3); the plan has
      Contents and Review (US6). Browser (`spec-column.test.tsx`): at 1440 px the column is 480 px
      with Contents open (US4 key 1); switching tabs moves no pane's left, top, or width (SC-005);
      folded with `]`, a desktop live window's percent grows (Review focus 7); `checkAccessibility`
      in Mocha and Latte. Break: the choices kept in the end's form only.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/spec-column.test.tsx`. Expected: FAIL, no tab
      "Contents".
- [x] **Step 3: Implement.** The 320 px Contents column and its `uraeda.specContents` storage go.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, the spec and review UI
      tests, `spec-column.test.tsx` and `review.test.tsx` in both browser projects. Expected: PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(spec-page): Contents and Review beside the spec and the plan"`.

## Task 11: Asking the agent from the spec and the plan

**Files:**

- Modify: `packages/web/src/ReviewCommentForm.tsx` (Ask on a decision's lines, shown where the
  review's `ask` is), `src/useReviewActions.ts` and `src/review/useReview.tsx` (`onAsk`, the page's
  asking, takes the quote), `src/spec/SpecPage.tsx`, `src/PlanPage.tsx` (the Session tab and the
  page's draft), `src/ColumnSession.tsx` (`sessionTab(draft, folder)`,
  `useColumnAsk(folder, draft)`, shared with `RoundColumn.tsx`), `src/spec/SpecColumn.tsx` (the
  phone's Session button with no review, as the mockup's plan)
- Create: `src/reviewQuote.ts` (`quoteOfRange`: the file's lines, or a decision's parts' words,
  R17), `src/spec/pageSession.ts` (`usePageSession(file)`: the draft, the tab, and `ask`, where the
  agent is available and the feature has its branch)
- Test: `src/__tests__/spec-asking.test.tsx` (create); `review.test.tsx`'s and `session.test.tsx`'s
  asking tests follow (R2, R18)

**Interfaces:**

- Consumes: `ColumnSession({ draft, folder })`, `useDraft()`;
  `withQuote(text: string, quote: string): string` (questions page's Task 8); `SpecColumn`'s `extra`
  (Task 10).
- Produces: with the feature's agent available and the spec on its branch, a "Session" tab holding
  `ColumnSession` with the page's draft. "Ask the agent" on any selection, a decision's part
  included: on wide screens, `withQuote` writes the quote into the draft and Session opens; on
  narrow screens, `askAbout` opens the session's page. The quote: `About <path>, lines A–B:` then
  each line of the selection as `> `; for a decision's part, `<path>` is
  `specs/decisions/<name>.md`, the lines the part's (`after`, or `before` for a removed part, then
  "About the removed rule of <path>, lines A–B:"), and the quoted line the part's words on its side.

- [x] **Step 1: Write the failing tests** in `spec-asking.test.tsx`, with the fake agent: select
      "Data MUST be stored in IndexedDB", click "Ask the agent": the tab "Session" is selected and
      the composer holds "About specs/decisions/task-storage.md, lines 15–16:" then "> Data MUST be
      stored in IndexedDB, only through src/store/: components never reach the database themselves."
      (US4 key 3; the part's words, without markdown, R17); the removed rule "Components MUST NOT
      call IndexedDB" quotes "About the removed rule of specs/decisions/task-storage.md, lines
      16–17:" (Review focus 5); at 402 px, asking about a paragraph opens the session's page with
      the quote, and Back shows the spec at the place it was left (US4 more 1); without an agent,
      and on the default branch, no "Session" tab and no "Ask the agent"; the plan page asks about a
      step the same way; an approved plan has the Session tab, and at 402 px a "Session" button in
      its status line. Break: a decision quoted with the spec's path.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/spec-asking.test.tsx`. Expected: FAIL, no "Ask the
      agent" on the rule.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, `spec-asking.test.tsx`,
      `review.test.tsx`, and `column-session.test.tsx` in the desktop project. Expected: PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(spec-page): ask the agent about any block, in the column"`.

## Task 12: What changed since your review

**Files:**

- Create: `packages/web/src/spec/SinceReview.tsx` (the pane, the Δ marks, which blocks a change
  holds); `addRevisedSpec(repo, options?)` in `packages/binding/test-utils.ts`
- Modify: `src/spec/SpecPage.tsx`, `src/spec/SpecContents.tsx` (Δ on a row), `src/spec/parts.ts` (a
  change's place, by the Contents entry owning its block, and, in a story, its journey or scenario),
  `src/Blocks.tsx` only if a block cannot be marked from its parts otherwise
- Test: `src/__tests__/since-review.test.tsx` (create)

**Interfaces:**

- Consumes: `FileView.sinceReview` (Task 2); the spec's panes (Task 9); Contents (Task 10).
- Produces: `addRevisedSpec(repo)`: the spec-page fixture's spec at revision 1 committed on its
  branch, with US1's and US2's journeys as they were ("for 3 seconds"), no `## Your review`; then
  `spec-review.md` `changes-requested`, its `commit:` that commit's short hash; then the fixture's
  revision 2. A "Since your review · N parts changed" pane, `id="since"`, under the block: each
  place a button jumping to it, named "US1's journey", "US2, key scenario 1", "Your review,
  answered", or the Contents label of its part; removed places struck under a fold "N parts
  removed"; not found: "The version you reviewed is not in git anymore."; found without parts: "No
  part changed since your review.". Each block holding a change's `after` lines is marked "Δ", named
  "Changed since your review", its words drawn with the ledger's runs; Contents rows owning one
  carry the mark.

- [ ] **Step 1: Write the failing tests** in `since-review.test.tsx`, on `addRevisedSpec`: "Since
      your review · 3 parts changed" lists "US1's journey", "US2's journey", "Your review, answered"
      (US5 key 1); US2's journey is marked "Changed since your review", its deletion "3", its
      insertion "5" (US5 key 2); every block marked is one of those parts, and no other block is
      (SC-003); Contents marks US1, US2, and "Your review, answered" only; a revision 1 spec has no
      "Since your review" and no mark (US5 more 1); with a paragraph removed, "1 part removed" folds
      its struck text (US5 more 2); a change in US2's journey and its key scenario 1 lists both, and
      Contents marks US2 once (Review focus 3); `addSpecFeature`'s fake commit: "The version you
      reviewed is not in git anymore." and no mark; only the frontmatter changed: "No part changed
      since your review." (Review focus 2). Break: a mark placed by heading rather than by lines,
      which marks the whole story.
- [ ] **Step 2: Run them to check they fail**:
      `nix develop -c vp test src/__tests__/since-review.test.tsx`. Expected: FAIL, no region "Since
      your review · 3 parts changed".
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, the spec page's UI tests.
      Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat(spec-page): what changed since your review"`.

## Task 13: The sandbox, the stories, the screenshots, and the mockup's README

**Files:**

- Modify: `packages/web/samples/projects.ts` (the sample project adds the spec-page features,
  waiting, approved, and revised, with a preview), `src/SpecPage.stories.tsx` (Waiting, Revised,
  Approved, Review tab, Session tab with a quote), `src/PlanPage.stories.tsx` (create: auto-approved
  and waiting), `src/spec/DecisionCard.stories.tsx`, `packages/web/scripts/spec-shots.ts` (the plan,
  the revision, the column's tabs, the data model alone)
- Create: the screenshots in `specs/2026-10-24-spec-page/screenshots/`
- Modify: `specs/2026-10-24-spec-page/mockups/README.md` (where the stories live)

- [ ] **Step 1: Write the stories and the sandbox's features**, over the fixtures.
- [ ] **Step 2: Build them**: `nix develop -c vp run storybook:build`. Expected: PASS.
- [ ] **Step 3: Take and review the screenshots** of the spec waiting, revised, and approved, its
      Review and Session tabs, the ledger on the decisions page, a live window in full screen, the
      plan, and the data model alone, at both sizes and in both schemes, against the UI look,
      layout, and coherence decisions, and commit them. `checkAccessibility` on the spec and plan
      pages in both schemes runs in `vp run ready` (SC-002).
- [ ] **Step 4: Run the whole validation**: `nix develop -c vp run ready`. Expected: PASS.
- [ ] **Step 5: Commit**:
      `git commit -m "docs(spec-page): the stories, the sandbox, and the screenshots"`.
