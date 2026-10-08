---
status: approved
risk-tier: medium
plan-review: false
---

# Spec: Recurring tasks

Users can make a task repeat daily, weekly, or monthly. When they complete it, the next occurrence
appears in their list. See the [proposal](proposal.md) and [clarifications](clarifications.md).

To approve this spec, set `status: approved` and commit: this also activates the proposed decisions
below. You can change the risk tier, and set `plan-review: true` to review the plan. To request
changes, set `status: changes-requested` and write your feedback in a `## Review` section at the
end.

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

## Requirements

- **FR-001**: A task MUST have a repeat setting: never, daily, weekly, or monthly. Default: never.
- **FR-002**: Completing a repeating task MUST create its next occurrence, with the same title and
  repeat setting.
- **FR-003**: The next due date MUST follow the previous due date, skipping dates already past.

## Success criteria

- **SC-001**: Setting a task to repeat takes at most two taps from the task list.
- **SC-002**: Rendering a list of 5,000 tasks is not slower than before the feature.

## Assumptions

- The repeat setting lives in the existing edit panel: no new screen.
- Completed occurrences stay in the list like any completed task.

## Decisions

- [0003. Recurring tasks use presets](../decisions/0003-recurring-tasks-use-presets.md)
- [0004. The next occurrence is created when a task is completed](../decisions/0004-next-occurrence-on-completion.md)
- [0001. Tasks are stored in IndexedDB](../decisions/0001-local-storage.md)

## Constitution check

| Principle or decision               | Complies | Notes                                        |
| ----------------------------------- | -------- | -------------------------------------------- |
| I. Simple for non-technical users   | yes      | One dropdown in the existing edit panel      |
| II. Local first                     | yes      | Nothing leaves the device                    |
| III. Fast with thousands of tasks   | yes      | SC-002 checks it with the existing benchmark |
| 0001. Tasks are stored in IndexedDB | yes      | One new field on the task                    |

## Risk tier

**Medium**: adds a field to stored tasks, with a small UI change.
