---
status: awaiting-human
risk-tier: medium
plan-review: false
---

# Spec: Due date reminders

Users can turn on a reminder for a task with a due date. The app shows it at the chosen time, while
it is open, and lists the reminders missed while it was closed. See the [proposal](proposal.md) and
[clarifications](clarifications.md).

To approve this spec, set `status: approved` and commit: this also applies the new decisions and
proposed changes below. You can change the risk tier, and set `plan-review: true` to review the
plan. To request changes, set `status: changes-requested` and write your feedback in a `## Review`
section at the end.

## User stories

### US1: Set a reminder (P1)

In a task's edit panel, the user turns on "Remind me", and can change the time, 9:00 by default.

Why this priority: without it, nothing else in this feature works.

Acceptance scenarios:

1. **Given** a task due on the 12th, **When** the user turns on "Remind me", **Then** a reminder is
   set for the 12th at 9:00
2. **Given** a task without a due date, **When** the user opens the edit panel, **Then** "Remind me"
   is disabled, with the hint "Add a due date first"

### US2: Get a reminder (P1)

When the reminder time comes and the app is open, the user sees a notification with the task's
title. Clicking it opens the task.

Why this priority: this is what the user asked for.

Acceptance scenarios:

1. **Given** a reminder for today at 14:00 and the app open, **When** it is 14:00, **Then** a
   notification shows the task's title

### US3: See missed reminders (P2)

When the user opens the app after a reminder time passed, a banner lists the missed reminders.

Why this priority: reminders still help when the app was closed, but less.

Acceptance scenarios:

1. **Given** a reminder for yesterday at 9:00, **When** the user opens the app today, **Then** a
   banner lists the task

## Edge cases

- The user refuses notifications: reminders appear as the banner only.
- A repeating task: each new occurrence keeps the reminder time.
- A completed task: its reminder is cancelled.

## Requirements

- **FR-001**: A task with a due date MUST be able to have one reminder, at a time of day.
- **FR-002**: Reminders MUST NOT require a server.

## Success criteria

- **SC-001**: A notification appears within one minute of the reminder time, while the app is open.

## Assumptions

- Reminders use the browser's notifications, asked for the first time a reminder is turned on.
- There is one reminder per task: "the day before" is a later feature.

## Decisions

- [Due dates](../decisions/due-dates.md): changed, to add a reminder time
- [Task storage](../decisions/task-storage.md)
- [UI components](../decisions/ui-components.md)

## Constitution check

| Principle or decision             | Complies | Notes                                         |
| --------------------------------- | -------- | --------------------------------------------- |
| I. Simple for non-technical users | yes      | One toggle and a time in the edit panel       |
| II. Local first                   | yes      | No server: Q1                                 |
| III. Fast with thousands of tasks | yes      | Reminders are checked once a minute, by index |
| Due dates (changed)               | yes      | The reminder time is a separate field         |
| Task storage                      | yes      | One new field, with a store upgrade           |
| UI components                     | yes      | Time input built in the project               |

## Risk tier

**Medium**: adds a field to stored tasks, and asks for a browser permission.
