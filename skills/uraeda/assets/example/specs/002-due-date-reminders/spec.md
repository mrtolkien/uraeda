---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Due date reminders

> [!IMPORTANT]
>
> Spec to review, about 15 minutes.
>
> - Changed decision: [due dates](../decisions/due-dates.md#proposed-change-002-due-date-reminders)
>   gets a reminder time of day, stored apart from the due date, so due dates and their arithmetic
>   do not change.
> - Your answer on which tasks get a reminder said "only tasks that get a due date after the
>   update". This spec reads it as: a task gets the default reminder when it goes from no due date
>   to a due date. Tasks saved before the update keep no reminder, even when their due date is moved
>   later. Say so if moving an old task's due date should turn its reminder on.
> - Reminders only show while the app is open, up to two minutes late in a background tab. Those
>   missed while it was closed are listed once, at the next opening, then gone.
> - There is no switch to turn every reminder off: only per task, and the browser's own setting.
> - Risk tier `medium`: one new field, an index, and a new store, added without converting saved
>   data. The plan is not reviewed by default.

Tasks with a due date remind users the day before, at 9:00, unless they change the day or the time,
or turn the reminder off. The app shows a notification while it is open, and lists the reminders it
missed while it was closed. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## User stories

### US1: Get reminded of a task with a due date (P1)

When a task gets a due date, it gets a reminder: the day before, at 9:00. At that time, if the app
is open and notifications are on, a notification shows the task's title. Clicking it opens the task.

Why this priority: it is the proposal's path, and the human chose reminders on by default
([Q2](clarifications-01.md#q2-which-tasks-get-a-reminder)).

Acceptance scenarios:

1. **Given** an open task without a due date, **When** the user sets its due date to Wednesday the
   7th, **Then** its reminder reads "The day before" at 9:00.
2. **Given** a task due Wednesday the 7th with that reminder, and the app open with notifications
   on, **When** it is Tuesday the 6th at 9:00, **Then** a notification shows the task's title and
   "Due tomorrow".
3. **Given** that notification, **When** the user clicks it, **Then** the app comes to the front
   with the task open.
4. **Given** a weekly task due Monday the 5th, reminded on the day at 8:00, **When** the user
   completes it, **Then** it is reminded on Monday the 12th at 8:00.

### US2: Change or turn off a reminder (P1)

In a task's edit panel, a reminder menu offers "The day before", "On the day", and "No reminder",
with a time next to it.

Why this priority: the proposal asks for a way to turn reminders off, and the human chose a day and
a time per task ([Q3](clarifications-01.md#q3-at-what-time-does-a-reminder-fire),
[Q4](clarifications-01.md#q4-on-which-day-does-a-reminder-fire)).

Acceptance scenarios:

1. **Given** an open task due Wednesday the 7th, **When** the user picks "On the day" and sets the
   time to 13:00, **Then** it is reminded on Wednesday the 7th at 13:00.
2. **Given** an open task with a reminder, **When** the user picks "No reminder", **Then** the time
   is disabled, and no notification shows for the task.
3. **Given** a task saved before the update, due on the 7th, **When** the user opens it, **Then**
   its reminder reads "No reminder".
4. **Given** an open task without a due date, **When** the user looks at the reminder menu, **Then**
   it is disabled, with "Add a due date first".

### US3: See the reminders missed while the app was closed (P2)

When the app opens, a list above the tasks shows the reminders whose time passed while it was
closed. Clicking a task in the list opens it; "Dismiss" closes the list.

Why this priority: without a server, this is how reminders reach users who close the app
([Q1](clarifications-01.md#q1-how-do-reminders-reach-users)).

Acceptance scenarios:

1. **Given** a task due Wednesday the 7th, reminded the day before at 9:00, and the app closed on
   Monday the 5th, **When** the user opens the app on Wednesday the 7th at 8:00, **Then** the list
   shows the task with "Due today".
2. **Given** that list, **When** the user reloads the app, **Then** the list does not show again.
3. **Given** that list, **When** the user clicks "Dismiss", **Then** the list closes.

### US4: Turn on notifications (P2)

Until the browser's permission is granted or refused, the edit panel of a task with a reminder shows
a "Turn on notifications" button, which asks the browser.

Why this priority: browsers only show notifications once allowed, and Firefox and Safari only ask
after a click ([discovery](discovery-01.md#notifications-on-the-web)).

Acceptance scenarios:

1. **Given** notifications neither allowed nor refused, **When** the user clicks "Turn on
   notifications", **Then** the browser asks for the permission, and the button goes once it is
   answered.
2. **Given** notifications refused, **When** a reminder's time comes with the app open, **Then** the
   task shows in the list of reminders, with "Due tomorrow" or "Due today".

## Edge cases

- Removing a task's due date removes its reminder. Setting a due date again gives the default
  reminder.
- Moving a due date, by hand or by undoing a completion, moves the reminder with it, at the same day
  and time.
- A done or deleted task is not reminded. Unchecking a task brings its reminder back, if its time
  has not passed.
- A reminder whose time is already past when it is set, like the day before at 9:00 for a task due
  today, does not show, and is not listed as missed.
- With two tabs open, each reminder shows once.
- A reminder time skipped by daylight saving, like 2:30 on the day clocks move forward, shows when
  the clocks reach the same time after the change, 3:30.
- Reminder times are the user's local time: a user who travels is reminded at 9:00 where they are.
- A task created with a repeat in its title ("Call mom every monday") gets a due date, and so the
  default reminder.

## Success criteria

- **SC-001**: While the app is open, a reminder shows within one minute of its time in a visible
  tab, and within two minutes in a background tab.
- **SC-002**: Each reminder shows at most once, across reloads and open tabs.
- **SC-003**: A reminder check reads only the tasks due on the days it covers, not every task.
- **SC-004**: Rendering a list of 5,000 tasks is not slower than before the feature.

## Design

### Approach

The open app checks for due reminders every minute, and when its tab comes back to the front: the
browser cannot schedule a notification ahead of time, and the app has no server
([discovery](discovery-01.md#showing-reminders)). A reminder is a day before the due date and a time
of day, stored on the task, so it moves with the due date, as the
[repeating tasks](../decisions/repeating-tasks.md) decision expects. The time is stored apart from
the due date, through a proposed change to the [due dates](../decisions/due-dates.md) decision. The
app remembers when it last checked, so reminders missed while it was closed are found once at the
next opening ([discovery](discovery-01.md#missed-reminders)).

### Data

- A task gets `reminder: Reminder | null`, where `Reminder` is
  `{ daysBefore: 0 | 1, time: LocalTime }`, and `LocalTime` is a local `HH:mm` string. `null` means
  no reminder.
- Setting a due date on a task without one sets `reminder` to `{ daysBefore: 1, time: "09:00" }`.
  Changing a due date keeps the reminder. Removing it sets `reminder` to `null`.
- A reminder's moment is `reminderMoment(dueDate, reminder)`: the time on the day `daysBefore` days
  before the due date, in the local timezone, as a timestamp. Only the date helpers compute it.
- A new `meta` store holds `remindersCheckedAt`, a timestamp: the end of the last check.
- Tasks get an index on `dueDate`.

Upgrade 3 adds `reminder: null` to every saved task, the `dueDate` index, and the `meta` store with
`remindersCheckedAt` set to the moment of the upgrade.

A check, in one database transaction: read `remindersCheckedAt`, read the tasks due from that day to
the day after now, through the index, keep those not done whose moment is after `remindersCheckedAt`
and up to now, and set `remindersCheckedAt` to now. A second tab checking at the same time waits for
the transaction, and finds nothing left. The app shows what the check returns: as notifications when
allowed, otherwise in the list of reminders. At opening, the reminders found are missed ones, and
always go to the list.

### Components

- **Date helpers** ([`src/lib/dates.ts`](/src/lib/dates.ts)): `LocalTime`, and
  `reminderMoment(dueDate, reminder)`, the only place where a due date meets a time.
- **Task store** ([`src/store/tasks.ts`](/src/store/tasks.ts)): the `reminder` field and its
  defaults when the due date changes, `setReminder(id, reminder)`, and `checkReminders(now)`, the
  check described in [Data](#data), which returns the tasks to remind.
- **Store upgrade 3** ([`src/store/upgrades.ts`](/src/store/upgrades.ts)): as described in
  [Data](#data).
- **Reminders** (`src/reminders/reminders.ts`, new): runs `checkReminders` when the app opens, every
  minute, and when the tab becomes visible, then hands the result to the notifier or the list.
  Depends on the store and the notifier.
- **Notifier** (`src/reminders/notifier.ts`, new): reads and asks for the notification permission,
  and shows a notification with the task's title, "Due tomorrow" or "Due today", and a tag made of
  the task's id and due date. Clicking it focuses the app and opens the task.
- **Reminder list** (`src/components/ReminderList.tsx`, new): above the task list, the reminders
  missed, or shown while notifications are refused, with a "Dismiss" button. It is part of the list
  screen: no new screen.
- **Edit panel** ([`EditPanel.tsx`](/src/components/EditPanel.tsx)): the reminder menu, built on the
  existing [`Select`](/src/components/Select.tsx), a time field, and the "Turn on notifications"
  button.

### Error handling

- The browser has no Notification API: reminders show in the list, and the "Turn on notifications"
  button does not show.
- Notifications refused, or turned off later in the browser: reminders show in the list.
- A check fails to read or write the database: it is logged, and the next check covers the same
  time, since `remindersCheckedAt` did not move.
- Saving a reminder fails: the panel keeps the previous one, and shows "Could not save".

### Testing

Integration tests render the app on an in-memory IndexedDB, with the clock and the timezone set by
the test, and a fake Notification API that records what is shown and answers the permission request
as the test says. Tests move the clock forward to reach a reminder's time.

| What                                                        | Test                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| US1 to US4, and the edge cases                              | One integration test per scenario                                          |
| Upgrade of version 2 data                                   | Integration test: the app opened on a database saved by version 2          |
| SC-001                                                      | Integration tests with the tab visible, and hidden for 5 minutes           |
| SC-002                                                      | Integration tests: a reload after a reminder, and two apps on one database |
| SC-003                                                      | Integration test counting the tasks the check reads, on 5,000 tasks        |
| `reminderMoment`, across days, daylight saving, and offsets | Table-driven test: one row per case                                        |
| SC-004                                                      | The existing [list benchmark](/bench/list.bench.ts), before and after      |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The edit panel asks for notifications with a "Turn on notifications" button.
- When notifications are refused, reminders show in the app's list of reminders.
- Missed reminders are those whose time passed since the app last checked: old overdue tasks never
  show, and a reminder never shows twice.
- The open app checks every minute, and when its tab comes back to the front.
- A reminder follows its task's due date, and removing the due date removes it.
- Done and deleted tasks are not reminded; unchecking a task brings its reminder back.
- There is no app-wide switch to turn reminders off.
- Two open tabs show each reminder once.

Settled while writing this spec:

- Tasks saved before the update have no reminder, and keep none when their due date moves. A task
  gets the default reminder only when it goes from no due date to a due date, including after its
  due date was removed.
- The reminder menu lists "The day before" first, as the default the human chose
  ([Q4](clarifications-01.md#q4-on-which-day-does-a-reminder-fire)).
- The time field is the browser's own time input, styled like the date input next to it.
- A missed reminder is listed once: the list is not kept after a reload or a dismissal.
- Notifications say "Due tomorrow" or "Due today", and nothing else.

## Decisions

Changed, applied when this spec is approved:

- [Due dates](../decisions/due-dates.md#proposed-change-002-due-date-reminders): a reminder time is
  a local `HH:mm` string stored apart from the due date, and only `src/lib/dates.ts` combines them.

Relied on:

- [Repeating tasks](../decisions/repeating-tasks.md): the reminder is stored on the task, and moves
  with its due date when it is completed.
- [Task storage](../decisions/task-storage.md): the `reminder` field, the index, and the `meta`
  store come with upgrade 3, tested on version 2 data.
- [UI components](../decisions/ui-components.md): the reminder menu uses `Select`, and the list of
  reminders is built in the project.

## Constitution check

| Principle                         | Complies | Notes                                                     |
| --------------------------------- | -------- | --------------------------------------------------------- |
| I. Simple for non-technical users | yes      | One menu and a time in the edit panel; no new screen      |
| II. Local first                   | yes      | No server: reminders are found and shown by the open app  |
| III. Fast with thousands of tasks | yes      | Checks read tasks by due date; SC-003 and SC-004 check it |

## Risk tier

**Medium**: it adds a field, an index, and a store to saved data, without converting any of it, and
asks for a browser permission.
