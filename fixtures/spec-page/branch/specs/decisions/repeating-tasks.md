---
icon: repeat
---

# Repeating tasks

> "We're a todo app, not a calendar."

## Rules

- A repeating task is one task, which moves to its next date when it is completed. _So:_
  completing "Water the plants" never adds a second task.
- The app keeps no history of completed occurrences. _So:_ "skip this one" changes this decision
  first.

## Why

A list that grows with each completion buries what comes next, and a history would make the app a
calendar.

## Applies to

- [The task store](/src/store/tasks.ts), and any feature that reads due dates or completion
