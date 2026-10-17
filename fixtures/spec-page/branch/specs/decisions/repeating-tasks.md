---
status: proposed
approved-by:
icon: repeat
---

# Repeating tasks

A repeating task is a single task that carries its repeat rule. Completing it moves its due date to
the next occurrence instead of creating a new task: lists never grow, and the app keeps no history
of past completions.

## Rules

- A repeating task MUST be a single task, with its repeat rule stored on it. Checked by the
  `RepeatRule` field of the `Task` type.
- Completing a repeating task MUST move its due date to the next occurrence, and MUST NOT create a
  new task. Checked by the completion tests of the task store.
- Features MUST NOT rely on a history of completed occurrences: there is none. Checked by review.

## Why

You chose a single task whose date moves: "we're a todo app, not a calendar".

## Consequences

- Lists stay short, and a repeating task is edited like any other task.
- Skipping one occurrence, or editing one apart from the others, needs a change to this decision.

## Applies to

- [The task store](/src/store/tasks.ts), and any feature that reads due dates or completion
