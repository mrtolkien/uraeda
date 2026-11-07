---
status: auto-approved
spec-revision: 1
---

# Plan: Keyboard nav in questions and specs

**Goal:** a keyboard cursor on the spec, plan, document, and round pages, which `j` `k` move from
stop to stop, with keys of its own on what it holds, so no action there needs the mouse.

**Architecture:** four parts, each with one owner, as the
[spec's architecture](spec.md#architecture) draws them.

- **The registry's selection layer** (`keys/store.ts`) owns the rule "a selection's keys win while
  it holds": bindings declared with the place `"selection"` run before the page's and the shell's,
  and clash only among themselves.
- **The cursor** (`cursor/`) owns where it starts, how it moves, the scroll rule, the tall-stop
  rule, and when it shows. It is the browser's focus on an element marked as a stop, held only after
  a key (see [R2](rulings.md#r2-the-cursor-is-the-focus-and-shows-only-after-a-key)). It knows no
  page: it finds stops by their mark, in document order. Its geometry is a pure function, so it is
  tested without a browser.
- **The stops** are marked by what draws them: the shared parts (a block, a pending comment, a fold,
  an embed's buttons) in one task, then each page's own (its keys for a block, a question card, the
  notes, the commit). A stop declares its keys through `useStopKeys` while held, and draws them in
  its `StopBar`.
- **The comment's range** (`commentRange.ts`) owns how a range grows and shrinks, for taps and for
  `J` `K` alike; the review page's `useKeyRange` holds the keys' anchor and head.

The removal's Undo is the writes' own: `useReviewActions.remove` and `useSettledWrites.remove` show
the existing undo toast once the removal is written, whatever pressed it.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A page binding of `j`, `k`, the arrows, or Escape already on these pages** makes the cursor's
   declaration throw. The cursor's bindings must not clash on the spec, plan, document, and round
   pages, with a session or the column open. Tasks 4 and 6: every existing page test renders them.
2. **`J` past the last block of a file, or across a decision's part into the spec's blocks**, does
   nothing: a range never spans two files. Task 6, a row of `spanned`'s test in task 2.
3. **`d` on a pending comment whose removal is refused** shows no toast: the toast follows the
   written removal only. Task 3, by the code path; the refusal's display is unchanged.
4. **A click on a block's toggle** holds no stop: no look, no bar, no keys, and its comment field
   still takes the focus. Task 4's `held.ts`, kept by the existing test "a block selected from its
   toggle gives its comment field the focus".
5. **Letters on a read-only round, or a question with no option of that letter**, leave the key to
   the page: the stop declares only its own letters, and none when read-only. Task 7.

## Global constraints

From the [Keyboard](../decisions/keyboard.md) decision, word for word:

- A shortcut MUST be declared in the key registry, and listened for nowhere else. Checked by a
  structural test.
- Every action MUST work by keyboard and by tap, never by hover or a single key alone.
- Single-key shortcuts MUST be switchable off by a setting in the settings file.
- Shortcuts MUST work at every width, with their hints hidden on narrow screens.
- A key MUST NOT mean two things at once on one page, though two pages may give it different
  meanings, and so may a selection while it holds, shown on it. Checked by the registry's tests.
- A page's own keys SHOULD be few and mnemonic.

From [UI behaviour](../decisions/ui-behaviour.md):

- Small edits MUST happen in place, with a dialog only to confirm an irreversible action or to hold
  a short form.
- Status MUST show next to what it concerns, with an error staying there until dealt with, never
  only in a toast.

From [Code quality](../decisions/code-quality.md):

- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting. Checked by clippy and Oxlint. (100 lines a function, 500 a file, 7 parameters, depth 4.)
- A new marker MUST NOT be added unless a human approves it in the plan.

From [Testing](../decisions/testing.md):

- A test MUST assert what a caller or a user observes, never how the code does it.
- A test of the web UI MUST guard behaviour that is costly to lose and that using the UI would not
  show, such as unsaved text or a git write.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width.

From the spec, exact values:

- The scroll margin is **100 px** from the screen's top and bottom edges, the sticky top bar and the
  status line counted.
- The toast of a removed review comment reads **"Removed your comment on lines 51–52"** for those
  lines, with Undo and `u`.
- A block's bar reads **"⏎ comment"**, **"J K range"**, **"s ask"**; a pending comment's **"⏎
  edit"**, **"d delete"**; a question's **"a b pick"** (its letters, up to F), **"i comment"**, **"s
  ask"**, **"n unanswered"**.
- `g` never picks: options G and later are picked by Tab and Space.

Existing behaviour to keep: a tap on a block extends the comment's range
([`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts), `selected`), and on a wide screen
gives the field the focus (`review.test.tsx`, "a block selected from its toggle gives its comment
field the focus"). `Ctrl+D` `Ctrl+U` still scroll
([`keys/scroll.ts`](/packages/web/src/keys/scroll.ts)).

## Code read

- [`keys/store.ts`](/packages/web/src/keys/store.ts): `Place` is `"page" | "shell"`; `placed()`
  orders the page's bindings first, and `runFirst` in
  [`registry.tsx`](/packages/web/src/keys/registry.tsx) runs the first non-fallback that does not
  return `false`. `assertNoClash` checks a component's bindings against every other entry. `publish`
  makes the status line's hints from every active binding with a `hint`.
- [`keys/scroll.ts`](/packages/web/src/keys/scroll.ts): `j` `k` and the arrows are the shell's
  fallbacks; `areaOf` finds the scrolling ancestor of an element, else the window.
- [`keys/LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx): `b` Back, a shell binding.
- [`lists/useListKeys.ts`](/packages/web/src/lists/useListKeys.ts) and
  [`lists/RowBar.tsx`](/packages/web/src/lists/RowBar.tsx): the lists' cursor and the bar of a row's
  keys, `BarAction = { icon?, keys, label, run }`, floating on the phone.
- [`layout/picked.ts`](/packages/web/src/layout/picked.ts): the picked look; the mockups'
  [`KeyboardNavMockups.stories.tsx`](/packages/web/src/KeyboardNavMockups.stories.tsx) draws the
  pane's look, `styles.pane`.
- [`pointerMoved.ts`](/packages/web/src/pointerMoved.ts): a mouse move that changed the pointer's
  place, for a React event only.
- [`Selection.tsx`](/packages/web/src/Selection.tsx): `Selection` and `PartSelection`, shared by the
  review ([`review/useReviewSelection.tsx`](/packages/web/src/review/useReviewSelection.tsx)), the
  settled points ([`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx)), and the read-only Ask
  ([`document/useAskSelection.tsx`](/packages/web/src/document/useAskSelection.tsx)). Each block's
  `Toggle` is a `button[aria-pressed]`; its container carries `data-lines`.
- [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts): `useCommentDraft` is at the limit;
  `selected` merges a tap into the range; the form shows under `last` while `draft.kind` is
  `"lines"`; the yellow follows `selection` alone.
- [`useReviewActions.ts`](/packages/web/src/useReviewActions.ts) `remove`, and
  [`settledWrites.ts`](/packages/web/src/settledWrites.ts) `remove`: removals with no undo. The core
  appends a comment on `review.comment` and `settled.comment` (see
  [R3](rulings.md#r3-undo-of-a-removed-comment-adds-it-again-at-the-end)).
- [`layout/useUndoToast.ts`](/packages/web/src/layout/useUndoToast.ts):
  `useUndoToast()(message, undo)`, and `u` pressing the newest Undo.
- [`ReviewComments.tsx`](/packages/web/src/ReviewComments.tsx) `CommentNote`: a pending review
  comment's and a settled point's comment's note, with Edit and Remove.
  [`reviewField.ts`](/packages/web/src/reviewField.ts) `placeOf` reads "lines 51–52".
- [`spec/SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx) `SpecLayout` (98 lines),
  [`PlanPage.tsx`](/packages/web/src/PlanPage.tsx),
  [`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx),
  [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx): the pages that mount the cursor.
- [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx) `QuestionCard` (95 lines): a `section`
  with the question's id; [`useAnswer.ts`](/packages/web/src/useAnswer.ts) `toggle(letter)` saves.
- [`RoundOutline.tsx`](/packages/web/src/RoundOutline.tsx) `useBlankKeys`: `n` `p` page keys;
  [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx) `NotesRead` with "Edit notes";
  [`RoundSubmit.tsx`](/packages/web/src/RoundSubmit.tsx) `RoundEnd`; `toSubmit` in `RoundPage.tsx`.
- [`layout/Foldable.tsx`](/packages/web/src/layout/Foldable.tsx): the folds' toggle;
  [`StoryPick.tsx`](/packages/web/src/StoryPick.tsx) "Comment" and
  [`LiveWindow.tsx`](/packages/web/src/LiveWindow.tsx) "Full screen": an embed's buttons.
- The status line is `footer[aria-label="Status line"]`
  ([`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx)), the top bar `[role="banner"]`.
- Tests: Vitest with happy-dom, in `packages/web/src/__tests__/`; `helpers.tsx` has `renderPage`
  over a fixture repository and the real server, `fixtureRepo`, `git`, `today`. The review's tests
  use `2026-10-06-recurring-tasks`, the round's `2026-10-11-web-ui`.
- Validation: `nix develop -c vp run fast` after each task; `nix develop -c vp run ready` before the
  push. One file: `nix develop -c vp test run <path>`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| What                                            | Why                                                         | Simpler alternative rejected                                         |
| ----------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| The registry's `"selection"` place              | The spec's layer; the Keyboard decision's changed rule      | A mode, as move mode: refused in Q3                                  |
| `cursor/`: stops, held, move, keys, the hook    | One cursor for four pages and both kinds of stops           | `useListKeys`: its rows are links in one list, with item moves       |
| `commentRange.ts`                               | Taps and `J` `K` share how a range grows                    | `J` `K` as taps: a tap only grows, `K` must shrink                   |
| `review/useKeyRange.ts`                         | The keys' anchor and head, which a tap has not              | State in `useCommentDraft`, which is at its limit                    |
| `hold` in the tests' helpers                    | Tasks 6 and 7 hold a stop as a key would, in happy-dom      | A `j` from the top: happy-dom lays nothing out, so no stop is on top |
| `useCommentDraft`, `SpecLayout`, `QuestionCard` | At the 100-line limit: each is split first, in a `refactor` | Growing them past the limit: a marker, which needs approval          |

## Test map

The tests run in Vitest with happy-dom: the pure ones call the functions; the page ones render the
real page over a fixture repository and the real server, and read what the core wrote. Most rows are
UI behaviour that the human checks in the sandbox, as the [Testing](../decisions/testing.md)
decision asks at the `early` stage: they say "none" and why.

| Spec                                                | Task | Check                                                                                                  |
| --------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| US1 1: `j` takes the topmost block, its keys shown  | 4    | `cursor-move.test.ts` "with no cursor, a key takes the topmost stop on screen"; the bar: none, UI look |
| US1 2: no scroll while 100 px inside                | 4    | `cursor-move.test.ts` "a move scrolls only within 100 px of an edge"                                   |
| US1 3: Enter opens the field, `Ctrl+Enter` adds     | 6    | `review.test.tsx` "J then Enter writes one comment on both scenarios' lines"                           |
| US1 more 1: 80 px above the status line             | 4    | a row of "a move scrolls only within 100 px of an edge"                                                |
| US1 more 2: Enter on a fold                         | 5    | none: a button's own Enter                                                                             |
| US1 more 3: `s` asks the agent                      | 6    | none: calls the page's existing Ask, checked in the sandbox                                            |
| US1 more 4: the mouse hides the cursor              | 4    | none: pointer behaviour, checked in the sandbox                                                        |
| US1 more 5: Escape clears                           | 4    | none: UI behaviour, checked in the sandbox                                                             |
| US1 more 6: an embed's buttons are stops            | 5    | none: UI behaviour, checked in the sandbox                                                             |
| US1 more 7: a read-only proposal's `s`              | 6    | none: as US1 more 3                                                                                    |
| US2 1: `J` stretches the range                      | 2, 6 | `comment-range.test.ts`; the yellow: none, UI look                                                     |
| US2 2: Enter comments on the range                  | 6    | `review.test.tsx` "J then Enter writes one comment on both scenarios' lines"                           |
| US2 3: `j` or Escape drops the range                | 6    | none: UI state, checked in the sandbox                                                                 |
| US2 more 1: Shift with `↓`, single keys off         | 1, 6 | the switch: `keys-registry.test.tsx` "with single-key shortcuts off…"; none else                       |
| US2 more 2: `K` shrinks                             | 2    | a row of `comment-range.test.ts`                                                                       |
| US3 1: the cursor stops on a comment                | 5    | none: UI behaviour, checked in the sandbox                                                             |
| US3 2: `d` removes at once, the toast               | 3    | `review.test.tsx` "a removed comment comes back with its text on Undo"                                 |
| US3 3: `u` takes it back                            | 3    | the same test: `u` presses the Undo, as `undo-toast.test.tsx` checks                                   |
| US3 more 1: Remove offers Undo                      | 3    | the same test, by the Remove button                                                                    |
| US3 more 2: a settled point's comment               | 3    | none: the same toast through `settled.comment`, checked in the sandbox                                 |
| US4 1: `j` rings Q2, its keys shown                 | 7    | none: UI look                                                                                          |
| US4 2: `b` picks and saves, a second unpicks        | 7    | `round.test.tsx` "a held question's letter picks and saves its option, and unpicks it"                 |
| US4 3: Escape, then `b` goes back                   | 1, 4 | `keys-registry.test.tsx` "a selection's key runs first…": none held, the shell's runs                  |
| US4 more 1: a tall card scrolls through             | 4    | `cursor-move.test.ts` "a stop taller than the room scrolls through before the next"                    |
| US4 more 2: the cursor reaches Q2.B                 | 7    | none: a card like any, in document order                                                               |
| US4 more 3: `i`, then Escape back to Q2             | 4, 7 | none: focus behaviour, checked in the sandbox                                                          |
| US4 more 4: `a` to `f` pick, G by Tab               | 7    | none: the letters list, read in review                                                                 |
| US4 more 5: the triage and the decisions check      | 7    | none: the same `RoundPage`                                                                             |
| US5 1–3, more 1: settled point, fold, notes, commit | 5, 7 | none: UI behaviour, checked in the sandbox                                                             |
| Edge (high): a letter typed in a field              | 1    | `keys-registry.test.tsx` "it does not run in a text field, or while composing"                         |
| Edge (high): `d` refused                            | 3    | none: the existing refusal path; see review focus 3                                                    |
| Edge (high): `b` with no option B                   | 1, 7 | the registry test above; task 7 declares only the question's letters                                   |
| Edge: the cursor's block removed by a commit        | 4    | none: rare, checked in review                                                                          |
| Edge: single keys off                               | 1    | `keys-registry.test.tsx` "with single-key shortcuts off…"                                              |
| Edge: Enter on a range with text in the field       | 2    | none: a tap's existing merge, which `J` reuses                                                         |
| Edge: cursor scrolled off with `Ctrl+D`             | 4    | a row of "with no cursor, a key takes the topmost stop on screen"                                      |
| Edge: a phone with a keyboard                       | 4    | none: `StopBar` draws nothing when narrow, checked in the sandbox                                      |
| SC-001: no mouse                                    | 8    | none: the walkthrough in the sandbox, at the final review                                              |
| SC-002: one key picks                               | 7    | the round test above                                                                                   |
| SC-003: the scroll margin                           | 4    | the `cursor-move.test.ts` tests                                                                        |
| SC-004: no flicker                                  | 4    | none: pointer behaviour, checked in the sandbox                                                        |
| Review focus: a clash on these pages                | 4, 6 | every existing test that renders the pages                                                             |
| Review focus: a range across files                  | 2    | a row of `comment-range.test.ts`                                                                       |

## Waves

1. Tasks 1, 2, 3: the registry, the comment draft, and the removals' writes; no file in common.
2. Task 4: the cursor, on the registry's layer.
3. Task 5: the shared stops, on the cursor.
4. Tasks 6, 7: the review pages and the round page; no file in common, each adding to its own test
   file.
5. Task 8: the keyboard guide.

---

## Task 1: The registry's selection layer

**Risky:** it changes the rule every page's keys go through: which binding runs first, and which
clash.

**Files:**

- Modify: `packages/web/src/keys/store.ts` (`Place`, `placed`, `assertNoClash`'s callers in `set`,
  `publish`)
- Modify: `packages/web/src/keys/KeyMap.tsx` or `keys/keyMap.ts`, wherever a place is named
- Test: `packages/web/src/__tests__/keys-registry.test.tsx`

**Interfaces:**

- Produces: `type Place = "page" | "shell" | "selection"`. `useKeys(bindings, "selection")` declares
  a selection's keys: they run before every page and shell binding of the key, they clash only with
  other selection bindings (and page and shell bindings only with each other), and they publish no
  status line hint: their stop draws them. The single-key switch drops them as any other.

- [x] **Step 1: Write the failing test**

```tsx
test("a selection's key runs before the page's and the shell's, and clashes only with another selection's", () => {
  const ran: Array<string> = [];
  // Page `b`, shell `b` as Back, selection `b`: no throw, the selection's runs alone.
  // Unmount the selection: the page's runs. Then two selections of `b`: throws.
});
```

The breaks it catches: a selection's key checked against the page's (throws on mount); the page's or
the shell's running first; a selection's key that stays after it is unmounted.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test run packages/web/src/__tests__/keys-registry.test.tsx`
- Expected: FAIL, `A key means two things on this page: "b" is bound twice`

- [x] **Step 3: Implement the layer in `keys/store.ts`**

Order `placed()` as selection, page, shell. In `set`, check a selection entry against selection
entries only, and the others against page and shell entries only. Leave selection bindings out of
`publish`. The key map lists them with the page's keys, or under a heading of their own if it groups
by place. Back stays as it is (see [R1](rulings.md#r1-back-stays-a-plain-binding)).

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

`feat(keyboard-nav): a selection's own keys in the registry`

## Task 2: The comment's range, out of the draft

**Files:**

- Create: `packages/web/src/commentRange.ts`
- Modify: `packages/web/src/useCommentDraft.ts` (`useCommentDraft`, `selected`, `sameFile`)
- Test: `packages/web/src/__tests__/comment-range.test.ts`

**Interfaces:**

- Produces, in `commentRange.ts`: `sameFile(a: Range, b: Range): boolean`;
  `merged(selection: Range | undefined, range: Range): Range`, the tap's rule moved as it is;
  `spanned(anchor: Range, head: Range): Range`, the lines from the first's start to the last's end,
  in either order, under the upper one's heading, and `head` alone when they are of different files.
- Produces, on `useCommentDraft`'s result: `stretch(range: Range): void` sets the selection, the
  review's yellow, without opening the form or moving `last`, and tells `onSelect`; `drop(): void`
  clears a selection while no form is open (`draft?.kind !== "lines"`).

- [x] **Step 1: Split `useCommentDraft`**, which is at the limit: move the sheet's placement and the
      field's focus effects, or the tap's `select`, out of its body. The tests pass before and
      after. Commit: `refactor(keyboard-nav): split the comment draft`.

- [x] **Step 2: Write the failing test**

```ts
test("a range spans its anchor and head in either order, under the upper heading, in one file", () => {
  // spanned(92–92 "US2", 93–93 "US2") is 92–93; spanned(head above anchor) the same;
  // spanned(92 on the spec, 15 on decision git) is the head alone;
  // merged keeps the first block's heading, as a tap does now.
});
```

The breaks: a head above the anchor reversing the lines; the lower block's heading; a range across
two files.

- [x] **Step 3: Run it to check it fails**

- Run: `nix develop -c vp test run packages/web/src/__tests__/comment-range.test.ts`
- Expected: FAIL, `Failed to resolve import "../commentRange.ts"`

- [x] **Step 4: Implement `commentRange.ts`, and `stretch` and `drop` in the draft**

- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, PASS

- [x] **Step 6: Commit**: `feat(keyboard-nav): the comment's range, for taps and keys`

## Task 3: Undo a removed comment

**Files:**

- Modify: `packages/web/src/useReviewActions.ts` (`remove`)
- Modify: `packages/web/src/settledWrites.ts` (`remove`)
- Test: `packages/web/src/__tests__/review.test.tsx`

**Interfaces:**

- Produces: `useReviewActions(...).remove(number)` shows, once the removal is written, the undo
  toast "Removed your comment on <placeOf(comment)>", "Removed your general comment" for a general
  one; its Undo adds the comment again with its text, lines, and decision through `review.comment`
  (see [R3](rulings.md#r3-undo-of-a-removed-comment-adds-it-again-at-the-end)).
  `useSettledWrites(...).remove(comment)` does the same, "Removed your comment on “<subject>”",
  through `settled.comment`. A refused removal shows no toast, its error as today.

- [x] **Step 1: Write the failing test**

```tsx
test("a removed comment comes back with its text on Undo", async () => {
  const r = longSpec();
  pendingComments(r, [
    [40, "First."],
    [52, "Second."],
  ]);
  await renderPage(PAGE, r);
  // Remove C2 by its button: the toast reads "Removed your comment on line 52".
  // Undo: the review file holds "Second." again, on line 52.
});
```

The breaks: a removal with no toast; an Undo that adds an empty comment or a general one.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test run packages/web/src/__tests__/review.test.tsx`
- Expected: FAIL, `Unable to find an element with the text: Removed your comment on line 52`

- [x] **Step 3: Implement the toasts and their Undo** in both removals, with `useUndoToast`.

- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS

- [x] **Step 5: Commit**: `feat(keyboard-nav): undo a removed comment`

## Task 4: The cursor

**Files:**

- Create: `packages/web/src/cursor/stops.ts`, `cursor/held.ts`, `cursor/move.ts`,
  `cursor/useCursor.ts`, `cursor/StopKeys.tsx`
- Modify: `packages/web/src/keys/scroll.ts` (export `areaOf`, `glideBy`, and `pendingOf`)
- Modify: `packages/web/src/keys/registry.tsx` (`watchKeys`, see
  [R6](rulings.md#r6-the-cursor-hears-the-last-key-through-the-registrys-watch))
- Modify: `packages/web/src/layout/Pane.tsx` (the mark `data-pane`)
- Modify: `packages/web/src/pointerMoved.ts` (a variant for a native event)
- Modify: `packages/web/src/layout/picked.ts` (`pickedStyles.pane`, from the mockups' `styles.pane`)
- Modify: `packages/web/src/__tests__/helpers.tsx` (`hold`)
- Test: `packages/web/src/__tests__/cursor-move.test.ts`

**Interfaces:**

- Consumes: task 1's `"selection"` place.
- Produces, `cursor/stops.ts`: `type StopKind = "block" | "comment" | "pane" | "control"`;
  `stopProps(kind: StopKind, focusable?: boolean)`, the mark `data-stop`, with `tabIndex: -1` where
  the element is not focusable itself; `stopsOf(): Array<HTMLElement>`, the shown stops of the
  document in order; `stopOf(element: Element | null): HTMLElement | null`.
- Produces, `cursor/held.ts`: `useHeld(ref: RefObject<HTMLElement | null>): boolean`, true while the
  element holds the focus and the last input was a key
  ([R2](rulings.md#r2-the-cursor-is-the-focus-and-shows-only-after-a-key)). A mouse move that moves
  the pointer blurs a held stop. Escape out of a text field inside a stop gives the stop the focus.
  The last key is heard through the registry's `watchKeys`
  ([R6](rulings.md#r6-the-cursor-hears-the-last-key-through-the-registrys-watch)).
- Produces, `cursor/move.ts`, pure: `MARGIN = 100`;
  `cursorStep(stops: ReadonlyArray<Box>, current: number | null, direction: 1 | -1, view: View): { focus: number; scrollBy: number } | null`,
  with `Box = { top, bottom, pane?: { id, top, bottom } }` and `View = { top, bottom }`, the room
  between the top bar and the status line, in window pixels; a pane is the nearest `data-pane`
  around a stop, its element as its `id`. `null` at either end: the key goes on to the scroll
  fallback. `scrollFor(next: Box, held: Box | undefined, view: View): number`, the scroll of a move
  to a given stop, which `focusStop` uses.
- Produces, `cursor/useCursor.ts`: `useCursor(): void`, the page's `j` `↓` (hint "j k", "move"), `k`
  `↑`, and Escape (clears the cursor; `false` when no stop is focused); and
  `focusStop(stop: HTMLElement, from?: HTMLElement): void`, which focuses a stop and scrolls by the
  rule, for a stop's own keys such as `J`.
- Produces, `cursor/StopKeys.tsx`:
  `type StopKey = { keys: string; label: string; run: () => void | false; bar?: string }`;
  `useStopKeys(keys: ReadonlyArray<StopKey>, held: boolean): void`, declared in the selection's
  place while held; `StopBar({ held, keys })`, the `RowBar` of the keys with a `bar` text, without
  the single keys when they are off, and nothing when narrow or not held. `bar` is the keys as the
  bar writes them, "J K", and `label` the word after them, "range"
  ([R7](rulings.md#r7-a-stops-bar-writes-its-keys-from-bar-and-its-word-from-label)).
- Produces, `helpers.tsx`: `hold(element: HTMLElement)`, which presses a key no binding has, then
  focuses the element, as the cursor would.

`cursorStep`'s rule, from the spec and
[R4](rulings.md#r4-k-with-no-cursor-starts-from-the-topmost-stop-too),
[R5](rulings.md#r5-a-tall-stop-scrolls-by-a-screen-less-the-margins):

1. With no cursor, or one wholly outside the view, take the first stop whose top is inside the view,
   else the first whose bottom is below the view's top, scrolled as in 3.
2. A stop taller than the room (`view.bottom - view.top - 2 * MARGIN`) whose end is past the margin
   in the key's direction scrolls by the smaller of what is past and the room, and stays.
3. Else take the next stop in the direction. Into another pane that fits the view, scroll the least
   that shows the pane whole. Else scroll so the stop's top is `MARGIN` below the view's top, or its
   bottom `MARGIN` above the view's bottom, whichever it crosses; a stop taller than the room shows
   its top after `j`, and its bottom after `k`.

- [x] **Step 1: Write the failing tests**

```ts
// View 60–860: a top bar of 60 px, the status line at 860.
test("with no cursor, a key takes the topmost stop on screen", ...);           // and one off screen
test("a move scrolls only within 100 px of an edge", ...);                     // 0 at 300; 80 px above → next 100 above
test("a stop taller than the room scrolls through before the next", ...);      // 1,400 px card
test("a move into another pane that fits shows it whole", ...);
```

The breaks: starting from the page's first stop; scrolling at every move; leaving a tall card before
its end; scrolling a fitting pane only to its stop.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/cursor-move.test.ts`
- Expected: FAIL, `Failed to resolve import "../cursor/move.ts"`

- [x] **Step 3: Implement `cursor/`**, and the small changes to `scroll.ts`, `pointerMoved.ts`,
      `picked.ts`, and `helpers.tsx`. The scroll glides unless the system asks for less motion. A
      held stop removed from the page passes the focus to the stop now at its place, or the last.

- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS

- [x] **Step 5: Commit**: `feat(keyboard-nav): a cursor over a page's stops`

## Task 5: The shared stops

**Files:**

- Modify: `packages/web/src/Selection.tsx` (`Selection`, `PartSelection`, `Toggle`, `Selectable`,
  `Tappable`)
- Modify: `packages/web/src/ReviewComments.tsx` (`CommentNote`)
- Modify: `packages/web/src/layout/Foldable.tsx`, `packages/web/src/StoryPick.tsx`,
  `packages/web/src/LiveWindow.tsx`
- Start from: `KeyboardNavMockups.stories.tsx`'s `ReviewCursor`, `ReviewRange`, `CommentRow`

**Interfaces:**

- Consumes: task 4's `stopProps`, `useHeld`, `useStopKeys`, `StopBar`, `focusStop`, `stopsOf`;
  `pickedStyles`.
- Produces: `Selection.keys?: (block: Block, toggle: HTMLElement) => ReadonlyArray<StopKey>` and
  `PartSelection.keys?: (range: DecisionRange, toggle: HTMLElement) => ReadonlyArray<StopKey>`: the
  keys a held block or part has, its bar under it. A block's toggle is a `"block"` stop; held, its
  container has the picked look over the yellow. A `CommentNote` with `onEdit` or `onRemove` is a
  `"comment"` stop: Enter edits ("⏎ edit"), `d` gives the focus to its block's stop, the nearest
  `"block"` stop before it, then removes ("d delete"). A fold's toggle, a story's Comment, and a
  window's Full screen are `"control"` stops, whose own Enter acts.

- [x] **Step 1: Mark the stops and draw the held look and bar**, as the mockups show.

- [x] **Step 2: Run the task's validation**: `nix develop -c vp run fast`, PASS. No new test: the
      look and the stops are UI behaviour the sandbox shows.

- [x] **Step 3: Commit**: `feat(keyboard-nav): blocks, comments, folds, and embeds as stops`

## Task 6: The review pages' keys

**Files:**

- Modify: `packages/web/src/spec/SpecPage.tsx` (`SpecLayout`), `packages/web/src/PlanPage.tsx`,
  `packages/web/src/DocumentPage.tsx`
- Create: `packages/web/src/review/useKeyRange.ts`
- Modify: `packages/web/src/review/useReviewSelection.tsx`,
  `packages/web/src/document/useAskSelection.tsx`
- Test: `packages/web/src/__tests__/review.test.tsx`

**Interfaces:**

- Consumes: task 2's `spanned`, `stretch`, `drop`; task 4's `useCursor`, `focusStop`, `stopsOf`,
  `hold`; task 5's `Selection.keys`.
- Produces: `useKeyRange(draft, tree)`: the keys' anchor and head; `stretch(direction, toggle)`
  focuses the next or previous `"block"` stop of the same file and sets the draft's range to
  `spanned(anchor, head)`; `drop()`. `stretch` checks `sameFile(anchor, next)` first and does
  nothing across files, neither moving nor touching the range: `spanned` returns the head alone
  across files, which would drop the range (review focus 2).

A held block's keys: Enter taps it ("⏎ comment"); `J` `shift+ArrowDown` and `K` `shift+ArrowUp`
stretch ("J K range"); `s` asks about the range, else the block ("s ask"), when the page has Ask;
Escape drops a range, and returns `false` with none; `j` `k` and the arrows drop a range and return
`false`, so the cursor moves on. A read-only document's held block has `s` alone.

- [x] **Step 1: Split `SpecLayout`**, which is at the limit, as the tests pass before and after.
      Commit: `refactor(keyboard-nav): split the spec's layout`.

- [ ] **Step 2: Write the failing test**

```tsx
test("J then Enter writes one comment on both scenarios' lines", async () => {
  await renderPage(PAGE, repo());
  await openUS2();
  hold(await scenario(FIRST));
  // J, Enter, type "Both.", Ctrl+Enter: the review file holds one comment on lines 92–93.
});
```

The breaks: `J` moving without stretching; Enter commenting on the head alone.

- [ ] **Step 3: Run it to check it fails**

- Run: `nix develop -c vp test run packages/web/src/__tests__/review.test.tsx`
- Expected: FAIL, the review file has no comment on lines 92–93

- [ ] **Step 4: Implement `useKeyRange`, the blocks' keys, and mount `useCursor`** on the spec,
      plan, and document pages.

- [ ] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, PASS

- [ ] **Step 6: Commit**: `feat(keyboard-nav): comment on a review's blocks from the keys`

## Task 7: The round's keys

**Files:**

- Modify: `packages/web/src/QuestionCard.tsx`, `packages/web/src/RoundPage.tsx`,
  `packages/web/src/SettledPoints.tsx`, `packages/web/src/RoundNotes.tsx`,
  `packages/web/src/RoundSubmit.tsx`
- Start from: `KeyboardNavMockups.stories.tsx`'s `RoundCursor`, `SettledCursor`
- Test: `packages/web/src/__tests__/round.test.tsx`

**Interfaces:**

- Consumes: task 4's `useCursor`, `stopProps`, `useHeld`, `useStopKeys`, `StopBar`, `hold`; task 5's
  `Selection.keys`; `pickedStyles.pane`.
- Produces: a question card is a `"pane"` stop, ringed while held. Its keys: the lowercase letters
  of its options from `a` to `f`, each toggling its option ("a b pick", the letters written out),
  none when read-only; `i` focuses its comment field ("i comment"); `s` asks the agent when the page
  has Ask ("s ask"); the bar also names "n unanswered", pressing `n`. A settled point's held block:
  Enter comments, `s` asks. The notes are a `"pane"` stop whose Enter opens them as "Edit notes"
  does; the commit's row a `"pane"` stop whose Enter focuses its first button, as `n` does.

- [ ] **Step 1: Split `QuestionCard`**, which is at the limit, as the tests pass before and after.
      Commit: `refactor(keyboard-nav): split the question card`.

- [ ] **Step 2: Write the failing test**

```tsx
test("a held question's letter picks and saves its option, and unpicks it", async () => {
  // Hold Q2's card; `b`: the round's file answers B; `b` again: no letter.
});
```

The breaks: a letter that does nothing on a held card; a pick shown but not saved.

- [ ] **Step 3: Run it to check it fails**

- Run: `nix develop -c vp test run packages/web/src/__tests__/round.test.tsx`
- Expected: FAIL, the round's file still has Q2 blank

- [ ] **Step 4: Implement the stops and their keys, and mount `useCursor`** on the round page.

- [ ] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, PASS

- [ ] **Step 6: Commit**: `feat(keyboard-nav): answer a round from the keys`

## Task 8: The keyboard guide

**Files:**

- Modify: `specs/ui/keyboard.md`

- [ ] **Step 1: Add the cursor to the guide**: a `## The cursor` section on its stops, its keys, its
      scroll margin, the tall stop, and the pointer hiding it; in Selection, "The mouse moves it
      too" holds for lists; in What shows the keys, a stop's keys show in its bar.

- [ ] **Step 2: Run the task's validation**: `nix develop -c vp run fast`, PASS

- [ ] **Step 3: Commit**: `docs(keyboard-nav): the cursor in the keyboard guide`
