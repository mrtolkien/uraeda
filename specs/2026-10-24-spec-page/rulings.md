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
