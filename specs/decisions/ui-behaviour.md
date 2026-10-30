---
status: active
approved-by: mrtolkien
icon: mouse-pointer-click
---

# UI behaviour

The web UI acts on things where they are, and never loses what the human typed or where they were.
Text saves only when the human says so, or, in an outline's row, as they leave it. A write shows its
result at once, and a write to git its progress until it lands, without the human waiting.
Everything works by tap and by keyboard, not by hover.

## Rules

- Small edits MUST happen in place, and a dialog MUST only confirm an irreversible action or hold a
  short form. Checked by review.
- Text MUST save only on an explicit action, or, in an outline's row, also as its field is left.
  Checked by review.
- Unsaved text MUST never be dropped without asking, and MUST be marked outside an outline's row.
  Checked by review.
- Status MUST show next to what it concerns, and an error MUST stay there until dealt with, never
  only in a toast. Checked by review.
- A write MUST show its result at once and take the human where it leads, and a refused write MUST
  put back what it showed and say why next to what it concerns. Checked by review.
- A git write MUST show its progress in a toast until it lands, and git writes MUST land one after
  another, in the order they were made, without blocking the human. Checked by review.
- Back and reload MUST keep the human's place and what they were reading. Checked by review.
- Every action MUST work by tap and by keyboard, never by hover alone. Checked by review.
- A view of something that grows, such as a session's log, MUST mount a bounded number of rows, and
  folded content MUST NOT be mounted, so typing stays smooth in a session of thousands of items. A
  component that mounts hidden content is wrapped once, in a shared component. Checked by review.
- Lists whose rows open a pane SHOULD share one keyboard behaviour. Checked by review.

## Why

The UI hid one-word edits behind modals and lost the reading position on Back. It dropped letters
from notes saved as they were typed
([the UI's behaviour](../done/2026-10-12-ui-improvements.md#q3-which-rules-should-govern-how-the-ui-behaves),
[saving text with a button](../done/2026-10-14-text-inputs.md#q1-which-text-fields-should-save-only-with-a-button)).
Saving on a button then needs unsaved text protected, as GitHub does. The priorities and the inbox
are outlines, which the human asked to behave as an outliner does
([in place](../ui/surfaces.md#in-place)). Leaving a row's field, as by clicking another row, keeps
its text as Enter does, unlike other lines. An image pasted in a note's row saves its text first, as
an image added to a field does
([images](../done/2026-10-14-text-inputs.md#q6-should-adding-an-image-still-save-its-field-at-once)).
Commits take seconds while hooks run, so the human asked for "EXTREMELY CLEAR feedback" on writes
([feedback for git writes](../done/2026-10-16-redesign-interface.md#q9-what-does-a-button-that-writes-to-git-show-while-it-runs)).
Waiting on each commit then made the UI feel sluggish: the human wants it "to feel instant, but we
don't have to 'lie' to the user". A write shows its result and moves on, while a toast says what is
still landing; Uraeda's own commits only hold text and notes, so a refusal is rare
([how a commit shows](../2026-10-29-performance-pass/clarifications-01.md#q4-how-should-a-commit-show-while-it-runs)).

A session's 12-hour turn held 1,800 items, 97% of them tool calls, and drew about 500 of them:
Astryx's tool-call group mounts every row even folded, so typing lagged and old messages never
folded. Bounding by messages, not by what draws, was the gap.

## Alternatives considered

- A git write showing its action, never a guessed status, and blocking the other git writes until it
  ends, the earlier rule: every commit stopped the human for its hooks' seconds.
- Git writes queued behind the running one, but shown as their action only: the human still waited
  for the page a commit leads to.
- No toasts at all: confirmations from another page have nowhere to show.
- Text areas growing with their text, except an outline's row, which wraps in its place as its row
  does: the page moved under the human as they typed.
- Saving text on blur, or shortly after the last keystroke, outside an outline's row: a tap
  elsewhere saved a half-typed line.
- A click opening a list item's field with the cursor in it: the arrow keys moved the cursor, not
  the selection.

## Consequences

- Fields that save text share one hook, which keeps unsaved text on the same device only. An
  outline's row has its own hook, `useOutlineField`, and keeps no unsaved text.
- Git writes share one queue on the server, so they land in the order they were made, from every
  tab, and the toast shows the same queue everywhere.
- A hook's refusal undoes what the page showed, after the human may have moved on: its error stays
  next to what it concerns, and in the toast, until dealt with.
- Every list with a pane shares one keyboard behaviour, following Linear and Gmail
  ([keys in a list](../done/2026-10-16-redesign-priorities.md#q6-which-keys-move-through-the-list)).

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
- An outline's row: [`lists/OutlineEditor.tsx`](/packages/web/src/lists/OutlineEditor.tsx) and
  [`lists/useOutlineField.ts`](/packages/web/src/lists/useOutlineField.ts)
