---
status: proposed
approved-by:
icon: mouse-pointer-click
---

# UI behaviour

The web UI acts on things where they are, and never loses what the human typed or where they were.
Text saves only when the human says so, and a slow write to git shows clearly while it runs.
Everything works by tap and by keyboard, not by hover.

## Rules

- Small edits MUST happen in place, and a dialog or sheet MUST only confirm an irreversible action
  or hold a short form, with a close button that Back triggers. Checked by the UI tests.
- Text MUST save only on an explicit action, never as it is typed or when its field loses focus.
  Checked by the UI tests.
- Unsaved text MUST be marked, kept in the browser until saved or discarded, and never dropped
  without asking. Checked by the UI tests.
- Multi-line fields, except the chat composer, MUST share the app's one text area, at a fixed height
  that scrolls rather than grows. Checked by the UI tests.
- Status MUST show next to what it concerns, and errors MUST stay there until dealt with; a toast
  MAY only confirm a result the human cannot see, and MUST NOT be an error's only place. Checked by
  the UI tests.
- A git write MUST show its action at once on its button and its sidebar card, never a guessed
  status, and block other git writes until it ends. Checked by the UI tests.
- Back MUST restore the scroll position and open items, and a reloading page MUST keep its content
  shown. Checked by the UI tests.
- Every action MUST have a tap and a keyboard path; a control shown on hover MUST also show on focus
  and without hover, and shortcuts MUST NOT act in a text field. Checked by the UI and browser
  tests.
- A list whose rows open a pane MUST move its selection with ↑/↓ or j/k, Home/End, Enter, and
  Escape, the selected row distinct from the focused one. Checked by the UI tests.

## Why

The UI hid one-word edits behind modals and lost the reading position on Back. It dropped letters
from notes saved as they were typed
([the UI's behaviour](../done/2026-10-12-ui-improvements.md#q3-which-rules-should-govern-how-the-ui-behaves),
[saving text with a button](../done/2026-10-14-text-inputs.md#q1-which-text-fields-should-save-only-with-a-button)).
Saving on a button then needs unsaved text protected, as GitHub does. Commits take seconds while
hooks run, so the human asked for "EXTREMELY CLEAR feedback" on writes
([feedback for git writes](../done/2026-10-16-redesign-interface.md#q9-what-does-a-button-that-writes-to-git-show-while-it-runs)).

## Alternatives considered

- No toasts at all: confirmations from another page have nowhere to show.
- Text areas growing with their text: the page moves under the human as they type.
- Saving text on Enter, on blur, or shortly after the last keystroke: half-typed or trimmed text got
  saved.
- A click opening a list item's field with the cursor in it: the arrow keys moved the cursor, not
  the selection.

## Consequences

- Fields that save text share one hook, which keeps unsaved text on the same device only.
- Git writes share one record of writes in flight, so two never start from the UI at once.
- Every list with a pane shares one keyboard behaviour, following Linear and Gmail
  ([keys in a list](../done/2026-10-16-redesign-priorities.md#q6-which-keys-move-through-the-list)).

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
