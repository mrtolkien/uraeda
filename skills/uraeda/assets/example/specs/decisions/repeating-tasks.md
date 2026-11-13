---
icon: repeat
---

# Repeating tasks

> "We're a todo app, not a calendar."

Repetition organizes what comes next. It does not record what was done.

## Rules

- A repeating task is one task, which moves to its next date when it is completed. _So:_ completing
  "Water the plants" never adds a second task to the list.
- The app keeps no history of completed occurrences. _So:_ a statistics view, or "skip this one",
  changes this decision first.

## Why

A list that grows with each completion buries what comes next, and a history would make the app a
calendar. History: [Recurring tasks](../done/2026-10-06-recurring-tasks.md).

## Alternatives considered

- A new task per completion: keeps a history, but the list grows with every completion.

## Applies to

- [The store](/src/store/), and any feature that reads due dates or completion: reminders,
  statistics, a calendar view
