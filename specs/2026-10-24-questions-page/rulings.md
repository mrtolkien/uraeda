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
