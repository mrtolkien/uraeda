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
