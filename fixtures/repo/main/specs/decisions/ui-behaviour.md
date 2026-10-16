---
status: active
approved-by: mrtolkien
icon: mouse-pointer-click
---

# UI behaviour

The web UI acts on things where they are: a row is tapped as a whole, a small edit happens in place,
and status shows next to what it is about. Leaving a page and coming back keeps the human's place.

## Rules

- A row that leads somewhere MUST be tappable as a whole, not only through a button or a chevron.
  Checked by the browser tests.
- A small edit, like a line's text, MUST happen in place. Checked by the browser tests.

## Why

The human acts on what they are looking at, without a detour through a dialog.

## Alternatives considered

- A dialog for every edit: the list hides behind it.

## Consequences

- Every list row is a link.

## Applies to

- The web UI's pages
