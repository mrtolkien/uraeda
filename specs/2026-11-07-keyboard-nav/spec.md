---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Keyboard nav in questions and specs

> [!IMPORTANT]
>
> Spec to review, about 20 minutes.
>
> - You approve a keyboard cursor on the spec, plan, and round pages, which `j` `k` move and whose
>   keys comment, pick an option by its letter, and ask the agent, so no action there needs the
>   mouse.
> - The Keyboard decision changes: a selection may give keys its own meaning while it holds, so a
>   question's `b` picks B, and Escape gives `b` back to Back.
> - Your note read one way: on the round, the cursor holds a whole question card, and `j` scrolls
>   through a card taller than the screen before moving on, so every option can be read.
> - Your note read one way: the page scrolls only when the cursor comes within 100 px of the
>   screen's top or bottom edge, or moves to another pane.
> - `J` `K` stretch a comment's range on a review, where on a list they move a row, as you chose.
> - `d` removes a pending comment at once, with an Undo, as your note asked; the Global undo
>   feature, also waiting for review, later takes that Undo into its stack.
> - Risk tier medium: the key registry, which every page uses, gains the selection's keys.

The spec and plan reviews, and the rounds of questions, are the pages read most, and they still need
the mouse or a long run of Tab: to reach a block, to comment, to pick an option. This feature gives
them a cursor, as the lists have, with a few keys on what it holds, as the [proposal](proposal.md)
asks. The research is in [discovery](discovery-01.md), and the answers in
[clarifications](clarifications-01.md).

## Decisions

- **Changed: [Keyboard](../decisions/keyboard.md)**. A key still means one thing at a time on a
  page, but a selection may give keys its own meaning while it holds, shown on it.

Relied on:

| Decision                                     | What it means for this spec                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| [Keyboard](../decisions/keyboard.md)         | Every new key is in the registry, hinted, and off with the single keys      |
| [UI behaviour](../decisions/ui-behaviour.md) | A removal that can be undone asks nothing first                             |
| [UI look](../decisions/ui-look.md)           | The cursor is the lists' selected look on a block, the focus ring on a pane |
| [Testing](../decisions/testing.md)           | The key scenarios below are the tests, at the project's stage               |
| [Preview](../decisions/preview.md)           | The mockups below are stories of the real pages                             |

## User stories

### US1: Move along a review and comment on a block (P1)

On a spec or plan waiting for review, the human presses `j` and the cursor lands on the topmost
block on screen. They move it block by block, and Enter opens the comment field under the block.

[The cursor on a block](/packages/web/src/KeyboardNavMockups.stories.tsx#ReviewCursor)

Key scenarios:

1. **Given** a spec scrolled to US1, its opening paragraph the topmost block on screen, **When** the
   human presses `j`, **Then** the cursor holds that paragraph, and "⏎ comment", "J K range", and "s
   ask" show under it.
2. **Given** the cursor on that paragraph, **When** the human presses `j` twice, **Then** it holds
   the first key scenario, then the second, and the page does not scroll while each stays at least
   100 px inside the screen.
3. **Given** the cursor on a block, **When** the human presses Enter, **Then** the comment field
   opens under it with the focus, as a click does today, and `Ctrl+Enter` adds the comment.

More scenarios:

1. **Given** the cursor on a block 80 px above the status line, **When** the human presses `j`,
   **Then** the page scrolls so the next block sits 100 px above the status line.
2. **Given** the cursor on a "More scenarios" fold, **When** the human presses Enter, **Then** the
   fold opens and the cursor stays on it.
3. **Given** the cursor on a block, **When** the human presses `s`, **Then** the column's Session
   tab opens with the block quoted, as Ask the agent does.
4. **Given** the cursor on a block, **When** the human moves the mouse, **Then** the cursor hides;
   the next `j` starts again from the topmost block on screen.
5. **Given** the cursor on a block, **When** the human presses Escape, **Then** the cursor clears,
   and `j` `k` start again from the topmost block on screen.
6. **Given** a story embedded in the spec, **When** the cursor reaches it, **Then** it stops on the
   story's buttons, Comment and Full screen; what is inside the story stays the pointer's.
7. **Given** a read-only proposal with Ask the agent, **When** the human presses `j` then `s`,
   **Then** the agent is asked about the topmost block, as on a review.

### US2: Comment on a range of blocks (P1)

The human stretches the comment over several blocks with `J` or `K`, then comments on them all at
once.

[A range of two scenarios](/packages/web/src/KeyboardNavMockups.stories.tsx#ReviewRange)

Key scenarios:

1. **Given** the cursor on US2's first key scenario, **When** the human presses `J`, **Then** the
   range covers both key scenarios in the review's yellow, the cursor on the second.
2. **Given** that range, **When** the human presses Enter, **Then** the comment field opens under
   the second scenario, its anchor reading the lines of both.
3. **Given** that range, **When** the human presses `j` or Escape, **Then** the range drops, and the
   cursor moves on or stays.

More scenarios:

1. **Given** the cursor on a block, **When** the human presses Shift with `↓`, **Then** the range
   stretches as with `J`, even with the single keys off.
2. **Given** a range of three blocks, **When** the human presses `K`, **Then** it shrinks to two.

### US3: Edit or delete a pending comment (P1)

A pending comment is a stop of the cursor, under its block. Enter edits it, `d` deletes it at once,
and `u` takes it back.

[The cursor on a comment](/packages/web/src/KeyboardNavMockups.stories.tsx#CommentRow)

[The comment deleted](/packages/web/src/KeyboardNavMockups.stories.tsx#CommentDeleted)

Key scenarios:

1. **Given** a comment on lines 51–52, **When** the cursor moves past its block, **Then** it stops
   on the comment, with "⏎ edit" and "d delete" under it.
2. **Given** the cursor on that comment, **When** the human presses `d`, **Then** it goes with no
   question, the toast reads "Removed your comment on lines 51–52" with Undo `u`, and the cursor
   holds its block.
3. **Given** that toast, **When** the human presses `u`, **Then** the comment is back, with its
   text.

More scenarios:

1. **Given** a comment removed with its Remove button, **When** the removal lands, **Then** the same
   toast offers Undo.
2. **Given** the cursor on a comment on a settled point, **When** the human presses `d`, **Then** it
   goes as a review comment does, with the same Undo.

### US4: Answer a round from the keyboard (P1)

On a round, the cursor holds a whole question card. The option letters pick, `i` or Enter opens its
comment field, and `n` goes on to the next blank question.

[The cursor on a question](/packages/web/src/KeyboardNavMockups.stories.tsx#RoundCursor)

Key scenarios:

1. **Given** Q2 with options A and B at the top of the screen, **When** the human presses `j`,
   **Then** the cursor rings Q2's card, and "a b pick", "i comment", "s ask", and "n unanswered"
   show in it.
2. **Given** the cursor on Q2, **When** the human presses `b`, **Then** B is picked and saved, and a
   second `b` unpicks it; `a` then `b` picks both.
3. **Given** the cursor on Q2, **When** the human presses Escape, then `b`, **Then** the cursor
   clears, and `b` goes back, as on any page.

More scenarios:

1. **Given** the cursor on Q3, whose card is 1,400 px tall on a 900 px screen, **When** the human
   presses `j`, **Then** the page scrolls down through Q3 until its end shows, and only the next `j`
   moves to Q4.
2. **Given** Q2 answered B, so its follow-up Q2.B shows, **When** the human presses `j`, **Then**
   the cursor holds Q2.B.
3. **Given** the cursor on Q2, **When** the human presses `i`, **Then** its comment field takes the
   focus; Escape leaves it, the cursor back on Q2.
4. **Given** a question with seven options, A to G, **When** the cursor holds it, **Then** `a` to
   `f` pick, and G is picked by Tab and Space, since `g` starts a go.
5. **Given** the inbox triage or the decisions check, **When** the human presses `j` then a letter,
   **Then** it picks as on a round.

### US5: Settled points, notes, and the commit from the keyboard (P2)

After the questions, the cursor goes on through the settled points, the notes, and the commit, each
a stop with its own keys.

[The cursor on a settled point](/packages/web/src/KeyboardNavMockups.stories.tsx#SettledCursor)

Key scenarios:

1. **Given** the cursor on a settled point, **When** the human presses Enter, **Then** its comment
   field opens under it, as a click does.
2. **Given** the cursor on the folded "Under the hood", **When** the human presses Enter, **Then**
   it opens, and `j` goes on to its first point.
3. **Given** the cursor on the notes, **When** the human presses Enter, **Then** the column's Notes
   tab opens with its field focused.

More scenarios:

1. **Given** the cursor on the commit, **When** the human presses Enter, **Then** the focus is on
   its first button, as `n` does once nothing is blank.

## Replaced behaviour

- **`j` `k` scroll the spec, plan, and round pages a few lines at a time.** They move the cursor
  now; `Ctrl+D` `Ctrl+U` still scroll. No test guards these pages' scroll: `keys-scroll.test.tsx`'s
  tests of a page without rows keep holding for the other pages.
- **A pending comment's Remove deletes it with no Undo.** Guarded by no test: the review's removal
  tests check what is removed, which stays.
- **The pointer moves a list's selection** stays on lists; on these pages, the pointer hides the
  cursor instead, as you asked. Guarded by `hover-selection.test.tsx`, which keeps holding for
  lists.

## Architecture

The cursor reuses what exists: every block already has a focusable toggle, and the lists already
move the focus with `j` `k` ([discovery](discovery-01.md#important-reads)). The cursor is the
browser's focus on a stop, so screen readers follow it. The keys of what it holds come from the
registry, in a new layer the Keyboard decision's change allows.

- **The cursor** moves the focus among a page's stops, in reading order. It owns where it starts
  (the topmost stop on screen), the scroll rule (100 px from the screen's top and bottom edges, the
  sticky header and the status line counted, and a pane brought into view whole when it fits), the
  tall-pane rule (scroll through a stop before leaving it), and hiding under the pointer.
- **The stops** mark what the cursor reaches: a review's blocks, pending comments, folds, and the
  buttons of an embedded story or mockup; a round's question cards, settled points, folds, notes,
  and commit. Each page marks its own; the cursor knows none of them.
- **The selection's keys**, a layer of the key registry: bindings declared by what the cursor holds,
  only while it holds, that run before the page's and the shell's. It owns the rule "a selection's
  keys win while it holds", and the registry's clash check covers them among themselves.
- **The comment's range** takes the range logic out of the comment draft, so taps and `J` `K` share
  it. It owns how a range grows, shrinks, and drops.
- **The removal's Undo**: removing a pending comment, or a comment on a settled point, offers the
  existing undo toast, whatever removed it.
- **The keyboard guide** gains the cursor: its stops, its keys, and where the pointer hides it.

Tradeoffs:

- `j` `k` no longer scroll these pages by a few lines; the cursor's scroll replaces it.
- While a question is held, `b` picks B: going back takes Escape first.
- The comment draft, the spec page's layout, and the question card are at the 100-line function
  limit, so each is split before it grows.

## Edge cases

| Importance | Situation                                                | What happens                                                                 |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| High       | A letter typed in a comment field                        | the field takes it; nothing is picked                                        |
| High       | `d` on a comment whose removal fails to save             | the comment stays, and the error shows under it, as today                    |
| High       | `b` on a question with no option B                       | `b` goes back: a question takes only the letters of its options              |
| Normal     | The cursor's block removed by an agent's new commit      | the cursor moves to the next stop, or the previous at the end                |
| Normal     | The single-key shortcuts turned off                      | arrows move, Enter comments, Shift with arrows stretches; letters do nothing |
| Normal     | Enter on a range with an open comment field holding text | the field takes the new range, its text kept, as a second tap does today     |
| Niche      | The cursor scrolled off screen with `Ctrl+D`             | the next `j` starts from the topmost stop on screen                          |
| Niche      | A phone with a keyboard attached                         | the keys work; no hints show, as on every phone page                         |

## Success criteria

- **SC-001** (no mouse): Every action on a spec, plan, or round, but inside a story or a mockup, can
  be done with keys alone, Tab never pressed.
- **SC-002** (one key): Picking an option of the question the cursor holds takes one key.
- **SC-003** (scroll margin): After any cursor move, the stop's top or bottom sits at least 100 px
  inside the screen, or the stop is taller than the screen.
- **SC-004** (no flicker): Moving the pointer never shows the cursor.

## Assumptions

The points settled in [Check these](clarifications-01.md#check-these) and
[Settled without the human](clarifications-01.md#settled-without-the-human) hold as written there,
but for these, which your answers and notes changed:

- **A pending comment is a row the cursor stops on**: `d` deletes at once, with an Undo, as your
  note asked.
- **A page opens with no cursor**: the first key starts from the topmost stop on screen, as you
  answered, not the first of the page.
- **The pointer moves the cursor**: it hides it instead, as your note asked.
- **The cursor's look**: on a pane, a question card, it is the focus ring and the bar, without the
  tint, which would sit behind a whole question's text.

Settled while writing this spec:

- **Back becomes a fallback**, so a held question's `b` runs first; with nothing held, `b` goes back
  as before.
- **`g` never picks**: an option G or later is picked by Tab and Space, since `g` starts a go.
- **`i` focuses a question's comment field** while a question is held, before the column composer's
  `i`.
- **A range is dropped by a plain move**, as Notion does, so `j` after `J` moves without stretching.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

Medium: no data or file format changes, but the key registry, which every page uses, gains a layer
that runs before the page's keys.
