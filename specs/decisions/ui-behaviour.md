---
icon: mouse-pointer-click
---

# UI behaviour

> "I want the UI to feel instant, but we don't have to "lie" to the user"

The human said it of commits, which take seconds while their hooks run. The rules hold the same
trust for the rest of the screen: what the human typed, where they were, and what the app says
happened. How each surface behaves is in the [UI guides](../ui/README.md).

## Rules

- The app never loses what the human typed: text stays until they save, send, or discard it, and
  dropping it for good asks first. _So:_ a commit message typed on the Git page is still there after
  the human leaves the page and comes back.
- Back, a reload, and a change of width keep the human's place: the page, its scroll, and what was
  open on it. _So:_ Back to a spec leaves closed a fold the human closed, even when the address
  names it.
- An action that writes shows its result at once and never blocks the human, and a refused one puts
  back what it showed. _So:_ approving a spec opens its session while the commit lands behind it,
  and a hook's refusal returns the review to its verdict.
- An error stays next to what it concerns until dealt with, never only in a toast. _So:_ a row's
  refusal is not cleared when the row hides, and a refused sign-out shows in the menu that asked for
  it.

## Why

The human reads and writes in the app for hours. They stop trusting it when a field drops letters, a
page forgets their place, or a button claims what git refused. A commit takes seconds while its
hooks run, so waiting for each one slows every approval. Showing the result first stays honest while
a refusal undoes it in plain sight. Uraeda's own commits hold only text, so a refusal is rare.
History: [Performance pass](../done/2026-10-29-performance-pass.md).

## Alternatives considered

- Blocking every button while a commit runs, with a spinner on the one pressed, the earlier choice:
  the human waited for every commit's hooks, and for the page it leads to.
- Saving a field's text to its file as it is typed: a save raced the typing, and letters were lost.

## Applies to

- [`app/`](/app/), and every feature that adds or changes a view
