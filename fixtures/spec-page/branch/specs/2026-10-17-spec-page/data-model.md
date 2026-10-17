# Data model: Recurring tasks

Entities that the feature adds or changes.

## Task

| Field     | Type                       | Meaning                                    | Change  |
| --------- | -------------------------- | ------------------------------------------ | ------- |
| `title`   | text                       | what the task is                           |         |
| `dueDate` | calendar day, or none      | the day it is due, `2026-10-12`            | Changed |
| `repeat`  | repeat rule, or none       | how it comes back once completed           | New     |

## Repeat rule

| Field      | Type                         | Meaning                                  | Change |
| ---------- | ---------------------------- | ---------------------------------------- | ------ |
| `unit`     | day, week, month, or year    | what the interval counts                 | New    |
| `interval` | whole number, at least 1     | every N units                            | New    |
| `weekdays` | days of the week, or none    | the chosen days, for weekly rules        | New    |
| `from`     | calendar day                 | the date the schedule counts from        | New    |
