# Rulings: Keyboard nav in questions and specs

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Back stays a plain binding

- **Decision**: `b` Back keeps its place in the shell, not turned into a fallback as the spec's
  assumption "Back becomes a fallback" says. The selection's layer runs before the page's and the
  shell's, so a held question's `b` already runs first, and a question with no option B declares no
  `b`, which leaves it to Back.
- **Rationale**: the outcome the assumption asked for holds without it. A fallback `b` would let any
  page bind `b` with no clash, weakening the registry's guard for a key every page shares
  ([`LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx)).
- **If wrong**: one line, `fallback: true` on Back's binding.
- **Where**: task 1

## R2: The cursor is the focus, and shows only after a key

- **Decision**: a stop is held when it has the focus and the last input was a key. A click that
  focuses a block's toggle holds nothing: no look, no bar, no keys.
- **Rationale**: the spec's "the pointer hides the cursor" and SC-004. Chrome focuses a button on a
  click, so the focus alone would show the cursor under the mouse. `:focus-visible` says the same in
  browsers, but not in happy-dom, where the tests run.
- **Where**: task 4, `cursor/held.ts`

## R3: Undo of a removed comment adds it again, at the end

- **Decision**: the Undo of a removed review comment adds a comment with the same text and lines
  through the existing `review.comment` mutation; a settled point's, through `settled.comment`. The
  comment comes back last, numbered after the others.
- **Rationale**: the spec asks for the comment "back, with its text"; the core's add appends, and a
  restore at the old number would need a new core action and binding for an order nobody reads apart
  from the numbers ([`review.rs`](/crates/core/src/actions/review.rs), `comment`).
- **If wrong**: a `review.restore` action in the core that inserts at a number.
- **Where**: task 3

## R4: `k` with no cursor starts from the topmost stop too

- **Decision**: with no cursor, or a cursor scrolled off screen, both `j` and `k` take the topmost
  stop on screen, without moving past it.
- **Rationale**: the spec names `j` only; one start for both keys is the simplest rule to learn, and
  the human's answer to Q1 asks for "the topmost visible element".
- **Where**: task 4, `cursor/move.ts`

## R5: A tall stop scrolls by a screen less the margins

- **Decision**: `j` on a stop whose end is below the screen's bottom edge less 100 px scrolls down
  by the smaller of what is left and the screen's height less 200 px, and keeps the cursor; `k`
  mirrors it at the top.
- **Rationale**: the spec's 1,400 px card on a 900 px screen shows its end at the first `j`; a
  taller one is read a screen at a time, each step keeping 200 px of the last in view.
- **Where**: task 4, `cursor/move.ts`
