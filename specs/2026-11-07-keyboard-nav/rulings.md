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
  stop on screen, without moving past it: the first whose top is inside the view, so a stop that
  only peeks under the top bar is passed by, else the first that reaches into the view or lies under
  it. It scrolls as a move does, a pane that fits showing whole.
- **Rationale**: the spec names `j` only; one start for both keys is the simplest rule to learn, and
  the human's answer to Q1 asks for "the topmost visible element".
- **Where**: task 4, `cursor/move.ts`

## R5: A tall stop scrolls by a screen less the margins

- **Decision**: `j` on a stop whose end is below the screen's bottom edge less 100 px scrolls down
  and keeps the cursor: by all that is left when it is no more than the screen's height, between the
  top bar and the status line, else by that height less 200 px. `k` mirrors it at the top. Moved
  onto, a tall stop shows its top 100 px under the top bar after `j`, and its end 100 px above the
  status line after `k`, so the next key in the same direction reads through its body.
- **Rationale**: the spec's 1,400 px card on a 900 px screen shows its end at the first `j`, and the
  next moves on (US4 more 1). Its top 100 px under the top bar, what is left past the bottom margin
  is about the screen's height: a step of a room, 200 px less, left a third `j` for the last 200 px.
  A step of up to a screen passes nothing by, as what was at the screen's bottom edge comes to its
  top. A taller stop is read a room at a time, each step keeping 200 px of the last in view, then
  its rest in one step.
- **Alternatives considered**: the rest in one step only when it is less than the room and one
  margin, which keeps 100 px of the last in view: on a 900 px screen, with the top bar and the
  status line, the spec's card still took three `j`.
- **Where**: task 4, `cursor/move.ts`

## R6: The cursor hears the last key through the registry's watch

- **Decision**: `cursor/held.ts` learns that the last input was a key from `watchKeys` in
  [`keys/registry.tsx`](/packages/web/src/keys/registry.tsx): the registry's one window listener
  hands every key to its watchers before it runs a binding. A watcher binds no shortcut and stops no
  key; the cursor's acts only on Escape out of a text field, which no binding hears. A pointer's
  press, and a mouse's move that moves the pointer, are heard on the document, as
  [`pointerMoved.ts`](/packages/web/src/pointerMoved.ts) hears its moves. The structural test scans
  for `watchKeys(` too, with `cursor/held.ts` on its list, so a new watcher is seen.
- **Rationale**: the structural test forbids a key listener outside the registry, and the allowlist
  is for keys a field, a dialog, or an overlay owns, which this is not. A guess from the focus
  alone, a focus with no pointer press before it, would take a field's focus after a save, or a
  page's after it loads, for a key. Escape out of a text field inside a stop reads the same watch:
  the field's own Escape runs first, and lets the focus go.
- **Alternatives considered**: a `keydown` listener of its own in `held.ts`, on the allowlist.
- **Where**: task 4, `cursor/held.ts`, `keys/registry.tsx`

## R7: A stop's bar writes its keys from `bar`, and its word from `label`

- **Decision**: `StopKey.bar` is the keys as the bar writes them, "J K" or "⏎", and `label` the word
  after them, "range" or "comment", which the key map lists too. One key of a pair carries the
  `bar`: `J` with "J K", `K` with none. A pane is found by a mark `data-pane` on
  [`Pane`](/packages/web/src/layout/Pane.tsx)'s `section`, the nearest around a stop, itself
  included; `move.ts` also exports `scrollFor`, the scroll of a move to a given stop, which
  `focusStop` uses.
- **Rationale**: the spec's bars name a pair of keys once, "J K range", "a b pick", as the status
  line's hints do (`hint` "j k", `hintLabel` "move").
- **Where**: task 4, `cursor/StopKeys.tsx`, `cursor/move.ts`, `layout/Pane.tsx`

## R8: The cursor moves in one scroll area at a time

- **Decision**: a key measures and scrolls the stops of one scroll area: the held stop's, else the
  page's own, else, on a page whose stops all sit in scrolling columns, the first stop's. Past the
  last or first stop of its area, the cursor takes the next stop in document order, scrolled in the
  area holding that stop, as a move onto it from nowhere, so a pane that fits shows whole.
- **Rationale**: a stop's place on screen means something only against its own area's view and
  scroll: the decisions check's `Panes` layout and a `SplitPanel`'s detail scroll on their own,
  beside the page, and a column's stops measured against the page would scroll the wrong area. With
  no cursor, the page's own stops are where the reader is, not a column that happens to hold the
  first stop.
- **If wrong**: a column a key moves into could start from its topmost stop on screen instead of the
  next in document order.
- **Where**: task 4, `cursor/useCursor.ts`, `keys/scroll.ts` (`areasOf`)

## R9: The keys read a block's range from its mark

- **Decision**: `J` `K` find the next or previous block among the cursor's `"block"` stops, and read
  its lines from its element's `data-lines` mark: a block of the reviewed file takes its heading
  from the document tree, a decision's part its section's title from the decisions the spec changes,
  so `useKeyRange` takes `changes` beside `tree`. A held block's keys are made by `blockKeys`,
  shared by the blocks and the decisions' parts. Enter clicks the toggle, the existing tap, so the
  form opens under the head with the range merged. The plan's test named lines 92–93: those are the
  first scenario's alone, the two scenarios span 92–95.
- **Rationale**: the next block's range is not known until the cursor holds it, as `Selection.keys`
  is called only while a toggle is held; the mark is the one place every selectable element names
  its lines, and a decision's heading matters, as "Ask the agent" quotes a rule by it.
- **Alternatives considered**: a `data-heading` mark beside `data-lines`, which every selectable
  element would draw for the keys alone.
- **Where**: task 6, `review/useKeyRange.ts`

## R10: A settled point's `s` quotes it in the composer

- **Decision**: `s` on a settled point the cursor holds writes "About the settled point of
  `<file>`:" and the point quoted into the feature's session composer, and opens the Session tab, as
  a question's Ask does; it sends nothing. `useRoundActions` gains `about(subject)` beside
  `point(subject, text)`.
- **Rationale**: the point's existing ask, the comment form's "Ask AI", sends a typed comment at
  once; `s` has no text yet, and a message with the quote alone would ask the agent nothing.
- **Alternatives considered**: `s` opening the comment form, as Enter does, for its "Ask AI": two
  keys doing one thing, and the ask still a Tab away.
- **Where**: task 7, `RoundColumn.tsx` (`useRoundActions`), `SettledPoints.tsx` (`pointKeys`)

## R11: The cursor holds a focus a key brought, on a page that has it

- **Decision**: R2 narrowed. A stop is held when the focus arrived on it while the last input was a
  key, the last input is still a key, and a mounted page has the cursor (`useCursor` turns it on in
  `held.ts`). A stop a click focused stays free under the keys that follow, until a key moves the
  focus. On a page without the cursor, nothing is held: Tab onto a fold's or a block's toggle draws
  Astryx's ring alone, a mouse move leaves the focus where it is, and Escape out of a field inside a
  stop gives the focus back to nothing.
- **Rationale**: the focus and the last input alone held a pending comment a click had focused,
  `tabIndex` -1, once any key followed, so a click, a key, then `d` deleted it. The stops are marked
  by shared components, drawn on pages that mount no cursor, where the held look, the blur on a
  mouse move, and the refocus on Escape acted for a cursor that was not there.
- **Where**: review of task 5, `cursor/held.ts`, `cursor/useCursor.ts`

## R12: Inside a question card, an embed's buttons are reached by Tab

- **Decision**: a stop nested in another, as a story's "Comment", a live window's "Full screen", or
  a fold inside a question card, is passed by when `j` leaves the stop holding it, and `k` from
  below lands on the outermost stop holding it, the card, not its inner buttons. Tab reaches them,
  and from one held by Tab, `j` and `k` move among its siblings, then out. `Box.parent` names the
  stop holding a stop, by its index in the list `cursorStep` is given.
- **Rationale**: after `j` reads a tall card to its end, the next `j` took the embed's button near
  the card's top and scrolled back up, undoing the read-through (US4 more 1). The card's own keys
  name what a human does there; its embed's buttons are a click's, and Tab's.
- **If wrong**: `nextOf` in `move.ts` walks into the nested stops, and a read-through skips those
  above the screen instead.
- **Where**: final review, `cursor/move.ts` (`nextOf`), `cursor/useCursor.ts` (`boxesOf`, `beyond`)

## R13: A pane fits inside the margins, and a held stop's bar counts

- **Decision**: a pane the cursor enters shows whole only when it fits the screen less the two 100
  px margins, and then shows inside them, its top 100 px under the top bar or its end 100 px above
  the status line. In the frame after the cursor takes a new stop, once its bar mounted, the stop is
  measured again with its bar, the cursor's `RowBar` being marked `data-stop-bar`, and the page
  scrolls the little more the same rule asks.
- **Rationale**: SC-003 asks for the stop 100 px inside after any move. A pane shown whole flush to
  the status line, then its bar mounting under the held stop, ended 75 to 90 px from it, the pane's
  end cut off. The bar mounts after the focus moves, as the held state is read from the focus, so it
  cannot be measured before the move.
- **Alternatives considered**: reserving the bar's height in the stop before it is held, which would
  draw an empty line under every block.
- **Where**: final review, `cursor/move.ts` (`shownWhole`), `cursor/useCursor.ts` (`take`,
  `withBar`), `lists/RowBar.tsx` (`isCursor`)

## R14: The cursor is on only where blocks are stops

- **Decision**: `useCursor(on)` binds the cursor's keys only while `on`: a spec or a plan under
  review, a document with Ask. An approved spec or plan, and a document without Ask, mount it off:
  `j` and `k` scroll the text, as on any page.
- **Rationale**: their blocks are no stops, so the folds' toggles were the only ones, and `j` jumped
  between them over the text it used to scroll.
- **Where**: final review, `cursor/useCursor.ts`, `spec/SpecPage.tsx`, `PlanPage.tsx`,
  `DocumentPage.tsx`

## R15: One helper makes a pane a stop, ringed over it on a narrow screen

- **Decision**: a question card, the round's notes, and its Submit are made stops by `usePaneStop`
  in [`cursor/PaneStop.tsx`](/packages/web/src/cursor/PaneStop.tsx): the pane's mark, the stop's,
  its own focus ring off, its held look, and a `HeldKeys` mounted only while held, as the blocks and
  the comments mount theirs. On a narrow screen the held look is `pickedStyles.paneNarrow`, an
  `::after` overlay inside the pane, over its content, the sticky header included, which lets every
  press through; on a wide one, the ring outside it as before.
- **Rationale**: the three panes copied the same marks and look, and declared their keys from a hook
  always mounted, which on `k` from Submit to the notes declared the notes' Enter before Submit let
  its own go, and threw "Enter is bound twice". On the phone a card reaches the screen's edges: its
  ring outside fell off them, and the sticky header and the option rows painted over it.
- **Where**: final review, `cursor/PaneStop.tsx`, `layout/picked.ts`, `QuestionCard.tsx`,
  `RoundNotes.tsx`, `RoundSubmit.tsx`
