---
status: active
approved-by: mrtolkien
---

# Due dates

Due dates are calendar days, like `2026-10-12`, without a time or a timezone. A task due Monday
stays due Monday wherever the user is, and adding a week never lands on Sunday because of daylight
saving time.

## Rules

- Due dates MUST be stored as `YYYY-MM-DD` strings.
- Date arithmetic MUST go through `src/lib/dates.ts`.
- Code MUST NOT convert a due date to a `Date` timestamp, except to display it.

## Why

Recurring tasks add date arithmetic, and reminders will add more. Due dates were timestamps at local
midnight: adding 7 days across a daylight saving change gave 23:00 the day before, so weekly tasks
drifted. See [Q4](../001-recurring-tasks/clarifications.md#q4-how-should-the-app-store-due-dates)
and the [discovery](../001-recurring-tasks/discovery.md#date-handling).

## Alternatives considered

- UTC timestamps: exact instants, but a task due Monday shows as due Sunday for users west of UTC.
- The Temporal API: the right model, but not available in all supported browsers yet.

## Consequences

- Date bugs stay in one module, and tests need no timezone setup.
- Due times, like "at 3pm", need a change to this decision.
- Tasks saved before this decision were upgraded once, from timestamps to calendar days.

## Applies to

- [Date helpers](/src/lib/dates.ts), [the task store](/src/store/tasks.ts), and any feature with
  dates: recurring tasks, reminders, a calendar view

## Revisit when

The Temporal API is available in all supported browsers.

## Proposed change (002-due-date-reminders)

Proposed by the [due date reminders spec](../002-due-date-reminders/spec.md). Reminders need a time
of day, which this decision does not cover. Due dates stay calendar days: the time is a separate
field, so existing tasks and date arithmetic do not change.

New rules:

- A reminder time MUST be stored separately from the due date, as a local `HH:mm` string.
- Code MUST combine a due date and a reminder time only in `src/lib/dates.ts`.

The consequence "Due times need a change to this decision" becomes: "A due time feature would reuse
the reminder time field."
