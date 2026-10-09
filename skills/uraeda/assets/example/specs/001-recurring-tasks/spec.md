---
status: approved
risk-tier: medium
plan-review: false
---

# Spec: Recurring tasks

> [!IMPORTANT]
>
> Spec to review, about 15 minutes.
>
> - New decision: [due dates](../decisions/due-dates.md) become calendar days, for every future
>   feature with dates.
> - Every saved due date is converted once, when users get the new version. A task whose date cannot
>   be read keeps it, and nothing is deleted.
> - Completing a repeating task creates a new task: completed occurrences stay in the list.
> - Risk tier `medium`: no plan review unless you set `plan-review: true`.
>
> Set `status: approved` and commit: this also applies the new decisions and proposed changes below.
> You can change the risk tier, and set `plan-review: true` to review the plan. To request changes,
> set `status: changes-requested` and write your feedback in a `## Review` section at the end.

Users can make a task repeat daily, weekly, or monthly. When they complete it, the next occurrence
appears in their list. See the [proposal](proposal.md), [discovery](discovery.md), and
[clarifications](clarifications.md).

## User stories

### US1: Make a task repeat (P1)

In a task's edit panel, the user picks "Repeats: never, daily, weekly, monthly". Repeating tasks
show a small repeat icon in the list.

Why this priority: without it, nothing else in this feature works.

Acceptance scenarios:

1. **Given** a task, **When** the user sets it to repeat weekly, **Then** the task shows the repeat
   icon
2. **Given** a repeating task, **When** the user sets it to never repeat, **Then** the icon
   disappears

### US2: Complete a repeating task (P1)

When the user completes a repeating task, it is marked done as usual, and its next occurrence
appears in the list.

Why this priority: this is what saves users from recreating tasks.

Acceptance scenarios:

1. **Given** a weekly task due Monday the 5th, **When** the user completes it on Monday the 5th,
   **Then** a new task with the same title is due Monday the 12th
2. **Given** a weekly task due Monday the 5th, **When** the user completes it on Thursday the 8th,
   **Then** the next task is due Monday the 12th
3. **Given** a weekly task due Monday the 5th, **When** the user completes it on Wednesday the 14th,
   **Then** the next task is due Monday the 19th

## Edge cases

- A repeating task without a due date: the next occurrence is due one period after the day it was
  completed.
- A monthly task due on the 31st: in shorter months, it is due on the last day of the month.
- Undoing the completion of a repeating task removes the occurrence it created, if it is untouched.

## Success criteria

- **SC-001**: Setting a task to repeat takes at most two taps from the task list.
- **SC-002**: Rendering a list of 5,000 tasks is not slower than before the feature.

## Design

### Approach

A repeating task stays a normal task with one more field. Completing it creates the next occurrence
as a new task, in the same database transaction, so a reload can never show one without the other.
Due dates become calendar days, following the new [due dates](../decisions/due-dates.md) decision,
so the next date is computed without timezone bugs. See the
[discovery](discovery.md#generating-occurrences).

### Components

- **Date helpers** ([`src/lib/dates.ts`](/src/lib/dates.ts), new): calendar day arithmetic and
  `nextDueDate(dueDate, repeat, today)`. Pure functions on `YYYY-MM-DD` strings, built on date-fns.
  Used by the store, depends on nothing else in the app.
- **Task store** ([`src/store/tasks.ts`](/src/store/tasks.ts)): `completeTask` creates the next
  occurrence when the task repeats, and `uncompleteTask` removes it if it was not edited. Depends on
  the date helpers.
- **Store upgrade 2** ([`src/store/upgrades.ts`](/src/store/upgrades.ts)): converts saved due dates
  to calendar days, and adds `repeat: "never"` to saved tasks.
- **Edit panel and task row** ([`EditPanel.tsx`](/src/components/EditPanel.tsx),
  [`TaskRow.tsx`](/src/components/TaskRow.tsx)): the repeat menu, built on the existing
  [`Select`](/src/components/Select.tsx), and the repeat icon.

### Data

A task gets `repeat: "never" | "daily" | "weekly" | "monthly"`, and `createdFrom`, the id of the
occurrence that created it, so undo can find it. `dueDate` becomes a `YYYY-MM-DD` string.

Completing a repeating task: the edit panel or task row calls `completeTask`, which marks the task
done, computes the next due date with `nextDueDate`, and saves the new task, in one transaction.

### Error handling

- The upgrade fails on a saved task it cannot read: the task keeps its old due date, the upgrade
  continues, and the error is logged. No task is ever deleted by the upgrade.
- Saving the next occurrence fails: the whole transaction is cancelled, and the task stays not done,
  with the app's usual "Could not save" message.

### Testing

- Date helpers: unit tests for every acceptance scenario of US2 and the month-end edge case, without
  a database.
- Store: tests on an in-memory IndexedDB, for completion, undo, and the upgrade of version 1 data.
- Edit panel and task row: component tests for US1.
- SC-002: the existing [list benchmark](/bench/list.bench.ts), before and after.

## Assumptions

- The repeat setting lives in the existing edit panel: no new screen.
- Completed occurrences stay in the list like any completed task.

## Decisions

- [Due dates](../decisions/due-dates.md): new
- [Task storage](../decisions/task-storage.md)
- [UI components](../decisions/ui-components.md)

## Constitution check

| Principle or decision             | Complies | Notes                                        |
| --------------------------------- | -------- | -------------------------------------------- |
| I. Simple for non-technical users | yes      | One dropdown in the existing edit panel      |
| II. Local first                   | yes      | Nothing leaves the device                    |
| III. Fast with thousands of tasks | yes      | SC-002 checks it with the existing benchmark |
| Due dates (new)                   | yes      | Next due dates are computed on calendar days |
| Task storage                      | yes      | One new field, and an upgrade of due dates   |
| UI components                     | yes      | The repeat dropdown is a project component   |

## Risk tier

**Medium**: adds a field and upgrades stored due dates, with a small UI change.
