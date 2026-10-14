---
status: active
approved-by: mrtolkien
---

# Due dates

Due dates are calendar days, like `2026-10-12`, without a time or a timezone. A task due Monday
stays due Monday wherever the user is, and adding a week never lands on Sunday because of daylight
saving time.

## Rules

- Due dates MUST be stored as `YYYY-MM-DD` strings. Checked by the `CalendarDay` type and the
  store's upgrade test.
- Date arithmetic MUST go through `src/lib/dates.ts`. Checked by review.
- Code MUST NOT convert a due date to a `Date`, except inside `src/lib/dates.ts` and to display it.
  Checked by review.

## Why

Recurring tasks add date arithmetic, and reminders will add more. Due dates were timestamps at local
midnight: adding 7 days across a daylight saving change gave 23:00 the day before, so weekly tasks
drifted. See
[Q4](../2026-10-06-recurring-tasks/clarifications-01.md#q4-how-should-the-app-store-due-dates) and
the [discovery](../2026-10-06-recurring-tasks/discovery-01.md#date-handling).

## Alternatives considered

- UTC timestamps: exact instants, but a task due Monday shows as due Sunday for users west of UTC.
- The Temporal API: the right model, but not available in all supported browsers yet.

## Consequences

- Date bugs stay in one module, and tests of date arithmetic need no timezone setup. Only the
  upgrade from timestamps depends on the user's timezone.
- Due times, like "at 3pm", need a change to this decision.
- Tasks saved before this decision are upgraded once, from timestamps to calendar days.

## Applies to

- [Date helpers](/src/lib/dates.ts), [the task store](/src/store/tasks.ts), and any feature with
  dates: recurring tasks, reminders, a calendar view

## Revisit when

The Temporal API is available in all supported browsers.
