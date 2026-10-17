---
status: auto-approved
spec-revision: 2
---

# Plan: Redesign and reword specs

**Goal:** a spec reads as one page you approve in one sitting: what you approve, your review
answered, the decisions with their changes marked in place, the stories as cards, then the data and
how it is built. Decisions are short and change only on their branch.

**Architecture:** the skill describes the format once, in its references and templates. The core
owns everything read from it: the spec's parts, the review answers, the stories' key and more
scenarios, a decision's change computed from git, and the warnings of `ura check`. The web draws the
core's parts as cards and never reads markdown itself. See the
[spec's architecture](spec.md#architecture).

- **The format** is owned by the templates, which
  [`check/sections.rs`](/crates/core/src/check/sections.rs) reads, and by the spec parser,
  [`files/spec.rs`](/crates/core/src/files/spec.rs), which sends `SpecItems`. Every reader of a
  spec's parts, including the step that finds pending decisions, uses `SpecItems`.
- **A rule's strength** (MUST, SHOULD, MAY) is read in one place, `decisions::strength`, used by the
  comparison, the order warning, and the page's icons.
- **A decision's change** is never stored. `decisions::compare` turns two texts into parts; the API
  reads the two texts, at the merge base and on the branch, through the `git` module, and sends them
  with the spec's file view. The page draws them and comments on them.
- **The approval commit** of a branch is found in one function, used by `decision.unapproved`.
- **The page** is one component per part, under `packages/web/src/spec/`, inside one `Panel` that is
  a card on a wide screen and a sticky-titled section on the phone. The comment machinery of today's
  review page is shared, not copied.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both. Its
review comments are in [spec-review.md](spec-review.md).

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **The approval step's own edit**: setting a decision `active`, and its `approved-by`, after the
   approval commit, must not warn `decision.unapproved`. Only the decision's text beyond these two
   fields counts. Task 9.
2. **A decision file renamed on the branch** shows as one removed and one new decision, never as a
   failure to compare. Task 3.
3. **A `## Decisions` item whose link points outside `specs/decisions/`** is not a listed decision:
   it neither makes the approval step pending nor marks a card listed. Task 2.
4. **The "Relied on" table's links** never make the approval step pending, even to a `proposed`
   decision. Task 2.
5. **A spec without `data-model.md`** draws no "Data" part, and no entry in "Contents". Task 12.
6. **A comment on a decision part while the review is pending at another commit** follows the same
   freshness rule as a comment on the spec: the review is kept only if the spec is unchanged since.
   Task 8.
7. **A spec at revision 2 whose review file is gone**, after approval: each answer shows without a
   quote, never an error. Task 10.
8. **Two `## Decisions` items for the same decision** count it once. Task 2.

### Test map

Each scenario, edge case, and criterion of the spec, and the task whose tests cover it.

| Spec                                                           | Task | Test                                                         |
| -------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| US1 1, more 1; US6 4                                           | 2    | `crates/core/tests/check.rs`, the sections of the new format |
| US1 2, more 2; US2 more 2; US6 1; US8 more 1                   | 6    | `crates/core/tests/check.rs`, the new warnings and problem   |
| US1 3; SC-001; SC-002                                          | 6    | `crates/core/tests/check.rs`, the example and the decisions  |
| US6 2                                                          | 2    | `crates/core/tests/steps.rs`, approval from listed items     |
| US6 3                                                          | 9    | `crates/core/tests/unapproved.rs`                            |
| Edge cases: rewritten rule, rewrap, 60%                        | 3    | `crates/core/tests/decision_change.rs`, table-driven         |
| Edge cases: merge base, merged default branch, deleted, equal  | 7    | `crates/core/tests/decision_change.rs`, over branches        |
| Edge case: old format fails `ura check`                        | 2    | `crates/core/tests/check.rs`                                 |
| US2 3; edge case: comment on a removed part                    | 8    | `crates/core/tests/actions.rs`; `review.rs` round trip       |
| US2 1, 2, more 1, 3, 4, 6; edge cases: removed and equal cards | 13   | `packages/web/src/__tests__/spec-decisions.test.tsx`         |
| US2 more 5, 7                                                  | 13   | `packages/web/src/__tests__/links.test.ts`, `spec-decisions` |
| US2 more 3                                                     | 13   | `packages/web/src/__browser__/spec.test.tsx`                 |
| US3 1, 2, 3; edge case: no "More scenarios"                    | 11   | `packages/web/src/__tests__/spec-stories.test.tsx`           |
| US4 1, 2; edge cases: revision 1, approved spec                | 10   | `packages/web/src/__tests__/spec-page.test.tsx`              |
| US5 1, more 1, more 2                                          | 10   | `packages/web/src/__tests__/spec-page.test.tsx`              |
| US5 2, 3                                                       | 10   | `packages/web/src/__browser__/spec.test.tsx`                 |
| US7 1, 2                                                       | 4    | `packages/web/src/__browser__/reading-place.test.tsx`        |
| US7 3; edge case: unsaved draft                                | 5    | `packages/web/src/__tests__/editor.test.tsx`                 |
| US8 1, 2, 3, 4, more 2                                         | 12   | `packages/web/src/__tests__/spec-parts.test.tsx`             |
| SC-003                                                         | 7    | `packages/server/src/__tests__/spec.bench.ts`                |
| SC-004                                                         | 14   | `packages/web/src/__browser__/spec.test.tsx`, accessibility  |
| Error handling: a decision's old version unreadable            | 7    | `crates/core/tests/decision_change.rs`                       |
| Error handling: an answer naming a missing comment             | 10   | `packages/web/src/__tests__/spec-page.test.tsx`              |
| Edge case: a comment's lines changed after the review          | 8    | existing behaviour, kept: `crates/core/tests/actions.rs`     |

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these.

From the [data model](data-model.md), word for word:

- The sections of `spec.md`, in order: frontmatter; `# Spec: <name>`; the `> [!IMPORTANT]` block,
  "the time, then at most 7 items, the first starting 'You approve'"; `## Your review`, "revision 2
  on: one item per comment of the last review, with its answer"; `## Decisions`; `## User stories`;
  `## Architecture`; `## Edge cases`; `## Success criteria`; `## Assumptions`;
  `## Constitution check`; `## Risk tier`; `## History`, "optional: the records of earlier reviews,
  oldest last". `## Mockups` and `## Details` are gone.
- A `## Your review` item:
  `- **C2** (<the comment in a few words>): <done or declined>. <what was done, or why not>.`
- An edge case row: `| High | <situation> | <what happens> |`. A criterion:
  `- **SC-001** (<measure in a few words>): <the outcome>.` A unit of the architecture:
  `- **<Unit>** <what it does, and the rules it owns>.`, then the paragraph `Tradeoffs:` and one
  item per cost.
- "A rule's strength is its first RFC 2119 keyword; rules order MUST and MUST NOT first, then SHOULD
  and SHOULD NOT, then MAY."
- A `## Decisions` item:
  `- **<New or Changed>: [<title>](../decisions/<name>.md)**. <One sentence: the rule, or what changed.>`
  A removed decision: `- **Removed: <title>** (\`<name>.md\`). <Why.>` "Only the items count as
  listed, not the table's links."
- "A decision's change is the difference between its file on the feature's branch and at the merge
  base of the branch and the default branch. Both versions are cut into parts, each a paragraph or a
  list item with its lines joined, so a rewrap is no change. Two parts are the same part when they
  sit in the same section and keep at least 60% of the shorter one's words: they compare word by
  word. Otherwise, one is new and the other removed."
- A comment on a decision: `## C4: Decision task-storage, lines 20–21, under "Rules"`. "The line
  numbers are those of the decision's file at the review's `commit`. A comment on a removed part
  points to the default branch's lines, with `removed` after the lines."
- The warnings: `spec.length`, "a waiting spec's reviewed part is over 2,500 words", "the spec's
  reviewed part is 3,100 words: aim at 2,000"; `block.items`, "the block has 8 items: keep at most
  7"; `decision.rules`, "12 rules: keep at most 10, or split the topic"; `decision.order`, "a MUST
  rule after a SHOULD one: put the strongest first"; `decision.unapproved`, "git.md changed after
  the spec's approval". The problem `edges.importance`, "importance is high, normal, or niche".
- "The reviewed part of a spec is every section but 'More scenarios' lists and `## History`. The
  approval commit is the branch's commit whose spec first reads `status: approved`."

From the [spec](spec.md):

- "Two parts are the same part when they sit in the same section and keep at least 60% of the
  shorter one's words. Otherwise, one is new and the other removed."
- "The reading measure inside cards is 75 characters."
- "The time estimate counts the reviewed part at 250 words a minute, plus a minute per mockup and
  per changed decision, rounded up to 5."
- "No diff dependency: the comparison is a small module of the core's own."
- "The rewritten decisions keep their headings, so the 26 records stay valid."

From the decisions:

- [Stack](../decisions/stack.md): "The web UI MUST draw workflow files from the core's document
  tree, never parsing their markdown; only an agent's messages MAY use Astryx's `Markdown`." And
  "Workflow logic, parsing, validation, and states MUST live in the Rust core, and TypeScript MUST
  reach them only through the binding, with the types napi-rs generates, never reimplemented."
- [Git](../decisions/git.md): "Rust tools MUST read git with gix, built with only the features they
  need, and run the system `git` for writes and reads gix lacks, linking no other git library." And
  "In Rust, every git access MUST go through one core module, which parses only `git`'s
  machine-readable output."
- [Code quality](../decisions/code-quality.md): "Rust and TypeScript functions MUST NOT be longer
  than 100 lines, take more than 7 parameters, or nest blocks more than 4 levels deep." "Rust and
  TypeScript source files MUST NOT be longer than 500 lines, except tests and generated files." "A
  new marker MUST NOT be added unless a human approves it as a constitution exception in the plan."
  "Unit tests MUST NOT sleep for a fixed time or assert how long something took, except benchmarks
  of a spec's success criteria."
- [UI components](../decisions/ui-components.md): "Views MUST use an Astryx component wherever one
  fits the job." "Styles MUST be written with StyleX, in the file of the component that uses them,
  from the theme's tokens and sizes, raw values only for `0`, percentages, `auto`, and keywords."
- [UI layout](../decisions/ui-layout.md): "The UI MUST have two width classes, split at the theme's
  `md` breakpoint, 768 px, which components read from the shared hook or theme, never their own
  media queries." "A column that takes room from a view's main content MUST be foldable and
  resizable, keeping its state in the browser."
- [UI checks](../decisions/ui-checks.md): "UI tests MUST drive the UI as a user does, by roles,
  labels, and visible text, and MUST NOT assert markup, class names, snapshots, or pixel
  comparisons." "Before handing over a UI change, the agent MUST screenshot every changed view at
  both sizes and in both themes, review and fix them against the decisions and the mockups or
  proposal, and commit them under the folder's `screenshots/`."
- [Compatibility](../decisions/compatibility.md): "a change to the format of a workflow file, a
  template of the skill, or a rule of `ura check` MUST NOT keep the old format working: no fallback
  reading, no migration code, no optional section kept only for older files." "A feature that
  changes a format MUST update the skill's templates and examples, the fixtures, and the files of
  the default branch that the change makes fail `ura check`, in the same branch."

Existing guarantees to keep:

- `vp run ready` runs `ura check specs` and `ura check skills/uraeda/assets/example/specs`
  ([`vite.tasks.ts`](/vite.tasks.ts), `specs:check`): both pass after every task.
- Warnings never fail `ura check`, never stop a step, and print after errors as
  `warning: <file>:<line>: <message>` ([`crates/cli/src/check.rs`](/crates/cli/src/check.rs)).
- A plan waiting for the human keeps today's review page
  ([`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx)), its comments, and its verdict.
- A comment keeps its quote when its lines change after the review's commit
  ([`actions/review.rs`](/crates/core/src/actions/review.rs), `fresh`).

## Code read

- [`files/spec.rs`](/crates/core/src/files/spec.rs) (205 lines) and
  [`files/items.rs`](/crates/core/src/files/items.rs) (409): the spec's stories, "Why this
  priority", the list after a paragraph ending "scenarios:", `SC-` criteria, and the `Mockups` and
  `Details` sections by name. `items.rs` holds every item type and no tests. Tested in
  [`tests/items.rs`](/crates/core/tests/items.rs), over the skill's example spec.
- [`files/items/round.rs`](/crates/core/src/files/items/round.rs): the model to follow, a section
  cut by its `###` headings into parts of block ids, quoted headings skipped.
- [`check/sections.rs`](/crates/core/src/check/sections.rs) (440): the required, unknown, and
  ordered sections come from the embedded templates; a heading whose body starts `[Optional` is
  optional. [`check/writing.rs`](/crates/core/src/check/writing.rs) (273): the round's warnings,
  `BLOCK_ITEMS`, `measured_text`. [`check/mod.rs`](/crates/core/src/check/mod.rs) (427): `check`,
  `check_file`'s dispatch by kind, `File::problem` and `File::warning`. Tested in
  [`tests/check.rs`](/crates/core/tests/check.rs) (1,595), with `Example` over a copy of the
  example, `summary`, and `each_rule`.
- [`workspace/read.rs`](/crates/core/src/workspace/read.rs): `decisions_pending` reads every link of
  `## Decisions`, the table's included, and `## Proposed change (<folder>)`. Turned into the
  approval step by [`steps.rs`](/crates/core/src/steps.rs), tested in
  [`tests/steps.rs`](/crates/core/tests/steps.rs).
- [`git.rs`](/crates/core/src/git.rs) (466): `tip`, `default_branch`, `read_file`, `list_files`;
  [`git/log.rs`](/crates/core/src/git/log.rs) uses `repo.merge_base` privately. No first-parent
  history walk exists. [`changes.rs`](/crates/core/src/changes.rs) shows a branch's changes against
  the merge base.
- [`api.rs`](/crates/core/src/api.rs) (455): `read_file` and `file_view` build `FileView`
  ([`view.rs`](/crates/core/src/view.rs)) with the feature, its branch tip, and the review.
  [`api/ledger.rs`](/crates/core/src/api/ledger.rs) reads decisions from the default branch only.
- [`files/review.rs`](/crates/core/src/files/review.rs) (254): `Anchor::Lines` and `General`, its
  `Display` and parser. [`actions/review.rs`](/crates/core/src/actions/review.rs) (468): `comment`
  reads the reviewed file at the tip, takes the heading and the quote, keeps the pending review only
  if `fresh`. [`api/reviews.rs`](/crates/core/src/api/reviews.rs): `add_comment`.
- [`files/document/inline.rs`](/crates/core/src/files/document/inline.rs): `SpanLink.path` is
  resolved without its anchor, `target` keeps it.
  [`workspace/links.rs`](/crates/core/src/workspace/links.rs): `resolve` drops it.
- [`crates/cli/tests/structure.rs`](/crates/cli/tests/structure.rs): files over 500 lines may only
  shrink: `files/document.rs` and `workspace.rs`. No task adds to either.
- [`packages/binding/index.d.ts`](/packages/binding/index.d.ts): generated by
  `vp run binding:build`, committed.
  [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts): `fixtureRepo`,
  `commitOnBranch`, `addChange`.
- [`packages/server/src/fate/views.ts`](/packages/server/src/fate/views.ts) `fileDataView` and
  [`fate/file-mutations.ts`](/packages/server/src/fate/file-mutations.ts) `review.comment`: a new
  top-level field of `FileView` is listed in the view; a mutation's input is passed to the binding.
- [`packages/web/src/views.ts`](/packages/web/src/views.ts) (381): `ItemsSelection.spec` selects
  each field by name. [`FilePage.tsx`](/packages/web/src/FilePage.tsx): a waiting spec or plan opens
  `ReviewPage`, anything else `DocumentPage`.
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) (355): `useReviewDraft`, `useStoryComments`,
  `CommentSheet`, `useReviewSelection`, `ReviewIntro`.
  [`ReviewMockups.tsx`](/packages/web/src/ReviewMockups.tsx),
  [`ReviewHeadings.tsx`](/packages/web/src/ReviewHeadings.tsx),
  [`Folds.tsx`](/packages/web/src/Folds.tsx) (`specFolds` reads `story.details` and `spec.details`),
  [`useOpenKeys.ts`](/packages/web/src/useOpenKeys.ts),
  [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx) (comments on the line of
  `items.spec.mockups`), [`YourReview.tsx`](/packages/web/src/YourReview.tsx),
  [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx),
  [`ReviewComments.tsx`](/packages/web/src/ReviewComments.tsx).
- [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts): no place is kept on a wide screen;
  on the phone, `placeAboveSheet` scrolls once the sheet settles.
  [`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx): a frame has no height until its story
  reports one. [`useKeepPlace.ts`](/packages/web/src/useKeepPlace.ts) keeps a place across width
  changes, for the session page.
- [`pane/useDraftEditor.ts`](/packages/web/src/pane/useDraftEditor.ts) and
  [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx): the text box holds the whole file;
  `document.frontmatterLines` is already selected.
- The mockups: [`SpecPage.stories.tsx`](/packages/web/src/SpecPage.stories.tsx),
  [`mockups/`](/packages/web/src/mockups/) (`SpecMockup`, `SpecStory` with `Panel`, `SpecParts`,
  `DecisionChange`, `RuleLine`, `decisionTexts`), and
  [`.storybook/specMockup.ts`](/packages/web/.storybook/specMockup.ts), all `TEMPORARY`.
- The round page: [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx),
  [`RoundNav.tsx`](/packages/web/src/RoundNav.tsx),
  [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx),
  [`layout/SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx) (resizable, `]` toggles it; the
  caller keeps "shown", as [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx) does in
  `localStorage`), [`theme/icons.ts`](/packages/web/src/theme/icons.ts).
- Tests: happy-dom in `packages/web/src/__tests__/` over `renderPage` of
  [`helpers.tsx`](/packages/web/src/__tests__/helpers.tsx); WebKit in
  `packages/web/src/__browser__/`, at `phone` 402 × 874 and `desktop` 1440 × 900, with `atSize`,
  `checkAccessibility`, and `colorScheme` of
  [`helpers.tsx`](/packages/web/src/__browser__/helpers.tsx); the model for SC-004 is
  `__browser__/round.test.tsx`'s accessibility test. Server benchmarks in
  `packages/server/src/__tests__/*.bench.ts`.
- Validation, inside `nix develop -c`: `cargo nextest run -p uraeda-core <filter>`,
  `vp run binding:build`, `vp check`, `vp run ts:test`, `vp run browser:phone`,
  `vp run browser:desktop`, `vp run bench`, and `vp run ready` for everything, `specs:check`
  included.

## Constitution check

| Principle                 | Complies | Notes                                                                    |
| ------------------------- | -------- | ------------------------------------------------------------------------ |
| I. Humans stay in control | yes      | decisions change only on their branch, `decision.unapproved` warns after |
| II. Git and plain text    | yes      | a decision's change is computed from git, never stored                   |
| III. Asynchronous         | yes      | every task ends with a commit                                            |
| IV. Review effort         | yes      | the page and the limits are the feature                                  |
| V. Tools optional         | yes      | without Uraeda, `git diff` shows a decision's change                     |
| VI. Checked, maintainable | yes      | tests per scenario; `ReviewPage.tsx` and `items.rs` split before growing |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Stack](../decisions/stack.md): the core parses and compares, the web draws (tasks 2, 3, 7).
- [Git](../decisions/git.md): the merge base and the approval commit through `git.rs` (tasks 3, 9).
- [Compatibility](../decisions/compatibility.md): templates, example, fixtures, and this feature's
  own spec and plan rewritten in task 2.
- [Code quality](../decisions/code-quality.md): the structural steps of tasks 2 and 10.
- [UI layout](../decisions/ui-layout.md), [UI components](../decisions/ui-components.md),
  [UI checks](../decisions/ui-checks.md): tasks 10 to 14.
- [Preview](../decisions/preview.md): the stories of task 14 over the fixture.

## Complexity tracking

| Abstraction or exception                             | Why it is needed                                                                                           | Simpler alternative rejected because                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `crates/core/src/decisions/` module                  | the comparison and a rule's strength serve the file view, the review comments, and `ura check`             | inside `api.rs`: it is at 455 lines, and `check` would reach into the API                    |
| `files/items/spec.rs`, the spec's item types         | `items.rs` is at 409 lines and gains about 120                                                             | growing `items.rs` past 500                                                                  |
| `packages/web/src/spec/`, one component per part     | the page has 8 kinds of part, each drawn its own way (spec C5 and C6), built by three tasks at once        | one `SpecPage.tsx`: past 500 lines, and three tasks in one file                              |
| `spec/Panel.tsx`                                     | every part, decision, and story is a card on a wide screen and a sticky-titled section on the phone        | each part drawing its own card: the phone's sticky title copied 8 times                      |
| `review/` hooks split out of `ReviewPage.tsx`        | the spec page and the plan's review page share the comment form, selection, and story comments             | a copy in the spec page: two comment machineries to keep in step                             |
| `addSpecFeature` in `packages/binding/test-utils.ts` | the web tests, the browser tests, Storybook, and the benchmark need the same branch with changed decisions | each building its own: four fixtures of the same branch                                      |
| `check/unapproved.rs`, reached with git              | `decision.unapproved` is the only check that reads history                                                 | in the CLI: the editor and the web would not see it, and the rule would live outside `check` |

No new marker. No constitution exception.

## Review comments

- **C1** (the decision card's colour bar): no colour bar on the card's side. The strength icon takes
  the colour of its strength: MUST hard green, SHOULD soft green, SHOULD NOT soft red, MUST NOT hard
  red, MAY neutral. The pill and its text say new, changed, or removed. Supersedes the mockup's bar.
  Task 13.
- **C2** (the chevron in "What you approve"): the chevron before the "You approve" sentence sits on
  its first line, next to the text, at the gap of the page's other icons. Task 10.

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1, 2, 3, 4, and 5: the skill's references; the format and its parser; the comparison; the
   reading place; the editor. Different files: task 1 only `skills/uraeda/references/`, `SKILL.md`,
   and `README.md`; task 2 the templates, the example, the fixtures, and the spec parser; task 3 a
   new core module and `git.rs`; task 4 `useCommentDraft.ts` and `StoryFrames.tsx`; task 5 the
   editor.
2. Tasks 6, 7, 8, 9, and 10: the warnings; the branch's decision changes; comments on decisions; the
   approval commit; the spec page. Shared files, each adding its own part:
   `crates/core/src/check/mod.rs` (task 6 in `check_file`, task 9 a `mod` line and a call in
   `check`), `crates/binding/src/lib.rs` and the generated `packages/binding/index.d.ts` (tasks 7
   and 8: regenerate after the merge), `packages/web/src/views.ts` (task 7 a field of `FileView`,
   task 10 none), `packages/binding/test-utils.ts` (task 10 only).
3. Tasks 11, 12, and 13: the story cards, the parts after the stories, the decision cards. Each
   rewrites its own placeholder file of task 10. Task 13 alone touches the core, the links, and the
   icons.
4. Task 14: the whole page's checks, the real stories, and the mockups removed.

---

## Task 1: The skill describes the new format

**Files:**

- Modify: `skills/uraeda/references/approval.md`, `spec.md`, `writing.md`, `plan.md`, `change.md`,
  `finish.md`, `projects.md`, `conventions.md`, `discovery.md`, `cli.md`, `code-quality.md`,
  `implementation.md`; `skills/uraeda/SKILL.md`; `README.md` if it describes a spec's sections or a
  proposed change

**Interfaces:**

- Consumes: nothing.
- Produces: the anchors other files link to: `spec.md#new-decision-or-change`, `spec.md#mockups`,
  `spec.md#tests`, and `spec.md#what-is-a-decision` stay. `writing.md` gains a `## A spec` section.

- [x] **Step 1: Rewrite `approval.md`**

The step runs when `spec.md` is `approved` and a decision named by an item of its `## Decisions`
section is `proposed`. It sets each such decision `active`, new or changed, and `approved-by` to the
approver when it is known: from the human's message, or the author of the `spec(<slug>): approve`
commit. A removed decision is already deleted on the branch: nothing to do. The approval commit,
`spec(<slug>): approve`, is where `decision.unapproved` starts: say that a decision edited after it
needs the human's approval again, and that this step's own two fields do not count. Remove every
`## Proposed change` passage. Keep the review record and the review settings sections.

- [x] **Step 2: Rewrite `spec.md` and `writing.md`**

`spec.md`: the new order of the [data model](data-model.md#spec-file), section by section, as the
global constraints copy it. Its skeleton is the new template's (task 2 writes the template: the
skeleton here matches it heading for heading). `## Details` and `## Mockups` go: data goes to
`data-model.md`, written by the spec step "whenever the feature adds or changes stored data or a
file format, at any size"; components, error handling, and tests go to the plan's test map. Stories:
a journey of one or two sentences, the story link alone in its paragraph, "Why this priority" only
when the order is not obvious, "Key scenarios:" with two or three, "More scenarios:" for the rest,
at most 4 steps each. The decision rules of
[the data model's decision file](data-model.md#decision-file): created or changed only from an
answered question or a review comment asking for it; edited in place on the branch,
`status: proposed`, `approved-by` empty; intent first, two or three sentences; one sentence per rule
ending "Checked by ..."; strongest first; at most 10. A removed decision's file is deleted on the
branch. A revision: `## Your review` answers each comment of the last review, the block says what
changed, and the earlier block record moves to `## History`.

`writing.md`: a `## A spec` section with its rules: the block's first item starts "You approve",
then at most 7 items in all; the time formula of the global constraints; answers paraphrased, never
cited by number; git chores out of the block; each rule stated once, linked elsewhere; the reviewed
part aims at 2,000 words; the split rule, "past 6 stories, 30 scenarios, or 2 changed decisions, the
discovery proposes a split". A `## A decision` section: intent first, one sentence per rule,
strongest first, at most 10. Its list of warnings names `spec.length`, `decision.rules`,
`decision.order`, `decision.unapproved`, and the problem `edges.importance`.

- [x] **Step 3: Update the other references and `SKILL.md`**

In each file, every passage on a proposed change, `## Details`, the spec's Testing, the full
constitution table, or ruling IDs in records: `SKILL.md`'s folder layout, the paragraph on proposed
changes (a decision changes only on its branch, `proposed` until approval), the step table's
approval row (a decision an item of `## Decisions` names is `proposed`), and the revision's answers.
`plan.md`: `data-model.md` is the spec's; the plan keeps internal types and `contracts/`; it drops
its `## Decisions` section, keeps a one-row constitution check, and gains a `## Test map` table
after `## Review comments`, mapping each scenario, edge case, and criterion to its test.
`change.md`: a change edits a decision in place on its branch, `proposed`, and its round links it;
on a "no", the edit is reverted. `finish.md` and the record: changes after approval in words, no
ruling IDs. `projects.md`: postponing reverts the branch's edits to decisions. `conventions.md`: the
structured items of the global constraints, the decision comment heading, and a decision going back
to `proposed` on a branch. `discovery.md`: the split rule, linked to `writing.md`. `cli.md`: the new
warnings. `code-quality.md` and `implementation.md`: the spec's Testing becomes the plan's test map.

- [x] **Step 4: Check the links**

- Run: `nix develop -c cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs`, and
  `rg -n 'Proposed change|## Details|Testing\*\*' skills/uraeda/references skills/uraeda/SKILL.md`
- Expected: no problems; no match but the history of this feature, if any

- [x] **Step 5: Commit**

```bash
git add skills/uraeda/references skills/uraeda/SKILL.md README.md
git commit -m "docs(redesign-specs): the skill writes specs in the new shape, and decisions in place"
```

## Task 2: The spec's new format, and its parser

**Risky:** it changes the format of every spec and decision, the shape every reader of `SpecItems`
uses, and which decisions make the approval step pending.

**Files:**

- Modify: `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md`, `plan.md`,
  `data-model.md`, `spec-review.md`;
  `skills/uraeda/assets/templates/specs/decisions/decision-topic.md`;
  `skills/uraeda/assets/templates/specs/README.md`;
  `skills/uraeda/assets/templates/specs/done/YYYY-MM-DD-feature-slug.md`; `specs/README.md`
- Modify: `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md`, `plan.md`; create
  its `data-model.md`; modify
  `skills/uraeda/assets/example/specs/done/2026-10-06-recurring-tasks.md`
- Modify:
  `fixtures/repo/branches/{2026-10-06-recurring-tasks,2026-10-12-cli-tuis,2026-10-13-plan-review}/specs/*/spec.md`,
  `fixtures/preview/feature/specs/2026-10-20-sidebar-resize/spec.md`, the plan of
  `2026-10-13-plan-review`
- Create: `crates/core/src/files/items/spec.rs`; modify `crates/core/src/files/items.rs`,
  `crates/core/src/files/spec.rs`, `crates/core/src/workspace/read.rs`
- Modify: `packages/binding/index.d.ts` (generated), `packages/web/src/views.ts`, `Folds.tsx`,
  `useOpenKeys.ts`, `ReviewPage.tsx`, `ReviewMockups.tsx`, `MockupPage.tsx`, `DocumentPage.tsx`
- Modify: `specs/2026-10-17-redesign-specs/spec.md`, `data-model.md`, `plan.md` (this feature's, in
  the new format, step 7)
- Test: `crates/core/tests/items.rs`, `crates/core/tests/check.rs`, `crates/core/tests/steps.rs`,
  `packages/web/src/__tests__/review.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces, in `files/items/spec.rs`, re-exported from `files/items.rs`, all `#[napi(object)]` and
  serde like today's:
  - `SpecItems { stories, criteria, risk_tier, plan_review, tiers, mockups, block: Option<u32>, minutes: Option<u32>, approve: Option<u32>, answers: Vec<ReviewAnswer>, decisions: Vec<ListedDecision>, parts: Vec<SpecPart>, edges: Vec<EdgeCase>, units: Vec<u32>, tradeoffs: Vec<u32>, principles: Vec<Principle> }`.
    `details` is gone.
  - `Story { id, title, priority, heading_block, blocks, why: Option<u32>, mockup: Option<u32>, key: Vec<Scenario>, more: Vec<Scenario> }`.
    `scenarios` and `details` are gone.
  - `Criterion { id: String, measure: Option<String>, block: u32 }`.
  - `ReviewAnswer { number: u32, summary: String, verdict: String, block: u32 }`: `verdict` is
    `done` or `declined`, `block` the item.
  - `ListedDecision { kind: String, name: String, title: String, block: u32 }`: `kind` is `new`,
    `changed`, or `removed`; `name` the file's stem.
  - `SpecPart { title: String, anchor: String, heading: u32, blocks: Vec<u32> }`: each level-2
    section, in order.
  - `EdgeCase { importance: String, row: u32 }`: the first cell's text, lowercased.
  - `Principle { label: String, ok: bool }`: each header cell of the constitution check, `ok` when
    its cell below holds ✅.
  - `SpecItems.mockups`: the story and HTML links found in the stories, each `MockupLink` as today.
- Produces: `decisions_pending` is true only when a `ListedDecision` of kind `new` or `changed`
  names a decision whose file is `proposed`.

- [x] **Step 1: Move the spec's item types to `files/items/spec.rs`**

Move `Scenario`, `Story`, `Criterion`, `SpecItems`, `MockupLink`, and `TierChoice` out of `items.rs`
into `files/items/spec.rs`, re-exported with `pub use`, as `round.rs` is. Nothing else changes.

- Run: `nix develop -c cargo nextest run -p uraeda-core`, before and after
- Expected: PASS both times

```bash
git add crates/core/src/files/items.rs crates/core/src/files/items/spec.rs
git commit -m "refactor(redesign-specs): the spec's item types in a file of their own"
```

- [x] **Step 2: Write the new templates and the example**

The templates follow the [data model](data-model.md) and step 2 of task 1:

- The spec template: the order of the global constraints. `## Your review` and `## History` are
  `[Optional` sections. An edge case table with an "Importance" column, a criterion with its
  measure, "Key scenarios:" and "More scenarios:", a `## Decisions` with a New, a Changed, and a
  Removed item, then "Relied on:" and its two-column table, and a one-row constitution check.
- The plan template: no `## Decisions`, a one-row constitution check, `## Test map` after
  `## Review comments`.
- The data model template: an `## <Entity>` section with a field, type, meaning, and change table; a
  `mermaid` diagram marked optional, "only for relationships between three or more entities, or
  state transitions".
- The decision template: the intent before `## Rules`; rules strongest first; no
  `## Proposed change`.
- The record template: changes after approval in words, without ruling IDs. The spec review
  template: the decision comment's heading as a second example.
- Both `README.md`s: the spec's parts, `data-model.md` the spec's, and decisions changed in place.

The example spec becomes a revision 2, approved: the block is the approval record, opening with "You
approve"; `## Your review` answers two comments; `## Decisions` lists its new and changed decisions
as items, then "Relied on:"; each story has its journey, its mockup link, two or three key
scenarios, and the others under "More scenarios:"; `## History` holds the changes-requested record.
Its reviewed part stays under 2,000 words: count it with step 5's definition. Its `data-model.md`
holds the task's fields from today's `### Data`. The example plan drops `## Decisions`, gets a
one-row constitution check and a `## Test map`, and its links to `spec.md#error-handling` and
`spec.md#data` point to its own sections and to `data-model.md`. The example record's "(ruling R3)"
becomes the change in words.

- [x] **Step 3: Write the failing tests**

```rust
// crates/core/tests/check.rs
#[test]
fn decisions_after_the_stories_are_out_of_order() {
    let example = Example::new();
    // Put the section back after the stories, as the old format did.
    example.move_section(SPEC, "## Decisions", "## Architecture");
    assert!(summary(&example.problems()).iter().any(|p| p.contains("\"## Decisions\" must come before")));
}

#[test]
fn a_spec_with_details_or_mockups_has_an_unknown_section() { /* "## Details" and "## Mockups" each: sections.unknown */ }

#[test]
fn a_proposed_change_section_is_unknown_in_a_decision() { /* "## Proposed change (2026-10-06-recurring-tasks)" appended to task-storage.md: sections.unknown */ }
```

`Example::move_section` is a new helper of the test file, moving a level-2 section before another
heading.

```rust
// crates/core/tests/items.rs, over the example spec
#[test]
fn a_story_has_its_key_and_more_scenarios() {
    let spec = example_spec();
    let us2 = &spec.stories[1];
    assert_eq!((us2.key.len(), us2.more.len()), (2, 2)); // the example's US2: 2 key, 2 more
    assert!(us2.mockup.is_some());
}

#[test]
fn a_revision_has_its_answers_parts_and_history() {
    let spec = example_spec();
    assert_eq!(spec.answers[1].number, 2);
    assert_eq!(spec.answers[1].verdict, "done");
    assert_eq!(spec.parts.first().unwrap().title, "Your review");
    assert_eq!(spec.parts.last().unwrap().title, "History");
}

#[test]
fn the_decisions_items_are_listed_and_the_table_is_not() { /* kinds, names, titles; a "Relied on" link absent */ }

#[test]
fn edge_cases_criteria_architecture_and_principles() { /* importance "high", measure Some("two clicks"), units and tradeoffs ids, 6 principles all ok; a ⚠️ cell gives ok false */ }

#[test]
fn the_block_gives_its_minutes_and_what_you_approve() { /* minutes Some(N) from "about N minutes", approve = the item starting "You approve" */ }
```

```rust
// crates/core/tests/steps.rs
#[test]
fn approval_when_a_listed_decision_is_proposed() { /* item "- **New: [Due dates](../decisions/due-dates.md)**." + proposed file: Approval */ }

#[test]
fn a_relied_on_link_to_a_proposed_decision_is_not_pending() { /* the table links it, no item: Plan */ }

#[test]
fn an_item_outside_the_decisions_folder_is_not_pending() { /* item links ../2026-10-06-x/spec.md: Plan */ }
```

Replace `a_spec_has_its_folds`, `a_spec_has_its_mockups`, and
`the_mockups_section_takes_story_links_and_links_from_the_root`, which read the removed sections, by
the tests above and `the_mockups_are_found_in_the_stories`. Replace
`a_spec_in_the_old_layout_reports_its_moved_sections` by the order test above. Write a ruling for
the replaced tests.

The break each test catches:

- Out of order: the template's `## Decisions` left after the stories.
- Details and mockups: an optional slot kept for old specs, against the compatibility decision.
- Proposed change: the template's `Prefix("Proposed change (")` slot kept.
- Key and more: every list after "scenarios:" put in `key`.
- Answers: the number read from the list position, or `declined` read as `done`.
- Listed: the "Relied on" table's links counted as items (review focus 4).
- Edge cases and the rest: the header row taken as an edge case, or ⚠️ read as ok.
- The block: "You approve" taken from the first paragraph instead of the first item.
- Approval: a link in the table, or outside `specs/decisions/`, making the step pending (review
  focus 3 and 4); a decision listed twice counted twice (review focus 8).

- [x] **Step 4: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test items --test check --test steps`
- Expected: FAIL, first `no field key on type &Story` at compile time

- [x] **Step 5: Implement the parser**

In `files/spec.rs`, and new files under `files/spec/` if it passes 500 lines:

- `parts`: each top-level level-2 heading after the block, its anchor, and its top-level blocks, as
  `round.rs` cuts a section. Quoted headings start nothing.
- The block: the first top-level callout before the first `##`. `minutes`: the number before
  "minutes" in its first paragraph. `approve`: its first list item whose text starts "You approve".
- `answers`: each item of `## Your review` that opens with a bold `C<n>`, then a parenthesis, a
  colon, and `done` or `declined`.
- `decisions`: each item of `## Decisions` opening with bold "New:", "Changed:", or "Removed:". For
  new and changed, the name is the stem of its link, kept only when it resolves under
  `specs/decisions/`; for removed, the stem of the inline code in parentheses. A name listed twice
  keeps its first item.
- Stories: as today, then `mockup`, the first paragraph holding only a story or HTML link; `key`,
  the list after the paragraph "Key scenarios:"; `more`, the list after "More scenarios:".
- `edges`: each row but the header of the table in `## Edge cases`. `criteria`: as today, with
  `measure` the parenthesis after the bold id. `units`: the bold-led items of `## Architecture`
  before the paragraph "Tradeoffs:"; `tradeoffs`: the items after it. `principles`: the header cells
  and the row of the table in `## Constitution check`.
- `mockups`: the story and HTML links found in the stories' blocks, with the block that holds them.

`workspace/read.rs`'s `decisions_pending` reads `spec::items(&document).decisions` instead of the
section's links, and drops the `## Proposed change` case.

- [x] **Step 6: Bring the web along**

Regenerate the binding: `nix develop -c vp run binding:build`. In `views.ts`, select the new fields
of `SpecItems` and `Story`, and drop `details` and `scenarios`. `specFolds` folds each story's
`more` behind "More scenarios (n)", and nothing else. `ReviewMockups` reads `mockups` as before, now
from the stories. `MockupPage` comments on the line of the story's mockup link. Fix
`packages/web/src/__tests__/review.test.tsx`'s tests of the "Details" fold and the mockups section,
with a ruling: the "Details" fold is gone with its section.

- Run: `nix develop -c cargo nextest run -p uraeda-core`, then `nix develop -c vp run ts:test`
- Expected: PASS

- [ ] **Step 7: Rewrite the fixtures and this feature's files in the new format**

The fixture specs and plan listed in **Files**, from the new templates, keeping their stories. The
compatibility decision makes this feature's own spec fail `specs:check` once the template changes:
rewrite `specs/2026-10-17-redesign-specs/spec.md` from the template, word for word where its text
stays. Move `## Decisions` before the stories. The approval record's six answers, C1 to C6, become
`## Your review` items. The changes-requested record moves to `## History`. The `### Data` bullets
go to `data-model.md`, under `## Sent to the spec page`. Components, error handling, and testing are
this plan's test map and tasks: leave them out, with a line in `## Assumptions` linking the plan.
The mockups' notes join `## Assumptions`. Then rewrite this `plan.md` in the new plan format: its
`## Decisions` list goes, its constitution check becomes one row, and `### Test map` becomes
`## Test map`. Commit these two on their own:
`chore(redesign-specs): rewrite spec.md and plan.md in the new format`.

- [ ] **Step 8: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS, `specs:check` included

- [x] **Step 9: Commit**

```bash
git add skills/uraeda/assets specs/README.md fixtures crates/core packages/binding/index.d.ts packages/web/src
git commit -m "feat(redesign-specs): specs open with their decisions, and stories hold key scenarios"
```

## Task 3: A decision's change, computed by the core

**Files:**

- Create: `crates/core/src/decisions.rs` and `crates/core/src/decisions/change.rs`,
  `crates/core/src/decisions/strength.rs`
- Modify: `crates/core/src/lib.rs` (`mod decisions`), `crates/core/src/git.rs` (`merge_base`)
- Test: `crates/core/tests/decision_change.rs`, `crates/core/tests/git.rs`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `pub enum Strength { Must, MustNot, Should, ShouldNot, May }` and
    `pub fn strength(text: &str) -> Option<Strength>`: the first of `MUST NOT`, `MUST`,
    `SHOULD NOT`, `SHOULD`, `MAY`, as whole upper-case words, in `text`.
    `Strength::rank(self) -> u8`: 0 for MUST and MUST NOT, 1 for SHOULD and SHOULD NOT, 2 for MAY.
    Its `as_str`: `must`, `must-not`, `should`, `should-not`, `may`.
  - `pub fn compare(name: &str, before: Option<&str>, after: Option<&str>) -> DecisionChange`.
  - napi objects:
    `DecisionChange { name: String, title: String, kind: String, listed: bool, compared: bool, sections: Vec<SectionChange> }`,
    `SectionChange { title: String, parts: Vec<PartChange> }`,
    `PartChange { kind: String, strength: Option<String>, before: Option<LineRange>, after: Option<LineRange>, runs: Vec<Run> }`,
    `LineRange { start: u32, end: u32 }`, `Run { kind: String, text: String }`. `kind` of a change:
    `new`, `changed`, or `removed`; of a part: `kept`, `changed`, `added`, or `removed`; of a run:
    `kept`, `added`, or `removed`. `listed` is false and `compared` true from `compare`: task 7 sets
    them. The intent's section has the title `""`.
  - `Git::merge_base(&self, a: ObjectId, b: ObjectId) -> Result<Option<ObjectId>>`, in `git.rs`.

- [ ] **Step 1: Write the failing tests**

A table of cases, each a before text, an after text, and the parts expected, written as
`(section, kind, runs)` with the runs as `"=kept +added -removed"`:

```rust
// crates/core/tests/decision_change.rs
const CASES: &[Case] = &[
    case("a reworded rule",
        "- Saving MUST keep the previous version. Checked by the store's tests.",
        "- Saving MUST keep every earlier version. Checked by the store's tests.",
        &[("Rules", "changed", "=Saving MUST keep -the previous +every earlier =version. Checked by the store's tests.")]),
    case("a rewrapped paragraph",
        "Tasks are kept\nin the browser.", "Tasks are kept in\nthe browser.",
        &[("", "kept", "=Tasks are kept in the browser.")]),
    case("a rule rewritten from scratch",
        "- Tasks MUST sync every minute.", "- Exports MUST be plain JSON files.",
        &[("Rules", "added", "+Exports MUST be plain JSON files."), ("Rules", "removed", "-Tasks MUST sync every minute.")]),
    case("60% of the shorter kept", /* 3 of 5 words kept: changed */),
    case("under 60% kept", /* 2 of 5 words kept: added and removed */),
    case("the same text in another section", /* removed from Rules, added in Why */),
    case("a frontmatter change only", /* status: proposed → active: every part kept */),
];
```

Plus: `compare("x", None, Some(text))` is `new` with every part `added`, and its title the `# `
heading; `compare("x", Some(text), None)` is `removed`, its parts `removed`, with `before` lines. A
`PartChange` of a rule has its strength: `"must-not"` for "MUST NOT be", and `None` for the intent.
The lines of a part count from the file's first line, frontmatter included.

```rust
// crates/core/tests/git.rs
#[test]
fn the_merge_base_of_a_branch_and_main() { /* commit on main, branch, commit on both: the first commit */ }
```

The break each test catches:

- Reworded: a whole-part diff instead of words, or punctuation glued to the kept words.
- Rewrapped: lines compared instead of joined parts.
- From scratch, and the 60% pair: a threshold on the longer part, or `>` instead of `>=`.
- Another section: matching across sections.
- Frontmatter: the frontmatter cut into parts.
- Merge base: the tip of `main` returned instead of the common commit.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test decision_change --test git`
- Expected: FAIL, `unresolved import uraeda_core::decisions`

- [ ] **Step 3: Implement**

Parse each version with the core's markdown parser, the frontmatter left out. A part is a top-level
paragraph or list item, its text with every run of whitespace made one space; a section is the
blocks after the `# ` title and before the first `##` (the intent), then each `##`. Within a
section, match parts of equal text in order (a longest common subsequence, as
[`files/lines.rs`](/crates/core/src/files/lines.rs)' `diff` does); in each gap between matches, pair
a removed and an added part when the longest common subsequence of their words holds at least 60% of
the shorter part's words, best pair first; the rest stay added and removed. A paired part is
`changed`, with its runs from the word subsequence, joined back with single spaces. Parts keep the
order of the branch's version, removed parts at the place they held. `merge_base` wraps gix's
`merge_base`, `None` when the two share no commit.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core`,
  `nix develop -c cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/decisions.rs crates/core/src/decisions crates/core/src/lib.rs crates/core/src/git.rs crates/core/tests/decision_change.rs crates/core/tests/git.rs
git commit -m "feat(redesign-specs): the core compares two versions of a decision, word by word"
```

## Task 4: Your reading place stays while you comment

**Files:**

- Modify: `packages/web/src/useCommentDraft.ts`, `packages/web/src/StoryFrames.tsx`; create a hook
  under `packages/web/src/` if the place keeping is its own unit
- Test: `packages/web/src/__browser__/reading-place.test.tsx`

Do not touch `ReviewPage.tsx` or `Folds.tsx`: task 2 changes them in the same wave.

**Interfaces:**

- Consumes: nothing.
- Produces: `useCommentDraft` keeps the tapped block's place on screen when the form opens, moves,
  or closes, at both widths. Its signature does not change. A story frame keeps its last height
  until its story reports a new one.

- [ ] **Step 1: Check scroll anchoring in WebKit**

The spec marks it unverified in Safari. Write the browser test first, on a plain page: a 560 px
block above the screen grows to 700 px, and the text on screen moves by at most 4 px with the
browser's scroll anchoring alone. Run it: `nix develop -c vp run browser:desktop`. If it passes, the
fix relies on it and keeps the test. If it fails, the page keeps your place itself, as the spec
allows: measure the tapped or top block before the change and scroll by the difference after it.
Write the outcome as a ruling.

- [ ] **Step 2: Write the failing tests**

```tsx
// packages/web/src/__browser__/reading-place.test.tsx
test("saving a comment keeps the heading you read in place", async () => {
  // A waiting spec of the fixture, scrolled so that US2's heading is at the top.
  const before = await topOf(heading("US2"));
  await click(blockOf("US2", 1));
  await type(commentField(), "Log it where I can see it");
  await click(button("Add comment"));
  expect(Math.abs((await topOf(heading("US2"))) - before)).toBeLessThanOrEqual(4);
}); // atSize("both")

test("a story frame above you that grows does not move the text", async () => {
  // A frame above the screen reports 560 px, then 700 px.
  expect(Math.abs(moved)).toBeLessThanOrEqual(4);
});
```

The break each test catches:

- Saving: the form's height removed from above the block without scrolling back.
- Growing frame: the frame's height set to `auto` before the story measures, or anchoring turned off
  by `overflow-anchor: none` on the page.

- [ ] **Step 3: Run them to check they fail**

- Run: `nix develop -c vp run browser:desktop`, `nix develop -c vp run browser:phone`
- Expected: FAIL, `expected 96 to be less than or equal to 4`, or similar, on saving

- [ ] **Step 4: Implement**

Measure the tapped block's top before the form opens, moves, or closes, and restore it after the
layout settles, at both widths: on the phone, after the sheet settles, as `placeAboveSheet` does
today. A story frame keeps the last height it was given until the story reports another.

- [ ] **Step 5: Run the project's validation**

- Run: `nix develop -c vp check`, `nix develop -c vp run ts:test`,
  `nix develop -c vp run browser:phone`, `nix develop -c vp run browser:desktop`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web/src
git commit -m "fix(redesign-specs): commenting keeps your reading place"
```

## Task 5: The edit box holds the text without its frontmatter

**Files:**

- Modify: `packages/web/src/pane/useDraftEditor.ts`, `packages/web/src/EditorPage.tsx` or
  `packages/web/src/pane/DraftEditor.tsx` where the box is filled
- Test: `packages/web/src/__tests__/editor.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: the text box holds the lines after `document.frontmatterLines`; a save joins the file's
  current frontmatter back before the text, so `fate.mutations.text.save` still receives the whole
  file.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/editor.test.tsx
test("the text box starts at the proposal's title, and saving keeps its frontmatter", async () => {
  // A proposal whose frontmatter holds `discovery: high`.
  expect(textBox().value.startsWith("# ")).toBe(true);
  await type(textBox(), " More.");
  await click(button("Save"));
  expect(read(repo, proposalPath)).toMatch(/^---\ndiscovery: high/);
});

test("an unsaved draft kept from before shows without its frontmatter", async () => {
  // The browser's unsaved store holds the whole file, frontmatter included.
  expect(textBox().value.startsWith("# ")).toBe(true);
});

test("the discovery control still sets the frontmatter", async () => {
  /* pick "low": the file reads discovery: low, the box unchanged */
});
```

The break each test catches:

- Title: the frontmatter left in the box.
- Saving: the text saved without its frontmatter, dropping `discovery: high`.
- Unsaved draft: the stored text shown as it was stored.
- Discovery control: the frontmatter joined from the box's first load, overwriting the control's
  change.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/editor.test.tsx`
- Expected: FAIL, `expected false to be true` on the title

- [ ] **Step 3: Implement**

Split the text at the frontmatter's end line when the field is filled, and when an unsaved text is
restored. Join the frontmatter the file has at save time, so the discovery control's change is kept.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp check`, `nix develop -c vp run ts:test`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pane packages/web/src/EditorPage.tsx packages/web/src/__tests__/editor.test.tsx
git commit -m "fix(redesign-specs): the edit box hides the frontmatter its controls set"
```

## Task 6: `ura check` warns when a spec or a decision drifts

**Files:**

- Create: `crates/core/src/check/spec.rs`, `crates/core/src/check/decision.rs`
- Modify: `crates/core/src/check/mod.rs` (`check_file`), `crates/core/src/check/writing.rs` (share
  the block's item count and the measured words)
- Test: `crates/core/tests/check.rs`

**Interfaces:**

- Consumes: `SpecItems` (task 2): `block`, `parts`, `stories[].more`, `edges`. `strength` and
  `Strength::rank` (task 3).
- Produces: `pub fn reviewed_words(text: &str) -> usize` in `check`, the words of a spec's reviewed
  part. The warnings and the problem of the global constraints.
  `pub const SPEC_WORDS: usize = 2_500`, `pub const DECISION_RULES: usize = 10`.

- [ ] **Step 1: Write the failing tests**

```rust
// crates/core/tests/check.rs
#[test]
fn a_long_waiting_spec_is_reported() {
    let example = Example::new();
    example.waiting(SPEC); // status: awaiting-human, a block with its first line
    example.append_words(SPEC, "## Architecture", 3_100 - reviewed_words(&example.read(SPEC)));
    assert_eq!(warnings(&example), ["warning: 2026-10-06-recurring-tasks/spec.md: the spec's reviewed part is 3,100 words: aim at 2,000"]);
}

#[test]
fn more_scenarios_and_history_are_not_reviewed() { /* adding 600 words in "More scenarios:" or ## History leaves reviewed_words unchanged */ }

#[test]
fn a_spec_block_of_8_items() { /* "the block has 8 items: keep at most 7" */ }

#[test]
fn an_edge_case_of_unknown_importance() { /* "Urgent": error edges.importance "importance is high, normal, or niche" */ }

#[test]
fn a_decision_of_12_rules() { /* "12 rules: keep at most 10, or split the topic", exit success */ }

#[test]
fn a_must_after_a_should() { /* "a MUST rule after a SHOULD one: put the strongest first", on the MUST's line */ }

#[test]
fn the_example_and_its_data_model_have_no_problem_nor_warning() { /* US1 3 */ }

#[test]
fn the_example_spec_is_at_most_2000_words() { /* SC-001: reviewed_words(example spec) <= 2_000 */ }

#[test]
fn every_decision_of_the_repository_holds_at_most_10_rules() { /* SC-002: no decision.rules over specs/decisions/, and the 17 rewritten hold at most 9,400 words together */ }
```

The `each_rule` table gains a row per new code.

The break each test catches:

- Long spec: the whole file counted, or an answered spec measured.
- More and history: the reviewed part taken as the whole file.
- Block: the round's block count reused, reading the spec's first line as counts.
- Importance: a case-sensitive match refusing "High".
- 12 rules: nested items counted as rules.
- Order: comparing keywords alphabetically, or MUST NOT ranked after SHOULD.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test check`
- Expected: FAIL, `cannot find function reviewed_words`

- [ ] **Step 3: Implement**

`check/spec.rs`: on a spec, `edges.importance` on each edge row whose importance is not `high`,
`normal`, or `niche`, at any status. On a waiting spec only: `spec.length` past `SPEC_WORDS`, its
number written with a thousands comma, and `block.items` past 7, sharing the round's count. The
reviewed words are those of every measured block after the title, by `writing.rs`'s `measured_text`,
tables included, code and the block excluded, `## History` and the stories' `more` lists left out.
`check/decision.rs`: on a decision and the preview decision, at any status, `decision.rules` past
`DECISION_RULES`, on the `## Rules` heading's line, and `decision.order` on the first rule weaker
than the one before it, its message naming both rules' keywords. `check_file` calls both by kind.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core`, `nix develop -c vp run ready`
- Expected: PASS. `ura check specs` prints `decision.order` warnings for `compatibility.md` and
  `diagrams.md`, whose approved text this feature keeps: note them for the pull request.

- [ ] **Step 5: Commit**

```bash
git add crates/core
git commit -m "feat(redesign-specs): ura check warns on long specs and on decisions out of shape"
```

## Task 7: The spec's file view carries the branch's decision changes

**Files:**

- Create: `crates/core/src/decisions/branch.rs`; `crates/core/src/api/decision.rs`
- Modify: `crates/core/src/api.rs` (`file_view`), `crates/core/src/view.rs` (`FileView`),
  `crates/binding/src/lib.rs` (`readDecision`), `packages/binding/index.d.ts` (generated),
  `packages/server/src/fate/views.ts` (`fileDataView`), `packages/server/src/fate/sources.ts` and
  `views.ts` (a branch decision's source), `packages/web/src/views.ts` (the `FileView` selection)
- Test: `crates/core/tests/decision_change.rs`, `packages/server/src/__tests__/spec.bench.ts`

**Interfaces:**

- Consumes: `compare`, `DecisionChange`, `Git::merge_base` (task 3); `SpecItems.decisions` (task 2).
- Produces:
  - `FileView.decision_changes: Vec<DecisionChange>`: for `spec.md` only, every decision that
    differs between the merge base of the feature's branch and the default branch, and the branch's
    side, sorted listed first in the order of the items, then by name. `listed` is set from
    `SpecItems.decisions`. A listed decision equal on both sides is included, every part `kept`.
  - `pub fn read_decision(repo: &Path, folder: &str, name: &str) -> Result<BranchDecision>`, and the
    binding's `readDecision(repo, folder, name)`:
    `BranchDecision { name: String, folder: String, change: DecisionChange, document: Document }`,
    the decision as the item's branch has it, for a link from that item's files.
  - The branch's side is the feature's checkout on disk when it has one, else the branch's tip; the
    merge base's side is read with `Git::read_file`. When the merge base or its file cannot be read,
    the change has `compared: false` and the branch's text as `added` parts.

- [ ] **Step 1: Record the benchmark's baseline**

Write `packages/server/src/__tests__/spec.bench.ts`: open a spec through `binding.readFile` on a
fixture branch that changes 5 decisions, built with `commitOnBranch`. Run it before any change:
`nix develop -c vp run bench`. Write the mean in the task's commit body.

- [ ] **Step 2: Write the failing tests**

```rust
// crates/core/tests/decision_change.rs, over TestRepo branches
#[test]
fn a_branch_shows_its_new_changed_and_removed_decisions() { /* main: a, b, c; branch: a changed, b deleted, d new: kinds changed, removed, new */ }

#[test]
fn a_change_on_main_after_the_branch_started_is_not_the_branchs() { /* main edits a after the branch: a's card shows only the branch's edit */ }

#[test]
fn merging_main_in_moves_the_comparison() { /* after merging main, the edit main made is no change */ }

#[test]
fn a_listed_decision_equal_to_main_shows_no_change() { /* listed, every part kept */ }

#[test]
fn an_unlisted_change_is_not_listed() { /* due-dates changed without an item: listed false */ }

#[test]
fn a_renamed_decision_is_removed_and_new() { /* review focus 2 */ }

#[test]
fn without_a_merge_base_the_branchs_text_shows_uncompared() { /* an orphan branch: compared false */ }

#[test]
fn a_decision_reads_as_the_branch_has_it() { /* read_decision on the feature's folder: the branch's text and its change */ }
```

The break each test catches:

- Kinds: listing only the files present on the branch.
- Main's later change: comparing with the default branch's tip.
- Merging main: a merge base computed once and cached.
- Equal and listed: dropping decisions without a change.
- Rename: a rename detection pairing different decisions.
- No merge base: an error instead of an uncompared card.

- [ ] **Step 3: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test decision_change`
- Expected: FAIL, `no field decision_changes on type FileView`

- [ ] **Step 4: Implement**

`decisions/branch.rs` lists `specs/decisions/*.md` on both sides, with `Git::list_files` at the
merge base and on disk or at the tip on the branch, compares each pair, and keeps those that differ,
plus the listed ones. `file_view` fills `decision_changes` for `spec.md`. `api/decision.rs` serves
`read_decision`. The server lists `decisionChanges` in `fileDataView`, and serves a branch decision
as a fate source by `<folder>/<name>`; the web selects `decisionChanges` whole.

- [ ] **Step 5: Run the project's validation, and the benchmark**

- Run: `nix develop -c vp run ready`, then `nix develop -c vp run bench`
- Expected: PASS, and the spec opens at most 200 ms slower than the baseline: write both means in
  the commit body

- [ ] **Step 6: Commit**

```bash
git add crates packages/binding/index.d.ts packages/server packages/web/src/views.ts
git commit -m "feat(redesign-specs): a spec's view carries its branch's decision changes"
```

## Task 8: A review comment can point into a decision

**Risky:** it changes the format of the review file, which `ura`, the editor, and the web all read.

**Files:**

- Modify: `crates/core/src/files/review.rs` (`Anchor`, its `Display` and parser),
  `crates/core/src/actions/review.rs` (`comment`), `crates/core/src/api/reviews.rs` (`add_comment`),
  `crates/binding/src/lib.rs` (`addComment`), `packages/binding/index.d.ts` (generated),
  `packages/server/src/fate/file-mutations.ts` (`review.comment`)
- Test: `crates/core/tests/actions.rs`, `crates/core/src/files/review.rs`' tests or
  `crates/core/tests/files.rs`

**Interfaces:**

- Consumes: `Git::merge_base` (task 3).
- Produces:
  - `Anchor::Decision { name: String, start: usize, end: usize, heading: String, removed: bool }`,
    shown `Decision task-storage, lines 19–20, under "Rules"`,
    `Decision task-storage, line 19, under "Rules"`, and
    `Decision task-storage, lines 19–20 removed, under "Rules"`, and parsed back.
  - `pub struct DecisionTarget { pub name: String, pub removed: bool }`, and
    `add_comment(repo, folder, file, lines, text, decision: Option<DecisionTarget>)`: the lines are
    the decision's, read on the branch's tip, or at the merge base when `removed`. The quote and the
    heading come from that text.
  - The `review.comment` mutation takes `decision?: { name: string; removed: boolean }`.

- [ ] **Step 1: Write the failing tests**

```rust
// crates/core/tests/actions.rs
#[test]
fn a_comment_on_a_decision_part() {
    // A feature whose branch changes task-storage.md, its third rule on lines 19–20.
    let commented = comment(&git, &place, &feature, "spec.md", Some((19, 20)), "Log it where I can see it",
        Some(DecisionTarget { name: "task-storage".into(), removed: false }));
    assert!(review_text().contains("## C1: Decision task-storage, lines 19–20, under \"Rules\""));
    assert!(review_text().contains("> > - An upgrade that cannot read"));
}

#[test]
fn a_comment_on_a_removed_part_points_to_mains_lines() { /* "lines 14–15 removed", quote from main's text */ }

#[test]
fn a_decision_comment_keeps_a_fresh_review_only() { /* review focus 6 */ }
```

Plus a round trip of the three headings through `review::parse` and `review::render`.

The break each test catches:

- Decision part: the spec's lines and heading used for the quote.
- Removed: the branch's text read for a removed part.
- Freshness: a decision comment starting a new review while one is pending at the same commit.
- Round trip: "removed" dropped, or the en dash written as a hyphen.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test actions --test files`
- Expected: FAIL, `cannot find struct DecisionTarget`

- [ ] **Step 3: Implement**

As the **Produces** says. `comment` keeps its freshness rule on the spec file.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run binding:build`, `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates packages/binding/index.d.ts packages/server/src/fate/file-mutations.ts
git commit -m "feat(redesign-specs): a review comment can point into a decision"
```

## Task 9: `ura check` warns when a decision changes after its spec's approval

**Files:**

- Create: `crates/core/src/check/unapproved.rs`
- Modify: `crates/core/src/check/mod.rs` (a `mod` line, and a call in `check`),
  `crates/core/src/git/log.rs` (`approval_commit`)
- Test: `crates/core/tests/unapproved.rs`

**Interfaces:**

- Consumes: `Git::merge_base` (task 3).
- Produces:
  `Git::approval_commit(&self, tip: ObjectId, base: ObjectId, spec: &str) -> Result<Option<ObjectId>>`,
  the oldest commit on the first-parent history from `base` to `tip` whose `spec` reads
  `status: approved`. `check::check` reports `decision.unapproved` for each feature folder in its
  target whose spec is approved, on each decision whose text, without the frontmatter's `status` and
  `approved-by` lines, differs between the approval commit and the checkout.

- [ ] **Step 1: Write the failing tests**

```rust
// crates/core/tests/unapproved.rs
#[test]
fn a_decision_edited_after_the_approval_is_reported() {
    // The branch approves its spec, then a later commit edits git.md.
    assert_eq!(summary(&check(repo.path(), "specs")), ["warning: specs/decisions/git.md: git.md changed after the spec's approval"]);
}

#[test]
fn activating_a_decision_is_not_a_change() { /* review focus 1: status and approved-by set after approval: nothing */ }

#[test]
fn edits_before_the_approval_are_approved() { /* edited, then approved: nothing */ }

#[test]
fn a_spec_waiting_for_review_has_no_approval_commit() { /* nothing */ }

#[test]
fn a_decision_added_or_deleted_after_the_approval_is_reported() { /* both */ }
```

The break each test catches:

- Edited after: comparing with the merge base instead of the approval commit.
- Activating: the whole file compared.
- Before: the newest approved commit taken, not the first.
- Added or deleted: only files present on both sides compared.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test unapproved`
- Expected: FAIL, `assertion failed`, an empty summary

- [ ] **Step 3: Implement**

`approval_commit` runs `git log --first-parent --format=%H --reverse <base>..<tip> -- <spec>`
through `Git::output`, and reads the spec at each commit until one reads `status: approved`.
`check/unapproved.rs` opens the repository at the root, skips quietly when there is no git, and
compares as the **Produces** says. The CLI prints the warnings as any other.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS. On this branch, `ura check specs` warns
  `stack.md changed after the spec's approval`: the merge of `main` folded access-storybook's rule
  in after the approval. Note it for the pull request.

- [ ] **Step 5: Commit**

```bash
git add crates/core
git commit -m "feat(redesign-specs): ura check warns when a decision changes after its spec's approval"
```

## Task 10: The spec page, its parts, and its contents

**Files:**

- Start from: `packages/web/src/SpecPage.stories.tsx#Waiting`, its `mockups/SpecMockup.tsx` and
  `mockups/SpecStory.tsx`'s `Panel`
- Create: `packages/web/src/spec/SpecPage.tsx`, `spec/Panel.tsx`, `spec/SpecOpening.tsx`,
  `spec/ReviewAnswers.tsx`, `spec/SpecContents.tsx`, `spec/SpecHistory.tsx`, and the placeholders
  `spec/StoryCard.tsx`, `spec/BuiltParts.tsx`, `spec/DataPart.tsx`, `spec/DecisionCards.tsx`, each
  drawing its part's blocks with `Blocks` inside a `Panel`
- Create: `packages/web/src/review/` with the hooks split out of `ReviewPage.tsx`;
  `fixtures/spec-page/` (the spec, its review file, its data model, and the decisions before and
  after, from `.storybook/specMockup.ts`)
- Modify: `packages/web/src/ReviewPage.tsx`, `FilePage.tsx`, `packages/binding/test-utils.ts`
  (`addSpecFeature`); delete `packages/web/src/ReviewMockups.tsx`
- Test: `packages/web/src/__tests__/spec-page.test.tsx`,
  `packages/web/src/__browser__/spec.test.tsx`

**Interfaces:**

- Consumes: `SpecItems` (task 2); the reading place of task 4, through `useCommentDraft`.
- Produces:
  - `addSpecFeature(repo: string, options?: { status?: "awaiting-human" | "approved"; revision?: number }): string`,
    which commits the fixture's decisions on `main`, then the branch `2026-10-17-spec-page` with its
    spec, review, data model, and decision changes: task storage changed (its second rule "every
    earlier version" for "the previous version", and a rule merged away), repeating tasks new, task
    history removed, and due dates changed without an item. It returns the folder.
  - `Panel({ id, title, badges?, crumbs, children, variant? })`: a card on a wide screen; on the
    phone, no card, its title sticky under the top bar with `crumbs` joined by " › ".
  - The placeholder files export `StoryCard({ story, … })`, `BuiltParts({ items, … })`,
    `DataPart({ folder })`, and `DecisionCards({ items, changes, … })`, which tasks 11, 12, and 13
    rewrite. Their props are the context each needs: the document, the selection, and the width.
  - `FilePage` opens `SpecPage` for every `spec.md`, waiting or not; a plan keeps `ReviewPage` and
    `DocumentPage`.

- [ ] **Step 1: Split the review hooks out of `ReviewPage.tsx`**

Move `useReviewDraft`, `useStoryComments`, `CommentSheet`, and `useReviewSelection` into
`packages/web/src/review/`, unchanged, imported back by `ReviewPage`.

- Run: `nix develop -c vp run ts:test`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/ReviewPage.tsx packages/web/src/review
git commit -m "refactor(redesign-specs): the review page's comment hooks in files of their own"
```

- [ ] **Step 2: Write the failing tests, and `addSpecFeature`**

```tsx
// packages/web/src/__tests__/spec-page.test.tsx
test("the contents list every part, decision, and story, with Approve at their foot", async () => {
  const folder = addSpecFeature(repo);
  await renderPage(`/${folder}/spec.md`, repo); // atWidth(1440)
  expect(entriesOf(region("Contents"))).toEqual([
    "What you approve",
    "Your review, answered",
    "Decisions",
    "Repeating tasks",
    "Task storage",
    "Task history",
    "Due dates",
    "What changes for users",
    "US1 Make a task repeat" /* … each story */,
    "Data",
    "Architecture",
    "Edge cases",
    "Success criteria",
    "Assumptions",
  ]);
  expect(within(region("Contents")).getByRole("button", { name: "Approve" })).toBeTruthy();
});

test("a part's pending comments are counted in the contents", async () => {
  /* 2 comments on US1: its entry shows "2" */
});

test("hidden contents stay hidden after a reload, with the verdict at the page's end", async () => {
  /* "]" then reload */
});

test("your review comes back answered", async () => {
  // `## Your review` holds "- **C2** (undo too short): done. The undo stays 5 seconds."
  const card = region("Your review, answered");
  expect(card).toHaveTextContent(secondCommentQuote);
  expect(within(card).getByText("done")).toBeTruthy();
  expect(card).toHaveTextContent("The undo stays 5 seconds.");
});

test("a revision 3 keeps one record above the first part, the others in History", async () => {
  /* History folded, 2 records */
});

test("a revision 1 has no answers card", async () => {});

test("an answer whose comment is gone shows without a quote", async () => {
  /* review focus 7 */
});

test("an approved spec is the same page, read-only, with its approval record", async () => {
  /* no Approve, "Approved on" in What you approve */
});

test("what you approve shows the time, the risk tier, and the principles", async () => {
  /* pills "About 20 minutes" and "High"; a ⚠️ principle has a warning icon, the others a check (US8 4) */
});
```

```tsx
// packages/web/src/__browser__/spec.test.tsx
test("on the phone, the part and story stay at the top while you read", async () => {
  // atSize("phone"): scroll into US2's scenarios
  expect(await stuckTitles()).toEqual(["What changes for users", "US2 Complete a repeating task"]);
});

test("on the phone, no part has a card, and text runs to 12 px from the edges", async () => {});
```

The break each test catches:

- Contents: a part missing because it is drawn outside the parts list, or the verdict not moved.
- Counts: comments counted by heading text instead of by part.
- Hidden: the state kept in React only.
- Answers: the quote matched by position instead of by comment number.
- Revision 3: the records kept above the first part.
- Approved: `FilePage` sending an approved spec to `DocumentPage`.
- Pills and principles: the principle's ⚠️ read as ok.
- Phone: the sticky title under the top bar's height, or the card's padding kept.

- [ ] **Step 3: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/spec-page.test.tsx`
- Expected: FAIL, `Unable to find role="region" and name "Contents"`

- [ ] **Step 4: Implement**

From the mockup, with the core's items instead of its walks of the tree: `SpecOpening` draws the
block's record or request, the time and the risk tier as pills, the "You approve" item as the large
lead, the block's other items, and the principles as a strip of pills, a check or a warning icon
each (review comment C2: the chevron sits on the lead's first line, next to its text).
`ReviewAnswers` draws each answer beside its comment's quote and text, a "done" or "declined" badge,
and the answer. `SpecPage` lays out the groups of the spec's order: "What you approve", "Your
review, answered", "Decisions", "What changes for users", "Data", "How it is built, and its limits",
and "History", folded, with a band between groups on the phone. `SpecContents` is the `SideColumn`
"Contents", its shown state in `localStorage` as `SessionAside` keeps its own, with the verdict at
its foot. Delete `ReviewMockups.tsx`: each story embeds its own mockup. The comment form, selection,
and story comments are the hooks of step 1.

- [ ] **Step 5: Run the project's validation**

- Run: `nix develop -c vp check`, `nix develop -c vp run ts:test`,
  `nix develop -c vp run browser:phone`, `nix develop -c vp run browser:desktop`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web fixtures/spec-page packages/binding/test-utils.ts
git commit -m "feat(redesign-specs): the spec page opens with what you approve, and lists its parts"
```

## Task 11: Stories read as cards

**Files:**

- Start from: `packages/web/src/mockups/SpecStory.tsx` (`Story`, `Scenarios`)
- Modify: `packages/web/src/spec/StoryCard.tsx`
- Test: `packages/web/src/__tests__/spec-stories.test.tsx`

**Interfaces:**

- Consumes: `Story.key`, `more`, `mockup`, `why` (task 2); `Panel`, `addSpecFeature`, and
  `StoryCard`'s props (task 10).
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/spec-stories.test.tsx
test("a story shows its key scenarios, and the others behind a button", async () => {
  // A story with 2 key scenarios and 3 more, at 1440 px.
  expect(scenariosOf(card("US2"))).toHaveLength(2);
  await click(button("3 more scenarios"));
  expect(scenariosOf(card("US2"))).toHaveLength(5);
  expect(button("Fold the other scenarios")).toBeTruthy();
});

test("stories embed their mockups live, and link an HTML one", async () => {
  // Three story links and one HTML mockup: no "Open the mockup" button, three frames, one link.
});

test("a story without more scenarios has no fold button", async () => {});
```

The break each test catches:

- Key and more: every scenario shown, or the count read from the key list.
- Mockups: the old mockup buttons kept, or an HTML mockup framed.
- No more: a "0 more scenarios" button.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/spec-stories.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "3 more scenarios"`

- [ ] **Step 3: Implement**

Each story is a `Panel`: its id and priority as a badge, its title, its journey, its mockup live
through the existing story embed, then its key scenarios as **Given**, **When**, and **Then** rows,
and the others behind "N more scenarios", which reads "Fold the other scenarios" once open. The open
state is the history entry's, as `useOpenKeys` keeps folds.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp check`, `nix develop -c vp run ts:test`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/spec/StoryCard.tsx packages/web/src/__tests__/spec-stories.test.tsx
git commit -m "feat(redesign-specs): stories read as cards, with their key scenarios"
```

## Task 12: The parts after the stories read at a glance

**Files:**

- Start from: `packages/web/src/mockups/SpecParts.tsx`
- Modify: `packages/web/src/spec/BuiltParts.tsx`, `packages/web/src/spec/DataPart.tsx`
- Test: `packages/web/src/__tests__/spec-parts.test.tsx`

**Interfaces:**

- Consumes: `SpecItems.edges`, `criteria`, `units`, `tradeoffs`, `parts` (task 2); `Panel`,
  `addSpecFeature`, and the placeholders' props (task 10).
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/spec-parts.test.tsx
test("edge cases show high, then normal, then the niche ones folded", async () => {
  // 2 high, 1 normal, 2 niche
  expect(rowsOf(region("Edge cases")).map(importance)).toEqual(["High", "High", "Normal"]);
  expect(button("2 niche cases")).toBeTruthy();
});

test("a criterion shows its id and measure as pills, then its sentence", async () => {
  // "- **SC-001** (two clicks): Setting a preset repeat takes two clicks."
});

test("the architecture's units are small cards side by side, its tradeoffs with a Cost pill", async () => {});

test("the data model's changes are coloured pills", async () => {
  /* New, Changed, Removed */
});

test("a spec without a data model has no Data part", async () => {
  /* review focus 5 */
});
```

The break each test catches:

- Edge cases: the file's order kept, or niche cases shown.
- Criterion: the measure left in the sentence.
- Architecture: tradeoffs drawn as units.
- Data: the change cell drawn as plain text.
- No data model: an empty "Data" part, and its entry in "Contents".

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/spec-parts.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "2 niche cases"`

- [ ] **Step 3: Implement**

Under "How it is built, and its limits": the architecture's units as small cards in a row on a wide
screen, then each tradeoff with a "Cost" pill; the edge cases by importance, high, then normal, then
the niche ones behind "N niche cases"; each criterion's id and measure as pills before its sentence;
the assumptions as their blocks. "Data" draws `data-model.md` when it exists, its "Change" column as
green "New", yellow "Changed", and red "Removed" pills, and nothing otherwise.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp check`, `nix develop -c vp run ts:test`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/spec/BuiltParts.tsx packages/web/src/spec/DataPart.tsx packages/web/src/__tests__/spec-parts.test.tsx
git commit -m "feat(redesign-specs): the parts after the stories, each drawn for what it holds"
```

## Task 13: Decisions come first, each change marked in place

**Files:**

- Start from: `packages/web/src/mockups/DecisionChange.stories.tsx#Change`, its `DecisionChange.tsx`
  and `RuleLine.tsx`
- Modify: `packages/web/src/spec/DecisionCards.tsx`; create `spec/DecisionCard.tsx`,
  `spec/RuleLine.tsx`, and the decision page of a branch,
  `packages/web/src/decisions/BranchDecision.tsx`
- Modify: `packages/web/src/theme/icons.ts` (the strength icons), `packages/web/src/links.tsx`,
  `packages/web/src/routes.tsx`, `packages/web/src/review/` (a comment's decision target),
  `crates/core/src/files/document/inline.rs` (`SpanLink.anchor`), `packages/binding/index.d.ts`
  (generated)
- Test: `packages/web/src/__tests__/spec-decisions.test.tsx`,
  `packages/web/src/__tests__/links.test.ts`, `packages/web/src/__tests__/decision-icons.test.ts`,
  `packages/web/src/__browser__/spec.test.tsx`

**Interfaces:**

- Consumes: `FileView.decisionChanges`, `readDecision` and its fate source (task 7); the
  `review.comment` mutation's `decision` (task 8); `SpecItems.decisions` (task 2); `Panel`,
  `addSpecFeature`, `DecisionCards`' props, and the review hooks (task 10).
- Produces: `SpanLink.anchor: Option<String>`, the link's `#` part.
  `pathLink(path, repo, anchor?, from?: { folder: string })`: a decision link from an item's file
  opens that item's branch decision page, at its anchor.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/spec-decisions.test.tsx
test("a reworded rule marks its words in place, unstruck", async () => {
  const rule = partOf(card("Task storage"), 2);
  expect(added(rule)).toEqual(["every earlier"]);
  expect(removed(rule)).toEqual(["the previous"]);
  expect(struck(rule)).toEqual([]);
  expect(within(card("Task storage")).getByText("Changed")).toBeTruthy();
});

test("a rule merged away shows whole on a red tint behind 1 removed", async () => {});

test("a comment on a decision's rule is saved with its decision and lines", async () => {
  await click(partOf(card("Task storage"), 3));
  await type(commentField(), "Log it where I can see it");
  await click(button("Add comment"));
  expect(read(repo, reviewPath)).toContain(
    '## C1: Decision task-storage, lines 19–20, under "Rules"',
  );
});

test("each rule shows its strength's icon, named for screen readers", async () => {
  /* "Must", "Should", "Must not" */
});

test("a rewrapped paragraph counts as unchanged", async () => {});

test("an unlisted change shows, marked Not listed in the spec", async () => {
  /* due dates */
});

test("a deleted decision is a Removed card without a link", async () => {});

test("a listed decision equal to main says so", async () => {
  /* "No change against the default branch" */
});

test("a decision that could not be compared says so", async () => {
  /* "Could not compare with the default branch." */
});

test("the strength icon takes its strength's colour, and the card has no side bar", async () => {
  /* C1: by the icon's accessible name and a computed colour token, not a class */
});
```

```ts
// packages/web/src/__tests__/links.test.ts
test("a spec's decision link opens the branch's decision at its anchor", () => {
  expect(pathLink("specs/decisions/task-storage.md", repo, "rules", { folder })).toEqual({
    href: `/${repo}/${folder}/decisions/task-storage#rules`,
    inApp: true,
  });
});

test("a change's round links its decision with the change marked", async () => {});
```

```tsx
// packages/web/src/__browser__/spec.test.tsx
test("a decision card's lines hold at most 75 characters at 1440 px", async () => {}); // checkMeasure
```

The break each test catches:

- Reworded: runs drawn with `<del>` or a line-through.
- Merged away: removed parts left unfolded, or struck.
- Comment: the spec's lines sent instead of the decision's.
- Icons: a strength read again in the web, drifting from the core's.
- Unlisted, deleted, equal, uncompared: a card dropped, or a link to a file that no longer exists.
- C1: the mockup's side bar kept.
- Links: the anchor dropped, or the default branch's decision opened.
- Measure: the page's 90-character measure inside the card.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/web/src/__tests__/spec-decisions.test.tsx packages/web/src/__tests__/links.test.ts`
- Expected: FAIL, `Unable to find role="region" and name "Task storage"`

- [ ] **Step 3: Implement**

`DecisionCards` draws, after "What you approve" and the answers, one `DecisionCard` per change:
listed ones in the order of the items, then the unlisted ones. A card is a `Panel` with the title,
then its kind's pill, "Not listed in the spec" when unlisted, the intent in large text, then each
section's parts: kept parts behind "N unchanged", removed parts behind "N removed" at the end of
their section, changed parts with added words green and underlined and removed words red with a
dotted underline, never struck. Each rule draws its strength's icon from `theme/icons.ts`, Lucide's
chevrons: two up "Must", one up "Should", one down "Should not", two down "Must not", a dot "May";
coloured as review comment C1 says. Its "Checked by" sentence sits on a muted line. Lines hold at
most 75 characters. A tap on a part opens the comment form, saving with the part's lines and the
decision's name, `removed` for a removed part. The branch decision page draws one `DecisionCard`,
read from `readDecision`, scrolled to the anchor. In the core, `SpanLink` keeps its anchor.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run binding:build`, `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/files/document packages/binding/index.d.ts packages/web/src
git commit -m "feat(redesign-specs): decisions come first, each change marked in place"
```

## Task 14: The whole page, checked, in its real stories

**Files:**

- Modify: `packages/web/src/SpecPage.stories.tsx` (renders `FilePage` over the fixture, as
  `RoundPage.stories.tsx` does), `packages/web/src/mockups/DecisionChange.stories.tsx` moved to
  `packages/web/src/spec/DecisionCard.stories.tsx`, `packages/web/.storybook/fixture.ts`
- Delete: `packages/web/src/mockups/`, `packages/web/.storybook/specMockup.ts`
- Create: `packages/web/scripts/spec-shots.ts`, from `round-shots.ts`
- Test: `packages/web/src/__browser__/spec.test.tsx`
- Create: `specs/2026-10-17-redesign-specs/screenshots/`

**Interfaces:**

- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/__browser__/spec.test.tsx
test("the spec page is accessible in both themes, every fold open", async () => {
  // atSize("both"): addSpecFeature, a decision change, a review answered, the niche cases,
  // and every fold open, in light then dark.
  await checkAccessibility();
});
```

The break it catches: a pill or a run's colour under the contrast floor, or a fold button without a
name.

- [ ] **Step 2: Run it**

- Run: `nix develop -c vp run browser:desktop`, `nix develop -c vp run browser:phone`
- Expected: FAIL on the first rule axe reports, or PASS: either way, fix what it reports.

- [ ] **Step 3: Replace the mockups by the real page**

The stories render the real page and card over `addSpecFeature`. Delete the `TEMPORARY` mockups and
`specMockup.ts`. Screenshot the spec page and the branch decision page at both sizes and in both
themes, review them against the mockups' screenshots and the review comments, fix what differs, and
commit them under this feature's `screenshots/`.

- [ ] **Step 4: Run the project's validation, and the benchmark**

- Run: `nix develop -c vp run ready`, `nix develop -c vp run storybook:build`,
  `nix develop -c vp run bench`
- Expected: PASS, and the spec still opens at most 200 ms slower than task 7's baseline

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-17-redesign-specs/screenshots
git commit -m "feat(redesign-specs): the spec page in its stories, checked at both sizes"
```
