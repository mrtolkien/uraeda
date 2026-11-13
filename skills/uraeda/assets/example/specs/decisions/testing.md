---
icon: flask-conical
---

# Testing

> "Test what would hurt to break. I'll find the rest by using the app."

The app's stage is `growing`: stored data, the date and repeat logic, and the main scenario of each
user story, through the real app.

## Rules

- A test gives way to the approved spec, the decisions, and the human's requests. _So:_ a test of
  behaviour a spec replaces is rewritten or removed with that behaviour, never kept by bending the
  code.
- A test asserts what a user or a caller observes. _So:_ it finds a task by its visible text, and
  survives a refactoring.
- The stage is the human's, and moves only when they say so. _So:_ no feature adds a test for every
  sentence of its spec on its own.

## Why

Stored tasks and calendar-day due dates are costly to get wrong, and the app is growing: each
story's main scenario proves that its parts connect, while a test of every sentence of a spec would
slow each change.

## Applies to

- [`tests/`](/tests/), and every feature or change of the app
