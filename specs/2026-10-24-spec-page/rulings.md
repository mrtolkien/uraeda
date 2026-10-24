# Rulings: Spec and plan pages in the terminal look

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The core reads a plan's lead paragraphs

- **Decision**: `PlanItems.lead` gives the plan's "**Goal:**", "**Architecture:**", and "**Spec:**"
  paragraphs by their label, so the plan page draws them as panes.
- **Rationale**: US6's first scenario asks for Goal and Architecture as panes, and they are bold-led
  paragraphs, not headings; the [stack](../decisions/stack.md) decision forbids the web reading
  "Goal:" from spans. The spec's assumption that "the core reads no new part of a plan" is about the
  waves and the progress of option A, which stay unread.
- **Alternatives considered**: the lead in one pane titled by the plan, against the scenario; the
  template's lead as `##` headings, a format change for every plan.
- **If wrong**: a few lines in `files/plan.rs` and a field to remove; the lead draws as one pane.
- **Where**: Task 1, Task 7.

## R2: The tests of the old look follow the panes

- **Decision**: tests that found a spec's part by its Astryx card, its "Contents" side column, or
  its pills find it by its pane's region and title instead, guarding the same behaviour.
- **Rationale**: the spec replaces the look they named; the behaviour (comments, folds, counts,
  order) is kept and still tested.
- **Alternatives considered**: keeping the old tests beside new ones, which would fail on the new
  look.
- **If wrong**: a behaviour lost in a rewrite; each rewritten test names what it guards.
- **Where**: Tasks 4, 9, 10, 11.

## R3: The story frame's bezel tests follow the live window

- **Decision**: `story-embed.test.tsx`'s phone bezel and bar tests check the live window's title and
  size instead.
- **Rationale**: the human picked the live window over device bezels (Q2: A).
- **Alternatives considered**: none: the bezel goes.
- **If wrong**: the bezel comes back from git history.
- **Where**: Task 5.

## R4: The plan's badge test moves to the plan page's tests

- **Decision**: `review.test.tsx`'s "a plan shows each task's steps checked out of its total" moves
  to `plan-page.test.tsx`, reading the task's pane rather than its heading.
- **Rationale**: `ReviewPage.tsx` and `ReviewHeadings.tsx` are replaced by `PlanPage.tsx`.
- **Alternatives considered**: none.
- **If wrong**: nothing lost: the same fixture and count are checked.
- **Where**: Task 7.

## R5: The column keeps the questions page's width

- **Decision**: approval comment C3 ("the right tab is a bit too big in 1440px width") does not
  change the column's width rule, 480 px at 1440 px.
- **Rationale**: US4 states 480 px, and the column is one component and one width for the questions
  and spec pages; the comment calls itself low importance and to be reviewed. The pull request names
  it.
- **Alternatives considered**: a narrower rule for both pages, which changes the questions page's
  approved spec.
- **If wrong**: one constant in `layout/documentColumnWidth.ts`.
- **Where**: Task 10.

## R6: The decision card's tests follow the ledger

- **Decision**: the tests that checked the old card's look, a removed part "never struck" behind a
  "N removed" fold, a pill on each changed or added part, a run of kept parts behind "N unchanged",
  the title a link, and a removed part's dashed edge at 3:1, now check the ledger: removed words
  struck in a `del` and only those, a sign named "Added", "Changed", or "Removed", "N rules
  unchanged" and "Why, alternatives, consequences · N changed", and a link "The whole decision, on
  its page" at the pane's foot. In `spec-decisions.test.tsx`, `decisions-check.test.tsx`,
  `feature-done.test.tsx`, and `__browser__/spec.test.tsx`, parts are found by their words rather
  than their place, as the ledger puts the parts not kept first.
- **Rationale**: US2 and SC-001 replace the look those tests named (struck removed words, signs, the
  folds' labels); the behaviour they guard, comments on a decision's lines, folds kept on Back, the
  cards' order, the strength icons, and the selection's contrast, is kept and still tested. The
  pane's title is a string, so the link to the decision's page moves to its foot, as the mockup
  draws it.
- **Alternatives considered**: keeping the old assertions beside the new ones, which contradict the
  spec; a link in the pane's title, which `Pane` does not take.
- **If wrong**: the link returns to the title once `Pane` takes a node for it; each rewritten test
  names what it guards.
- **Where**: Task 4.

## R7: A story keeps its two widths on the phone, scaled to fit

- **Decision**: on the phone, a story still opens at the phone's width, now with the Phone and
  Desktop switch as named icons. Each width shows at its real size, scaled to fit the screen (402 px
  at about 90%, 1440 px at about 25%). A picked element's comment names the width it was picked at,
  on every screen. `story-embed.test.tsx`'s phone test checks that the frame fits and the controls
  are named icons, not that the frame is as wide as the screen with no switch.
  `story-comments.test.tsx`'s phone comment names "phone". `reading-place.test.tsx` reads the
  frame's own height (`offsetHeight`), which its scale leaves alone. A frame counts as above the
  window's top until its bottom is a whole pixel below it.
- **Rationale**: the clarification "a mockup stays at its real width, scaled to fit", and US3 more
  2, "a story at 390 px is scaled to the screen's width", which Task 5's test reads as a desktop
  story on the phone. The phone's width first keeps today's phone reading, and the switch reaches
  the desktop's.
- **Alternatives considered**: the desktop's width first on the phone, at about 25%, unreadable
  until full screen; no switch on the phone, against "a story keeps its Phone/Desktop switch".
- **If wrong**: the default width is one line in `StoryEmbed.tsx`'s `ReadyStory`; the switch on the
  phone, one condition.
- **Where**: Task 5.

## R8: A pane's count is in its title, not in its region's name

- **Decision**: "Edge cases · 5" and "Success criteria · 2" are the panes' headings, through
  `Pane`'s `count`; their regions keep the part's name, "Edge cases" and "Success criteria". Task
  6's test reads the count from the heading, not from the region's name as the plan wrote.
- **Rationale**: `Pane` names its region by its title alone, as "Check these" and "Inbox" are, so a
  landmark keeps its name when the count changes; one shared pane, as coherence asks.
- **Alternatives considered**: the count written into the title string, which names the region by a
  number that changes, and draws the count unlike every other pane's.
- **If wrong**: the region's name changes in `layout/Pane.tsx`, for every pane at once.
- **Where**: Task 6.

## R9: The niche cases fold inside their pane

- **Decision**: the niche edge cases fold under "N niche cases" in the edge cases' pane, a toggle in
  the pane's body as in the mockup's `built()`, not mounted while folded; the pane itself does not
  fold.
- **Rationale**: the plan's "through the pane's fold" would fold the whole pane, hiding the high and
  normal cases the spec shows; the mockup folds the niche rows alone.
- **Alternatives considered**: a nested pane titled "Niche cases" folding through `Pane`'s `fold`, a
  border inside a border for two rows.
- **If wrong**: `EdgeList` in `spec/builtParts/EdgeCases.tsx`.
- **Where**: Task 6.

## R10: The questions page's plan's Task 1 holds 6/6

- **Decision**: the plan page's test expects "Task 1 · The session's view, scrolling in the round's
  column" to hold "6/6", not the "5/5" US6's first scenario and Task 7 name.
- **Rationale**: the fixture is the questions page's plan as committed
  (`fixtures/plan-page/plan.md`), whose Task 1 has six checked steps; the core counts them, and the
  scenario's count was written from the mockup's data. The behaviour the scenario names, the task's
  pane with its `done/total` badge, is the same.
- **Alternatives considered**: a fixture edited to five steps, which would no longer be the
  questions page's plan.
- **If wrong**: one number in `plan-page.test.tsx`.
- **Where**: Task 7.

## R11: "Since your review" only while the spec waits for review

- **Decision**: a spec's `sinceReview` is computed only while its status is `awaiting-human`; an
  approved revision, or one being revised, has none.
- **Rationale**: US5 helps the reviews after the first one ("a first review reads the whole spec;
  this helps the reviews after it"); an approved spec is not under review, and the spec does not say
  what it shows then. See `crates/core/src/api/since.rs`, `while_waiting`.
- **Alternatives considered**: keeping it on an approved spec, as a record of the last revision's
  change, which marks Δ on a page nobody reviews.
- **If wrong**: one condition in `while_waiting`.
- **Where**: the wave 1 review's fixes of Task 2.

## R12: The built parts' reading styles stay on the legacy list, in one file

- **Decision**: splitting `spec/BuiltParts.tsx` moved its reading-size styles to
  `spec/builtParts/shared.tsx`; the UI coherence lint test's legacy list names that file in place of
  `spec/BuiltParts.tsx`, and every reading-size style of the built parts lives there.
- **Rationale**: the styles moved unchanged in Task 6's split; the list keeps its length, one file
  for one, and moving them to `Prose` would restyle the parts' text in the reading font, a change of
  look outside the split.
- **Alternatives considered**: `proseStyles.reading` for the parts' text now, which changes their
  font.
- **If wrong**: the file moves to `Prose` with the rest of the list's files.
- **Where**: Task 6, `src/__tests__/lint.test.ts`.

## R13: The phone's sticking part heads and bands give way to the panes

- **Decision**: on the phone, the spec's parts are panes like on a wide screen: no band between the
  groups, and no part's title and breadcrumbs sticking under the top bar. A story's pane keeps only
  its titled top border on the phone (`isOpenOnPhone`), so its text and its live window take the
  page's width. The browser tests of the sticking heads go; the test of the parts' width checks the
  panes and a story's text at the page's 14.4 px inset; the band test checks that the answers' pane
  follows the block's. The block's record ("Spec to review, revision 2, about 10 minutes.") is the
  pane's title, no longer a paragraph that takes a comment: a pending comment saved on it, or on the
  block's other lines outside its items, draws at the top of the pane's body, where it is edited and
  removed. The groups read "User stories" and "How it is built", as the mockup names them, in
  Contents too. History folds through the pane's fold, its records not mounted while folded. The
  data model's intro, the text before its first entity, draws before the entities' panes in no pane
  of its own, on the spec page and on the data model's own page.
- **Rationale**: US1 and the mockup draw every part as a titled pane, with no sticking head nor
  band; the UI behaviour decision forbids folded content mounted. A story's live window, inside two
  bordered panes, fell under the phone's 90% scale R7 states.
- **Alternatives considered**: keeping a sticking head inside each pane, a second title the mockup
  does not draw; every spec pane open on the phone, a look the decisions' and built panes (Tasks
  4, 6) do not share.
- **If wrong**: the sticking head comes back from git history (`spec/Panel.tsx`); `isOpenOnPhone` on
  more panes is one prop each.
- **Where**: Task 9, `src/__browser__/spec.test.tsx`, `src/__tests__/spec-page.test.tsx`.

## R14: A jump to a pane focuses its title, and lands under the bar once

- **Decision**: `Pane` with an `id` gives its heading `<id>-title`, focusable by script, so `jumpTo`
  focuses it as it did the old card's. "Contents" catches its links' clicks around its list to call
  `jumpTo`: an Astryx list item's link never called the item's `onClick`, so a tap followed the hash
  and focused nothing. `scrollBelowBar` no longer subtracts the top bar for an element with a scroll
  margin, which already counts it: a link to a story put its pane 74 px lower than the margin, past
  the browser test's tolerance. `Pane`'s open-on-phone style removes the inline borders by their
  longhands, which the shorthand `borderWidth` overrode.
- **Rationale**: the review's finding that a jump from Contents left the focus in the column; the
  pane's scroll margin owns the room above it.
- **Alternatives considered**: Contents' entries as buttons, which the tests and screen readers find
  as links; a wider tolerance in the anchor test, which hides the double offset.
- **If wrong**: Task 10 rebuilds Contents; `scrollBelowBar` is one condition in `Folds.tsx`.
- **Where**: Task 9, `layout/Pane.tsx`, `spec/SpecContents.tsx`, `Folds.tsx`. The change to
  `scrollBelowBar` in `Folds.tsx` affects every element with a scroll margin, not the spec's panes
  alone: a document's headings, a round's questions, and every pane land right under the bar, their
  margin's room above them.

## R15: Decision panes open on the phone, their soft colours mixed over their surface

- **Decision**: `DecisionCard` passes `isOpenOnPhone`, on every page that draws it, and drops its
  text's inset on the phone, so its note and its ledger's rows start at the page's 14.4 px inset, as
  a story's text does. This reverses R13's choice to keep decision panes bordered. `Pane` sets
  `--pane-surface`, its body's colour, or the page's surface when open on the phone, and SHOULD's
  and SHOULD NOT's icons mix their hard colour 80% over it, not 75% over the card's colour. The
  ledger rows' tints go from 8% to 6%.
- **Rationale**: the layout mockup (`.narrow fieldset.pane`) draws every pane with only its titled
  top border on the phone. Over the page's darker surface, Latte's Should icon fell to 2.87:1 on a
  changed row, and a removed row's muted check to 4.49:1. At 80% the soft icons keep at least 3:1,
  and at 6% the muted words keep at least 4.5:1, on every tint in both schemes.
- **Alternatives considered**: a background on the decision pane on the phone, the band R13 removed;
  the soft colour as the hard one at 75% opacity, which the tests' colour checks read as the hard
  one.
- **If wrong**: `isOpenOnPhone` is one prop in `spec/DecisionCard.tsx`; the mix and the tints are
  one number each in `spec/RuleLine.tsx` and `spec/ledger/Rows.tsx`.
- **Where**: fix of the review, `spec/DecisionCard.tsx`, `layout/Pane.tsx`, `spec/RuleLine.tsx`,
  `spec/ledger/Rows.tsx`, `src/__browser__/spec.test.tsx`.

## R16: The column is named for its document, and the 320 px Contents tests go

- **Decision**: the spec's and the plan's column is labelled "The spec's column" or "The plan's
  column", as the questions page's is "The round's column", not "Document" as Task 10's interface
  said. The tests of the old 320 px Contents column, which started folded under 1100 px and kept its
  fold under `uraeda.specContents`, are removed; the test of a fold kept after a reload checks the
  document column's fold ("Show the spec's column"), and the other Contents tests find the Contents
  tab's panel (R2). The approval test sets the tier to medium, the fixture's being already high.
- **Rationale**: the column's label names its fold and resize controls: "Hide document" would read
  as hiding the spec itself. Task 10 removes the 320 px column and its storage; the behaviour those
  two tests guarded is gone, and the document column's own fold and width are tested by
  `document-column.test.tsx`. A tier equal to the spec's would commit the same with or without the
  review's choices, a test that cannot fail.
- **Alternatives considered**: "Document", the plan's word; keeping the 1100 px rule beside the
  questions page's width, two widths for one column.
- **If wrong**: one label in `spec/SpecColumn.tsx`; the old tests are in git history.
- **Where**: Task 10, `spec/SpecColumn.tsx`, `src/__tests__/spec-page.test.tsx`.

## R17: A decision's part is quoted in its words, without its markdown

- **Decision**: "Ask the agent" on a decision's part quotes the part's words as the core compared
  them, the runs on its side, which hold no markdown: "> Data MUST be stored in IndexedDB, only
  through src/store/: components never reach the database themselves.", without the backticks around
  `src/store/`. The header names the decision's file and the part's lines, so the agent reads the
  markdown there. Task 11's test expects the words, not the plan's backticked line.
- **Rationale**: the plan's own interface says "the quoted line the part's words on its side"; the
  web holds a decision's words, not its file's text, and the core's parts are plain text by design,
  for the word comparison. Quoting the file's lines would need the core to send each decision's text
  on both sides, for a quote whose header already points to them.
- **Alternatives considered**: a new core field with each part's markdown source; cutting the
  decision's file at both commits in the web, which the stack decision leaves to the core.
- **If wrong**: the core adds the part's source text to `PartChange`, and `reviewQuote.ts` quotes it
  in place of the runs.
- **Where**: Task 11, `packages/web/src/reviewQuote.ts`, `src/__tests__/spec-asking.test.tsx`.

## R18: The review's asking tests at 1440 px follow the Session tab

- **Decision**: `review.test.tsx`'s "US6.1" now expects the Session tab open on the spec's page, not
  the session's page; `session.test.tsx`'s "US1.9" (the session's page opened with the quote, Back
  returning to the review) runs at 402 px, where asking still opens the session's page.
- **Rationale**: spec page US4 key 3 moves asking on wide screens into the column (R2); both tests
  keep guarding what they named, each at the width where it still happens.
- **Alternatives considered**: none.
- **If wrong**: the tests' previous versions are in git history.
- **Where**: Task 11.

## R19: `## History` is not a part of the change since your review

- **Decision**: the core's `sinceReview` leaves `## History` out, on both sides, as it leaves the
  opening callout out (`crates/core/src/api/since.rs`, `spec_version`).
- **Rationale**: a revision moves the reviewed version's opening callout into `## History`, which
  revision 1 does not have: counted, every revision 2 lists "History" among its parts changed, and
  US5 key 1 expects exactly three, US1's journey, US2's journey, and "Your review, answered".
  History is the record of the reviews, not a part the human reviews, and the page folds it.
- **Alternatives considered**: leaving it out in the web, which the stack decision leaves to the
  core; listing it, against US5 key 1.
- **If wrong**: drop the two `retain` lines of `spec_version` and the test `history_added`.
- **Where**: Task 12, `crates/core/tests/since_review.rs`.

## R20: "Since your review" sits between the block and the answers

- **Decision**: the pane "Since your review" sits right under the block's pane, before "Your review,
  answered". `spec-page.test.tsx`'s "the answers follow what you approve" now expects it between
  them: the answers' pane, then the since pane, then the block's, each the previous sibling of the
  next, with no band. The marks' context lives in `src/sinceMarks.tsx`, read by `Selectable`
  (`Selection.tsx`), so every block drawn for a review is marked wherever its part draws it, and a
  changed paragraph's, list item's, or scenario's words are the change's runs.
- **Rationale**: the plan puts the pane "under the block", and US5 "at the top"; the mockup draws it
  right after the block. Every part draws its blocks through `Selectable`, but not one shared node
  of `Blocks`, so the mark is placed there. Only the fixture's fake commit (`4f2a9c1`) makes the
  pane show on the test's spec: "The version you reviewed is not in git anymore."
- **Alternatives considered**: the pane after the answers, which splits what you approve from what
  changed since you approved; marking in each part's own drawing, a dozen places to keep in step.
- **If wrong**: move `SinceReviewPane` in `SpecPage.tsx` and restore the test's one assertion.
- **Where**: Task 12.

## R21: The decisions' heading counts every decision's pane, unlisted changes included

- **Decision**: "Decisions · …" counts each decision pane the group draws: the decisions the spec
  lists, and the decisions the branch changes without listing them, which draw panes too. On the
  fixture, whose branch changes Due dates without the spec listing it as changed, the heading reads
  "Decisions · 1 new, 2 changed, 1 removed", where spec US1 key 2 says "1 new, 1 changed, 1
  removed", the listed ones. `spec-panes.test.tsx`'s US1 key 2 test expects the new count. Contents'
  "Decisions · N" still counts the decisions listed, as Task 10's interface says.
- **Rationale**: the review's finding that the heading counted three panes of four: a reader adding
  up its kinds would miss the unlisted change, the one most likely to surprise them.
- **Alternatives considered**: the listed decisions only, as the scenario reads, which leaves a
  changed pane out of the heading's count; a fixture without the unlisted change, which drops the
  case the unlisted pane exists for.
- **If wrong**: one line in `decisionCounts`, `spec/SpecPage.tsx`, and the test's name.
- **Where**: fix of Task 10's review, `spec/SpecPage.tsx`, `src/__tests__/spec-panes.test.tsx`.

## R22: The spec's and the plan's phone sheets are in the address, the round's not yet

- **Decision**: on narrow screens, the spec's and the plan's open sheet, Contents or Review, is the
  address's `?tab=`, the parameter of the column's open tab on wide screens (`spec/useSheetTab.ts`):
  a reload keeps it, and crossing to a wide screen opens that tab. The tab is in the sheet's own
  history entry only, so Back closes the sheet and lands on the address without it. The questions
  page's `RoundColumn` keeps its sheets in component state, as before.
- **Rationale**: the layout decision says "An open detail, tab, or sheet MUST be in the URL", which
  Task 10's sheets broke. The round's sheets have the same gap, from the questions page's Task 8,
  outside this fix's scope; the same hook applies there when that page is next changed.
- **Alternatives considered**: a separate `?sheet=` parameter, which the width change would have to
  translate to `?tab=` and back.
- **If wrong**: `useSheetTab` goes back to a `useState` in `spec/SpecColumn.tsx`.
- **Where**: fix of Task 10's review, `spec/useSheetTab.ts`, `spec/SpecColumn.tsx`,
  `src/__tests__/spec-column-phone.test.tsx`.
