---
status: active
approved-by: mrtolkien
icon: mouse-pointer-click
---

# UI behaviour

The web UI acts on things where they are, and never loses what the human typed or where they were.
Text saves only when the human says so, except in an outline, a list like the priorities or the
inbox whose rows save as they are left. A slow write to git shows clearly while it runs.

## Rules

- Small edits MUST happen in place, with a dialog only to confirm an irreversible action or to hold
  a short form. Checked by review.
- Text MUST save only on an explicit action, except an outline's row, which also saves as its field
  is left. Checked by review.
- Unsaved text MUST NOT be dropped without asking. Checked by review.
- Unsaved text MUST be marked as unsaved, outside an outline's rows. Checked by review.
- Status MUST show next to what it concerns, with an error staying there until dealt with, never
  only in a toast. Checked by review.
- A git write MUST show its action at once, never a guessed status. Checked by review.
- A git write MUST block other git writes from the UI until it ends. Checked by review.
- Back and reload MUST keep the human's place and what they were reading. Checked by review.
- A view of something that grows, such as a session's log, MUST keep typing smooth at thousands of
  items, by mounting a bounded number of rows and nothing folded. Checked by review.
- Lists whose rows open a pane SHOULD share one keyboard behaviour. Checked by review.

## Why

Edits hidden behind dialogs, a reading position lost on Back, and letters dropped from notes saved
while typing made the UI hard to trust. Saving on a button needs unsaved text protected, as GitHub
does. Outlines behave as outliners do. Commits take seconds while hooks run, so a write says clearly
what it does. History: [Text inputs](../done/2026-10-14-text-inputs.md).

## Alternatives considered

- Saving text on blur, or shortly after the last keystroke, outside an outline's row: a tap
  elsewhere saved a half-typed line.
- Text areas growing with their text: the page moved under the human as they typed.
- No toasts at all: confirmations from another page have nowhere to show.

## Consequences

- Unsaved text is kept on the same device only.
- Two git writes never start from the UI at once.
- Every list with a pane shares one keyboard behaviour, following Linear and Gmail.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
