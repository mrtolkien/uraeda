---
icon: mouse-pointer-click
---

# UI behaviour

> "It should feel instant, but we don't have to lie to the user."

The web UI never loses what the human typed or where they were.

## Rules

- Text saves only on an explicit action, except an outline's row, which saves as it is left. _So:_
  a tap elsewhere never saves a half-typed line.
- Unsaved text is never dropped without asking. _So:_ leaving a page with a draft asks first.
- A write shows its result at once, and a git write its progress until it lands. _So:_ the human
  never waits for a commit's hooks.
- A refused write puts back what it showed, and says why next to it. _So:_ never only in a toast.
- Back and reload keep the human's place. _So:_ a long spec reopens where they were reading.

## Why

Edits hidden behind dialogs, a reading position lost on Back, and letters dropped from notes saved
while typing made the UI hard to trust. Uraeda's commits hold only text, so a refusal is rare.
History: [Performance pass](../done/2026-10-29-performance-pass.md).

## Alternatives considered

- Saving text on blur, or shortly after the last keystroke: a tap elsewhere saved a half-typed line.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
