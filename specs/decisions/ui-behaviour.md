---
status: proposed
approved-by:
icon: mouse-pointer-click
---

# UI behaviour

The web UI acts on things where they are, and never loses what the human typed or where they were.
Text saves only when the human says so, except in an outline, a list like the priorities or the
inbox whose rows save as they are left. A write shows its result at once, and a write to git its
progress until it lands, without the human waiting.

## Rules

- Small edits MUST happen in place, with a dialog only to confirm an irreversible action or to hold
  a short form. Checked by review.
- Text MUST save only on an explicit action, except an outline's row, which also saves as its field
  is left. Checked by review.
- Unsaved text MUST be marked as unsaved, outside an outline's rows. Checked by review.
- Status MUST show next to what it concerns, with an error staying there until dealt with, never
  only in a toast. Checked by review.
- A write MUST show its result at once and take the human where it leads. Checked by review.
- A refused write MUST put back what it showed and say why next to what it concerns. Checked by
  review.
- A git write MUST show its progress in a toast until it lands. Checked by review.
- Git writes MUST land one after another, in the order they were made, without blocking the human.
  Checked by review.
- Back and reload MUST keep the human's place and what they were reading. Checked by review.
- A view of something that grows, such as a session's log, MUST keep typing smooth at thousands of
  items, by mounting a bounded number of rows and nothing folded. Checked by review.
- Unsaved text SHOULD NOT be dropped without asking. Checked by review.
- Lists whose rows open a pane SHOULD share one keyboard behaviour. Checked by review.

## Why

Edits hidden behind dialogs, a reading position lost on Back, and letters dropped from notes saved
while typing made the UI hard to trust. Saving on a button needs unsaved text protected, as GitHub
does. Outlines behave as outliners do. Commits take seconds while hooks run, and the UI should "feel
instant, but we don't have to 'lie' to the user": Uraeda's commits hold only text, so a refusal is
rare. History: [Performance pass](../done/2026-10-29-performance-pass.md).

## Alternatives considered

- Saving text on blur, or shortly after the last keystroke, outside an outline's row: a tap
  elsewhere saved a half-typed line.
- Text areas growing with their text: the page moved under the human as they typed.
- A git write showing only its action until it ends, blocking the others or queued behind them: the
  human waited for every commit's hooks, and for the page it leads to.

## Consequences

- Unsaved text is kept on the same device only.
- Git writes land in one order from every tab, and every tab's toast shows the same writes.
- A hook's refusal undoes what the page showed after the human may have moved on: its error stays
  next to what it concerns, and in the toast, until dealt with.
- Every list with a pane shares one keyboard behaviour, following Linear and Gmail.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
