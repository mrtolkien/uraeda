---
kind: feature
finished: 2026-11-07
pull-request: https://github.com/mrtolkien/uraeda/pull/106
supersedes:
  - 2026-10-26-leader-key
  - 2026-11-07-global-undo
---

# Record: Keyboard nav in questions and specs

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-07, finished on
> 2026-11-07, in [its pull request](https://github.com/mrtolkien/uraeda/pull/106). Its full files
> are in git: `git log -- specs/2026-11-07-keyboard-nav/`.

## What and why

The spec and plan reviews and the rounds of questions, the pages read most, still needed the mouse
or a long run of Tab to reach a block, comment on it, or pick an option. The human asked that no
action there need the mouse: blocks selected with keys as a list's rows, a question's option picked
by its letter, in a layer kept small, accepting that letters change meaning by context.

## Behaviour

- **A cursor on the pages read most (US1)**: on a spec or plan under review, a document with Ask the
  agent, and a round of questions (the inbox triage and the decisions check included), `j` `k` and
  `↓` `↑` move a cursor from stop to stop in reading order. The page opens with none; the first key
  takes the topmost stop on screen, as it does again after Escape cleared it or once the cursor
  scrolled away. An approved spec or plan, and a document without Ask, keep `j` `k` scrolling. The
  page scrolls only when the stop comes within 100 px of the top bar or the status line, the held
  stop's bar counted, or when the cursor enters another pane, shown whole when it fits inside the
  margins. A stop taller than that room scrolls through, a screen at a time, before `j` or `k`
  leaves it. The cursor is the browser's focus on the stop, held only when a key brought the focus
  there and the last input is still a key: a mouse move clears it, a click never shows it, and the
  pages without a cursor see none of it. A held block shows the accent's edge and tint and, on wide
  screens, a bar of its keys under it ("⏎ comment", "J K range", "s ask"), whose buttons are skipped
  by Tab; Enter opens its comment field as a tap does, and once the comment is added or cancelled by
  a key the block takes the cursor back; `s` asks the agent about it. A fold's toggle and an
  embedded story's or window's buttons are stops whose own Enter acts; inside a question card they
  are reached by Tab.
- **A range of blocks by keys (US2)**: `J` `K`, or Shift with `↓` `↑` (on with the single keys off),
  stretch and shrink the comment's range from the block where it started, in the review's yellow,
  within one file: past a file's last block or into a decision's part they do nothing. Enter
  comments on the whole range; `j` `k` or Escape drop the range and give back what was selected
  before the first `J` or `K`, form open or not. `s` asks about the range, or a tapped selection
  holding the block, else the block.
- **Pending comments (US3)**: a pending comment, or a comment on a settled point, is a stop under
  its block: Enter edits it, `d` removes it at once and gives the cursor to its own block (a general
  comment's goes to a neighbour on screen, or clears). Every removal of a comment, by `d` or its
  Remove button, lands on the tab's undo stack of [Global undo](2026-11-07-global-undo.md), once the
  removal is written: "Removed a comment", which `u` takes back, the comment where it was with its
  text, and `U` removes again. A review comment's removal was already Global undo's; a settled
  point's is added here, where Global undo left a round's settled comments out of the stack. A
  refused removal shows its error, and records nothing.
- **Answering by keys (US4)**: a question's whole card is a stop, ringed while held (an overlay on
  the phone, over the sticky header). Its options' letters `a` to `f` pick and unpick, saved at once
  ("a b pick"); `g` never picks, an option G or later is picked by Tab and Space; a read-only round
  takes no letter, and a letter the question lacks goes on to the page (`b` is Back). `i` or Enter
  focuses its comment field, and Escape out of it gives the card back the cursor; `s` asks the
  agent; the bar names "n unanswered" when the page has `n`. `n` and `p` by a key hand the cursor to
  the question they reach, so its letters pick at once.
- **The rest of the round (US5)**: the settled points are block stops (Enter comments, `s` puts the
  point quoted in the session's composer), the folded "Under the hood" opens with Enter, the notes
  are a stop whose Enter opens them as "Edit notes" does, and the commit's row a stop whose Enter
  focuses its first button.
- **The registry's selection layer**: keys declared by what the cursor holds run before the page's
  and the shell's, only while it holds, publish no status-line hint, and drop with the single-key
  switch. They clash only among themselves for one key, but a key that starts a sequence in any
  layer throws, and a selection key may not be a fallback. The key map lists a held selection's key
  once, hiding the page's or shell's binding it shadows.

## Design

The cursor knows no page: it finds the elements marked as stops, in document order, and moves the
focus among them; each page marks its own, and what the cursor holds declares its keys in the
registry's selection layer while it holds.

- [`keys/store.ts`](/packages/web/src/keys/store.ts): the `"selection"` place, ordered before the
  page's and the shell's, with the layered clash checks;
  [`keys/keyMap.ts`](/packages/web/src/keys/keyMap.ts) hides what a selection shadows;
  [`keys/registry.tsx`](/packages/web/src/keys/registry.tsx) `watchKeys` hands every key to the
  cursor's watcher, which binds nothing, before the bindings run, so the cursor knows the last input
  was a key without a listener of its own (allowlisted in `keys-structural.test.ts`).
- [`cursor/`](/packages/web/src/cursor/): `stops.ts` (the `data-stop` mark), `held.ts` (when a stop
  is held: focus brought by a key, on a page that mounts the cursor; the mouse's blur; Escape out of
  a field), `move.ts` (the pure geometry, `cursorStep`, tested without a browser), `useCursor.ts`
  (the page's `j` `k` `↓` `↑` Escape, the scroll areas, the recovery when a held stop is redrawn),
  `StopKeys.tsx` (`HeldKeys`, a stop's keys and bar, mounted only while held), `PaneStop.tsx`
  (`usePaneStop`, the cards, notes, and commit row).
- The stops: [`Selection.tsx`](/packages/web/src/Selection.tsx) (blocks and decision parts, with
  `Selection.keys`), [`BlockTable.tsx`](/packages/web/src/BlockTable.tsx),
  [`ReviewComments.tsx`](/packages/web/src/ReviewComments.tsx),
  [`layout/Foldable.tsx`](/packages/web/src/layout/Foldable.tsx) (found by Astryx's trigger class),
  [`StoryPick.tsx`](/packages/web/src/StoryPick.tsx),
  [`LiveWindow.tsx`](/packages/web/src/LiveWindow.tsx),
  [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx),
  [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx),
  [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx),
  [`RoundSubmit.tsx`](/packages/web/src/RoundSubmit.tsx).
- The range: [`commentRange.ts`](/packages/web/src/commentRange.ts) owns `Range` and how a range
  grows (`merged` for taps, `spanned` for keys, `holds`),
  [`review/useKeyRange.ts`](/packages/web/src/review/useKeyRange.ts) the keys' anchor and head, read
  from the next block's `data-lines` mark (`linesOfMark`, beside `linesMark`), and a held block's
  keys.
- The Undo: a settled point's comment's removal records its change on Global undo's stack as a
  review comment's does: the core's scope `undo::round`
  ([`api/undo.rs`](/crates/core/src/api/undo.rs)), the binding's `removeSettledComment` taking an
  `undo` token ([`file_writes.rs`](/crates/binding/src/file_writes.rs)), `settled.remove` answering
  its change ([`file-mutations.ts`](/packages/server/src/fate/file-mutations.ts)), and
  [`settledWrites.ts`](/packages/web/src/settledWrites.ts) recording it through `useRecord` of
  [`useReviewActions.ts`](/packages/web/src/useReviewActions.ts).
- [`roundJump.ts`](/packages/web/src/roundJump.ts): a key's jump focuses the card, a click's the
  title. The [keyboard guide](/specs/ui/keyboard.md#the-cursor) describes the cursor.

## Replaced behaviour

- **`j` `k` scroll the spec, plan, and round pages a few lines at a time**: on a spec or plan under
  review, a document with Ask, and a round, they move the cursor; `Ctrl+D` `Ctrl+U` still scroll. No
  test guarded these pages' scroll; no test was removed.
- **A settled point's comment removed for good**: its removal is undone with `u`, as Global undo did
  a review comment's. No test guarded it; no test was removed. The branch's own test of a review
  comment's undo by its toast went once it was rebased on Global undo, whose stack replaced the
  toast and whose coverage test checks that undo.
- **The pointer moves a list's selection**: kept on lists; on these pages the pointer hides the
  cursor instead. `hover-selection.test.tsx` keeps holding for lists.

## Gotchas

- **The held state is read from the focus and the last input, not `:focus-visible`**: Chrome focuses
  a button on a click, and happy-dom, where the tests run, has no `:focus-visible`
  ([`cursor/held.ts`](/packages/web/src/cursor/held.ts)).
- **The cursor claims a focus the browser already gave**: a stop a click focused takes no new
  `focusin` when `j` focuses it again, so `take` claims it (`claimFocus`).
- **A held stop's keys mount only while held**: keys declared from a hook always mounted made the
  next stop declare its letters before the previous let them go, and the registry threw "a key means
  two things" ([`cursor/StopKeys.tsx`](/packages/web/src/cursor/StopKeys.tsx)).
- **The bar mounts after the focus moves**, so the scroll is checked again in the next frame with
  the bar measured ([`cursor/useCursor.ts`](/packages/web/src/cursor/useCursor.ts), `withBar`).
- **A tall card's end may sit a fraction of a pixel past the margin**, which no scroll can move:
  such a remainder counts as read, or `j` stayed on the card for good
  ([`cursor/move.ts`](/packages/web/src/cursor/move.ts)).
- **Astryx's `Collapsible` passes props to its root, not its trigger**: the fold's toggle is found
  by Astryx's stable `collapsible-trigger` class
  ([`layout/Foldable.tsx`](/packages/web/src/layout/Foldable.tsx)).
- **The bar's buttons are not clicked**: a mouse moving to them hides the cursor and its bar; every
  action they name keeps its own button on the page.

## Questions

### Round 01

#### Q1: How far should the keyboard layer go?

**Answer:** A, a cursor over every block, comment, fold, and question with a few keys on it; "Cursor
should not be visible when using the mouse, and should start by selecting the topmost visible
element if the cursor is used in the middle of the page".

#### Q2: What is the round's current question, the one the option keys act on?

**Answer:** A, the question the cursor holds, moved by `j` `k` through questions, follow-ups,
settled points, notes, and Commit.

#### Q3: Which key picks an option of the current question?

**Answer:** A, the option's letter while a question is held, the Keyboard decision allowing a
selection's own keys; `b` goes back again once Escape clears it.

#### Q4: How does a comment cover several blocks by keyboard?

**Answer:** B, Shift with `j` `k` or the arrows (`J` `K`) stretch the range from the cursor.

#### Notes

The important thing for questions is seeing all the question's text and navigating all its answers,
even on a small laptop screen. The cursor must work on whole panes, scroll only when it moves
between panes or would come within about 100 px of the screen's edge, and not appear with the mouse,
which is distracting where it is fine in lists. A pending comment's `d` deletes at once, since it
can be undone.

## Decisions

- [Keyboard](../decisions/keyboard.md): changed, a key still means one thing at a time on a page,
  but a selection may give keys its own meaning while it holds, shown on it.

## Changes after approval

- Back (`b`) stays a plain shell binding, not a fallback as the spec assumed: the selection layer
  already runs first, and a fallback `b` would let any page bind it unchecked.
- A stop is held only when a key brought the focus there, on a page that mounts the cursor; the
  cursor is mounted only where blocks are stops, so an approved spec or plan keeps `j` `k`
  scrolling.
- `k` onto a tall stop shows its end, so reading upward goes through its body; with no cursor, the
  first key takes the first stop whose top is on screen.
- A pane shows whole only when it fits inside the 100 px margins, and the held stop's bar counts in
  the margin; a tall stop scrolls a screen at a time, so the spec's 1,400 px card takes two `j`.
- Inside a question card, an embed's buttons are reached by Tab: `j` leaving the card passes them.
- `s` on a settled point writes the point quoted into the session's composer, sending nothing.
- Enter on a question card focuses its comment field, as `i` does; the bar names "n unanswered" only
  where the page has `n`.
- A comment form opened by Enter on a held block gives the block the cursor back once closed by a
  key; `n` and `p` by a key hand the cursor to the question they reach.
- The Undo of a removed comment is Global undo's stack, the comment back where it was; the spec's
  own Undo toast went with the toast, and a settled point's comment joined the stack, as the human
  chose once both features were built.

## Follow-ups

- `isLayerOpen` in the key registry costs about 1.5–5 ms per key on a busy page, the largest app
  cost of a keypress measured; reworking its open-layer check is outside this feature.
- A production-build profile of a keypress was not taken: the sandbox serves only dev.
