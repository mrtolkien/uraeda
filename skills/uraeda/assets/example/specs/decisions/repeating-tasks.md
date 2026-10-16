---
status: active
approved-by: mrtolkien
icon: repeat
---

# Repeating tasks

A repeating task is a single task that carries its repeat rule. Completing it moves its due date to
the next occurrence instead of creating a new task: lists never grow, and the app keeps no history
of past completions. Repetition is about organizing what comes next, not about recording what was
done.

## Rules

- A repeating task MUST be a single task, with its repeat rule stored on it. Checked by the
  `RepeatRule` field of the `Task` type.
- Completing a repeating task MUST move its due date to the next occurrence, and MUST NOT create a
  new task. Checked by the completion tests of the task store.
- Features MUST NOT rely on a history of completed occurrences: there is none. Checked by review.

## Why

The human chose a single task whose date moves, "we're a todo app, not a calendar"
([Q2](../2026-10-06-recurring-tasks/clarifications-01.md#q2-when-does-the-next-occurrence-appear)),
with next dates counted from the previous due date
([Q3](../2026-10-06-recurring-tasks/clarifications-01.md#q3-which-date-does-the-next-due-date-count-from)).
See the [discovery](../2026-10-06-recurring-tasks/discovery-01.md#generating-occurrences).

## Alternatives considered

- A new task per completion: keeps a history, but the list grows, and repetition is about
  organization, not history.

## Consequences

- Lists stay short, and a repeating task is edited like any other task.
- No completion history or statistics on repeating tasks.
- Skipping one occurrence, or editing one apart from the others, needs a change to this decision.
- Features like reminders attach to the task, and move with its due date.

## Applies to

- [The task store](/src/store/tasks.ts), and any feature that reads due dates or completion:
  reminders, statistics, a calendar view
