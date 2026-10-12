---
status: active
approved-by: mrtolkien
---

# UI behaviour

The web UI acts on things where they are: a row is tapped as a whole, a small edit happens in place,
and status shows next to what it is about. Overlays are kept for short forms and for confirming what
cannot be undone, a toast confirms only what cannot be seen, and leaving a page and coming back
keeps the human's place.

## Rules

- A row that leads somewhere MUST be tappable as a whole, not only through a button or a chevron.
- A small edit, like a line's text, MUST happen in place: Enter or blur saves, Escape cancels.
- A modal sheet or dialog MUST be used only to confirm an irreversible action or to fill a short
  form, like adding a line. Everything else happens in the page.
- Every sheet and dialog MUST have a visible close button, and Back MUST close it.
- A save's status MUST show next to its control: saving, saved, or the error.
- A toast MAY confirm only a result the human cannot see on screen. It MUST last 5 seconds, MAY
  carry one action, Undo, which reverts that change alone, and MUST NOT be the only place an error
  shows.
- Errors MUST stay on screen until the human deals with them, or the action is retried.
- Back MUST return to the same scroll position and the same open items. A page MUST keep showing its
  content while its data reloads.
- Nothing MUST work only on hover: every action has a tap or a keyboard path.
- A keyboard shortcut MUST NOT act while a text field has the focus.

## Why

The proposal's problems are behaviour as much as looks: a one-word edit behind a modal, a
confirmation taking the top bar's place, a reading position lost on Back
([proposal](../2026-10-12-ui-improvements/proposal.md)). Design systems answer each with a rule:
modals only when needed (NN/g, Atlassian), status inline and short toasts (Pajamas), a visible close
and Back on sheets (NN/g), state that survives navigation (Vercel)
([Q3](../2026-10-12-ui-improvements/clarifications-01.md#q3-which-rules-should-govern-how-the-ui-behaves),
[how the UI behaves](../2026-10-12-ui-improvements/discovery-01.md#how-the-ui-behaves)).

## Alternatives considered

- The same rules with no toasts at all, as Primer advises for accessibility: confirmations from
  another page then have nowhere to show, and Undo no place to live.

## Consequences

- Undo in a toast goes against Pajamas' "no actions in toasts"; it is limited to the change just
  made, and Discard still covers every uncommitted change.
- Every page needs its own scroll restoration once its data has drawn, through the shared router.
- Short forms may still be modal, which keeps ＋ quick to reach on any width.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
