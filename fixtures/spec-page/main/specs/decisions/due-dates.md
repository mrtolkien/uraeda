---
icon: calendar-clock
---

# Due dates

> "A task due Monday stays due Monday, wherever I am."

Due dates are calendar days, like `2026-10-12`, without a time or a timezone.

## Rules

- A due date is a calendar day, never an instant. _So:_ it is stored as `2026-10-12`.
- Date arithmetic happens in the app's date module. _So:_ a component never builds a `Date` from a
  due date.
