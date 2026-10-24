# Rulings: Questions page in the terminal look

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The mockup's README stays with the mockup

- **Decision**: the approval kept `mockups/README.md` beside `questions.html`, though no link of the
  spec names it.
- **Rationale**: the spec step rewrote it to describe the spec's own mockup, not the investigation's
  prototypes, which were already gone from the folder; it tells a reader how to look at the mockup
  the spec links.
- **Alternatives considered**: deleting it, as the approval step's rule reads literally; the mockup
  then loses its only description.
- **If wrong**: delete the file; no link points to it.
- **Where**: the approval step.

## R2: The session's page keeps scrolling the window

- **Decision**: the session's view scrolls a box only in the column; the session's page keeps the
  window, as today.
- **Rationale**: the spec asks for a view "used by the session's page and the column" that owns how
  a session follows its end; one view acting on the box its element is in, the window without one,
  meets that without moving the page's Back, reading place, and `#turn-` links, which their tests
  guard.
- **Alternatives considered**: the session's page in a box too, which rewrites its reading place and
  Back for no change the human sees.
- **If wrong**: give the session's page a box; the view already acts on one.
- **Where**: Task 1.

## R3: Round panes open on the phone through a prop

- **Decision**: `Pane` takes `isOpenOnPhone`, which the round's panes set, rather than every pane of
  the app losing its sides on the phone.
- **Rationale**: the approved answer, open sides "so text keeps the screen's width", was about the
  round; home, decisions, and settings panes were reviewed with their sides.
- **Alternatives considered**: every pane open on the phone, a change to pages no spec reviewed.
- **If wrong**: make it the default and drop the prop.
- **Where**: Task 3.

## R4: One comment form per part of the settled points

- **Decision**: the Check these pane and the settled panes at the round's end each keep their own
  comment form, restored under its own point.
- **Rationale**: the two parts sit far apart on the page; one form state across both would need the
  page to hold it, for no behaviour the spec asks.
- **Alternatives considered**: one form for the page, lifted into `RoundPage`.
- **If wrong**: lift the state into the page; the forms' unsaved text is keyed by point already.
- **Where**: Task 6.

## R5: Test rounds from the rounds the spec names

- **Decision**: the tests read two new fixtures, the merge-chats round 01 and the layout-look round
  01's Q4 and Q5, copied from git history into the new format.
- **Rationale**: the spec's scenarios name these rounds and their exact text; the existing fixtures
  have no "Example:" line nor a verdict "with changes".
- **Alternatives considered**: rewriting the scenarios over the existing web-ui fixture, which loses
  their exact values.
- **If wrong**: the fixtures are test data only; replace them.
- **Where**: Task 2.

## R6: The trimmed layout-look round fails only its numbering

- **Decision**: `fixtures/round-layout-look/clarifications-01.md` keeps Q4 and Q5 under their own
  numbers, so `ura check` reports its count and its numbering; a test pins those as its only
  problems, and `every_fixture_round_passes` leaves it out.
- **Rationale**: the spec's scenarios and the later tasks' tests name "Q4" and its example; the
  round is trimmed to the parts they read, as R5 says.
- **Alternatives considered**: renumbering to Q1 and Q2, which loses the names the scenarios use;
  copying the whole round, ten questions no test reads.
- **If wrong**: copy the whole round from `6ed4502b` in the new format and add it to the passing
  fixtures.
- **Where**: Task 2.

## R7: A level-2 item orders the fixed sections after it

- **Decision**: `sections.order` takes a level-2 item, like `## Q1` or `## Task 1`, as a mark: a
  fixed section the template puts before it, found after it, is reported. Items themselves are never
  out of order, and deeper items, like `### Q1.B`, are no mark.
- **Rationale**: `## Check these` after `## Q1` must fail, and the rule stays the template's,
  without a round-only case. Checked over `specs/`, `fixtures/`, and the example: no file gained a
  report.
- **Alternatives considered**: a check for rounds only, naming `## Check these`, which a later
  template change would miss.
- **If wrong**: limit the mark to rounds in `check_order`.
- **Where**: Task 2.

## R8: Task 3's tests in files of their own

- **Decision**: the hanging lists are tested in `__browser__/document-lists.test.tsx` and the
  folding pane in `__tests__/titled-pane.test.tsx`, new files, rather than in `lists.test.tsx` and
  `pane.test.tsx` as the plan named them.
- **Rationale**: those two files already exist and test the priorities' keyboard list and detail
  pane; `lists.test.tsx` runs on the desktop only, so phone tests in it would mean re-wrapping it.
- **Alternatives considered**: adding to the existing files, under `describe` blocks.
- **If wrong**: move the tests into the existing files.
- **Where**: Task 3.

## R9: On the phone, each row draws its own marker

- **Decision**: on narrow screens, a document's list draws every row's marker itself, a dash for a
  plain bullet, its sign for a typed one, its number for an ordered one, in a box 14.4 px wide
  (`--spacing-3`), the list moved left by as much. An ordered list is then a `ul` with its numbers
  as text, not an `ol`.
- **Rationale**: Astryx's marker is 19.2 px wide before a 9.6 px gap, which the list cannot restyle;
  a hang that wide leaves the screen on the spec page, whose inset is 14.4 px. The approved settled
  point asks for a dash.
- **Alternatives considered**: Astryx's markers and a 28.8 px hang, cut at the screen's edge on
  tight pages; Astryx's numbers in an `ol`, the same.
- **If wrong**: hang Astryx's own markers, once Astryx lets a list size them.
- **Where**: Task 3.

## R10: The column keeps no reading place across the narrow breakpoint

- **Decision**: `useKeepPlace` keeps the window's reading place only; content in a box that scrolls
  on its own, as the round's Session column, keeps none.
- **Rationale**: the place is kept only as the window crosses the narrow breakpoint, and the column
  is drawn only above it, so it leaves as the window crosses: a place kept in its box is never put
  back where anyone reads it. Each media query's listener commits on its own, so the column may
  still draw for a moment at narrow: its place, read against the window, would then move the round.
- **Alternatives considered**: keeping the place in the box, as Task 1 first built, which only moves
  a column about to leave.
- **If wrong**: keep the place in the box, once the column draws on narrow screens.
- **Where**: Task 1.

## R11: A hanging marker's room is its list's widest marker

- **Decision**: on narrow screens, each list sizes its markers' room to its widest marker, its gap
  included: 14.4 px for dashes (`--spacing-3`), one em for typed signs and task boxes, and its
  longest number and dot for an ordered list. It hangs by that room, at most by the page's inset
  (`--page-inset`): a list of dashes keeps its text on the paragraphs' edge, and a wider marker's
  list sets its text in by what the inset lacks. An ordered row's typed sign or task box follows its
  number, as on wider screens. Each marker sits on its row's first line, on one line.
- **Rationale**: R9's 14.4 px room cut "8." and "☐" at the screen's edge, about 17 px wide at 19 px
  text, and wrapped "10."; no inset holds them, as the spec page's is 14.4 px. Text set in a few
  pixels keeps every marker whole on the screen.
- **Alternatives considered**: smaller markers, unlike the text's; one room for every list, wide
  enough for "10.", which would set every list of dashes in too.
- **If wrong**: give the page a wider inset on the phone, or let lists of numbers keep Astryx's
  `ol`.
- **Where**: Task 3, fixed in its review.
