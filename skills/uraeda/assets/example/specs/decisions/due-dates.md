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
- Code MUST NOT convert a due date to a `Date`, except inside `src/lib/dates.ts` and to display it.

## Why

Recurring tasks add date arithmetic, and reminders will add more. Due dates were timestamps at local
midnight: adding 7 days across a daylight saving change gave 23:00 the day before, so weekly tasks
drifted. See [Q4](../001-recurring-tasks/clarifications-01.md#q4-how-should-the-app-store-due-dates)
and the [discovery](../001-recurring-tasks/discovery-01.md#date-handling).

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

## Proposed change (002-due-date-reminders)

Proposed by the [due date reminders spec](../002-due-date-reminders/spec.md). Reminders need a time
of day, which this decision does not cover. Due dates stay calendar days: a reminder time is a
separate local time of day, so saved due dates and their arithmetic do not change.

The rules become:

- Due dates MUST be stored as `YYYY-MM-DD` strings.
- Times of day, like a reminder time, MUST be stored apart from the due date, as local `HH:mm`
  strings, without a timezone.
- Date arithmetic, and combining a due date with a time of day, MUST go through `src/lib/dates.ts`.
- Code MUST NOT convert a due date or a time of day to a `Date`, except inside `src/lib/dates.ts`
  and to display it.

Why: the human chose a reminder time per task
([Q3](../002-due-date-reminders/clarifications-01.md#q3-at-what-time-does-a-reminder-fire)). A local
time follows the user: 9:00 stays 9:00 when they travel, as a calendar day stays Monday. See the
[discovery](../002-due-date-reminders/discovery-01.md#reminder-time).

In **Consequences**, due times no longer need a change to this decision: a due time would be a time
of day stored apart from the due date, like reminder times.
