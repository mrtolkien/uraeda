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
- Completing a repeating task MUST move its due date to the next occurrence, in place of creating a
  new task. Checked by the completion tests of the task store.
- Features MUST NOT rely on a history of completed occurrences: there is none. Checked by review.

## Why

"We're a todo app, not a calendar": repetition organizes what comes next, and a list that grows with
each completion buries it. Counting the next date from the previous due date keeps a weekly task on
its weekday, however late it is completed. History:
[Recurring tasks](../done/2026-10-06-recurring-tasks.md).

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
