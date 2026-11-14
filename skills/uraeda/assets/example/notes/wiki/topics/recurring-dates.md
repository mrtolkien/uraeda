---
description: Recurring tasks and events across products: what users expect, and where products differ
checked: 2026-10-07
sources:
  - https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do
  - https://support.google.com/calendar/answer/37115
  - https://support.google.com/calendar/answer/37113
---

# Recurring dates

How products repeat a task or an event. Five parts: how users pick a repeat, when the next
occurrence appears, which date it counts from, whether one occurrence can differ, and when the
repetition ends.

## What users expect

- Picking a repeat: presets, custom intervals ("every 2 weeks"), or typed rules.
- The next date counted from the due date or from completion, and a rule for overdue tasks.
- Editing or skipping one occurrence without changing the others, and changing the whole series.
- Ending the repetition: never, on a date, or after a number of occurrences.

## How products differ

| Product         | Picking a repeat                   | One occurrence                       |
| --------------- | ---------------------------------- | ------------------------------------ |
| Microsoft To Do | presets, and a custom option       | not described in its help            |
| [[todoist]]     | a rule typed in the due date field | rescheduled alone                    |
| Google Calendar | a menu, and a custom screen        | this one, this and following, or all |

Sources:
[Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do),
[Google Calendar help](https://support.google.com/calendar/answer/37115), and
[on editing one](https://support.google.com/calendar/answer/37113). Calendars store one occurrence
that differs as an exception to the rule: see [[rfc-5545-recurrence]].

## Related

- Used by [[2026-10-06-recurring-tasks-01]].
