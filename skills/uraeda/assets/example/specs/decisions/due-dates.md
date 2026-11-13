---
icon: calendar-clock
---

# Due dates

> "A task due Monday stays due Monday, wherever I am."

Due dates are calendar days, like `2026-10-12`, without a time or a timezone.

## Rules

- A due date is a calendar day, never an instant. _So:_ it is stored as `2026-10-12`, and a feature
  that needs "at 3pm" changes this decision first.
- Date arithmetic happens in one place, the app's date module. _So:_ a component that needs "a week
  later" asks the module, and never builds a `Date` from a due date itself.

## Why

Repeating tasks add date arithmetic, and reminders will add more. A timestamp at local midnight
drifts: adding 7 days across a daylight saving change gives 23:00 the day before, so weekly tasks
move. A calendar day has no time to drift. History:
[Recurring tasks](../done/2026-10-06-recurring-tasks.md).

## Alternatives considered

- UTC timestamps: exact instants, but a task due Monday shows as due Sunday for users west of UTC.

## Applies to

- [Date helpers](/src/lib/), [the store](/src/store/), and any feature with dates: recurring tasks,
  reminders, a calendar view

## Revisit when

The Temporal API is available in all supported browsers.
