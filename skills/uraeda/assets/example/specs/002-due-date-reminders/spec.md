---
status: awaiting-human
risk-tier: medium
plan-review: false
---

# Spec: Due date reminders

> [!IMPORTANT]
>
> Spec to review, about 15 minutes.
>
> - Changed decision: [due dates](../decisions/due-dates.md#proposed-change-002-due-date-reminders)
>   gets a separate reminder time.
> - Reminders only show while the app is open, and late if the browser slows a background tab.
> - The app asks for the notification permission the first time a reminder is turned on.
> - Risk tier `medium`: no plan review unless you set `plan-review: true`.
>
> Set `status: approved` and commit: this also applies the new decisions and proposed changes below.
> You can change the risk tier, and set `plan-review: true` to review the plan. To request changes,
> set `status: changes-requested` and write your feedback in a `## Review` section at the end.

Users can turn on a reminder for a task with a due date. The app shows it at the chosen time, while
it is open, and lists the reminders missed while it was closed. See the [proposal](proposal.md),
[discovery](discovery.md), and [clarifications](clarifications.md).

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

## Success criteria

- **SC-001**: A notification appears within one minute of the reminder time, while the app is open.

## Design

### Approach

Reminders are checked by the open app, once a minute, with no server and no service worker: the
browser cannot schedule a notification ahead of time. Missed reminders are found when the app opens.
The reminder time is a separate field, through a proposed change to the
[due dates](../decisions/due-dates.md) decision. See the
[discovery](discovery.md#showing-reminders).

### Components

- **Reminder checker** (`src/reminders/checker.ts`, new): every minute and when the app opens, finds
  the reminders that are due, using an index on the reminder date. Depends on the task store and the
  date helpers.
- **Notifier** (`src/reminders/notifier.ts`, new): asks for the notification permission the first
  time a reminder is turned on, and shows a notification, or nothing if permission was refused.
- **Missed banner** (`src/components/MissedReminders.tsx`, new): lists the reminders that passed
  while the app was closed.
- **Task store and upgrade 3** ([`src/store/tasks.ts`](/src/store/tasks.ts),
  [`src/store/upgrades.ts`](/src/store/upgrades.ts)): the reminder field, and its index.
- **Edit panel** ([`EditPanel.tsx`](/src/components/EditPanel.tsx)): the "Remind me" toggle and
  time.

### Data

A task gets `reminder: { time: "HH:mm", shown: boolean } | null`. The checker combines `dueDate` and
`time` with the date helpers, shows the due ones through the notifier or the banner, and marks them
`shown`. Completing a repeating task copies the reminder time to the next occurrence.

### Error handling

- Notification permission refused: reminders only appear in the banner, and the edit panel says so.
- The tab is in the background and the browser slows its timers: the reminder shows late, at the
  next check.

### Testing

- Checker: unit tests with a fake clock, for US2 and US3, without a browser.
- Notifier: tests with a mocked Notification API, for granted and refused permission.
- Edit panel and banner: component tests for US1 and US3.

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
