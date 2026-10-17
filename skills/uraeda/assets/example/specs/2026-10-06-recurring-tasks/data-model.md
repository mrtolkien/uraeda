# Data model: Recurring tasks

The stored data that [the spec](spec.md) adds or changes: each task's due date and repeat rule, in
the browser's IndexedDB.

## Task

| Field     | Type                         | Meaning                          | Change  |
| --------- | ---------------------------- | -------------------------------- | ------- |
| `title`   | text                         | what the task is                 |         |
| `dueDate` | `YYYY-MM-DD` string, or null | the calendar day it is due       | Changed |
| `repeat`  | repeat rule, or null         | how it comes back once completed | New     |

Setting a repeat on a task without a due date sets it to today. Setting a weekly rule then moves the
due date to the first chosen day on or after it.

## Repeat rule

| Field      | Type                                   | Meaning                                      | Change |
| ---------- | -------------------------------------- | -------------------------------------------- | ------ |
| `unit`     | `"day"`, `"week"`, `"month"`, `"year"` | what the interval counts                     | New    |
| `interval` | whole number, at least 1               | every N units                                | New    |
| `weekdays` | days of the week, 0 for Sunday         | the chosen days, always set for weekly rules | New    |
| `from`     | `YYYY-MM-DD` string                    | the date the schedule counts from            | New    |

- "Weekly" is every week on the due date's day, "weekdays" every week on Monday to Friday,
  "weekends" every week on Saturday and Sunday.
- `from` is the due date when the repeat is set, or when the user moves the due date by hand. The
  rule's dates are counted from it: every N days, every N months on its day of the month, or the
  chosen days of every Nth week from its week. A task due on the 31st stays on the 31st after a
  shorter month.
- The next due date is the first date of the rule after the previous due date, skipping dates
  already past.
