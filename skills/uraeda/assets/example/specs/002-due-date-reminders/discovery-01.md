# Discovery, round 01: Due date reminders

## Summary

In established todo apps, a reminder is set apart from the due date: the due date is a day, and the
reminder a moment, with a date and a time. Apps differ on defaults: Todoist reminds automatically
before a task's time, Microsoft To Do only when asked, and Google Tasks through Google Calendar.

A web app can only show a notification while one of its pages or service workers runs. Without a
push server, reminders can only appear on time while the app is open, with one partial exception in
Chromium browsers. The [proposal](proposal.md) asks for reminders on the day or the day before,
without a server, and a way to turn them off. The app stores due dates as calendar days without a
time ([due dates](../decisions/due-dates.md)), and registers no service worker.

## How other products do it

### Microsoft To Do

- The due date is a day: today, tomorrow, next week, or a date. The reminder is set separately, with
  "Remind me": later today, tomorrow, next week, or a date and time
  ([Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do)).

### Todoist

- When a task gets a date and a time, Todoist adds a reminder automatically, 30 minutes before by
  default. Users change the delay, or choose "No default reminder", in their settings. Reminders
  need a time: a task with only a date gets none
  ([Todoist help](https://www.todoist.com/help/articles/introduction-to-reminders-9PezfU)).
- Extra reminders, at other moments, are a paid feature (same source).

### Google Tasks

- Google Tasks sends no notification itself: Google Calendar notifies for tasks with a date and a
  time ([third-party guide](https://tasksboard.com/blog/google-tasks-notifications-not-working),
  since Google's help does not describe it).
- Tasks with only a date used to default to 9:00 local time
  ([9to5Google, 2019](https://9to5google.com/2019/03/18/google-tasks-notifications-update/)).

### What they have in common

- A reminder has a time of day, separate from the due date, which has none.
- Users can turn reminders off: per task, or with a default in the settings.
- A task with only a date gets no reminder, or one at a default time.
- Quick choices ("later today", "tomorrow") come before a date and time picker.

## Standards and libraries

### Notifications on the web

- The Notification API shows notifications from a page or a service worker, after the user grants
  permission ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)). Without a
  push server, something of the app must be running at the reminder time.
- Notification Triggers, which would schedule a notification ahead of time, finished its origin
  trial in Chrome but never launched
  ([Chrome for Developers](https://developer.chrome.com/docs/web-platform/notification-triggers)).

### Periodic background sync

- An installed web app can ask the browser to wake its service worker regularly, with a minimum
  interval, after the user grants a permission
  ([web.dev](https://web.dev/articles/web-apps/periodic-background-sync)). It is only available in
  Chromium browsers, and is still experimental
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API)).
- The app sets a minimum, not a schedule: a reminder at a precise time cannot rely on it.

### iPhone and iPad

- Web apps can only receive push notifications once added to the home screen, and can only ask for
  the permission after a user action, like a tap
  ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

## The code

### Important reads

- [Due dates decision](../decisions/due-dates.md): due dates are calendar days, without a time.
- [Task storage decision](../decisions/task-storage.md): data stays on the device, and every stored
  change comes with an upgrade.
- [Task store](/src/store/tasks.ts) and [store upgrades](/src/store/upgrades.ts): at version 2,
  after recurring tasks.
- [Date helpers](/src/lib/dates.ts): calendar day arithmetic, and `nextDueDate` for repeating tasks.
- [App entry point](/src/main.ts): no service worker is registered, and the app has no web app
  manifest, so it cannot be installed.

### The proposal's path and existing actions

- **Turning a reminder on**: the edit panel has no notion of time today. The first reminder is the
  natural moment to ask for the notification permission.
- **A task without a due date**: due dates are optional, so a reminder has no day to attach to.
- **Completing a task**: its reminder should not fire anymore. With
  [recurring tasks](../001-recurring-tasks/spec.md), the next occurrence may need its own.
- **Changing the due date**: the reminder moves with it, or stays at its own date.
- **Deleting a task**: its reminder must go too.

### Likely changes

- [`src/store/tasks.ts`](/src/store/tasks.ts) and [`src/store/upgrades.ts`](/src/store/upgrades.ts):
  a reminder field and an upgrade to version 3, under every option
- [`src/lib/dates.ts`](/src/lib/dates.ts): combining a due date and a time of day, with option A of
  [reminder time](#reminder-time)
- `src/reminders/`, new: checking due reminders and showing notifications, under every option of
  [showing reminders](#showing-reminders); a service worker with option B, and a missed banner with
  option A
- [`src/components/EditPanel.tsx`](/src/components/EditPanel.tsx): the reminder setting, under every
  option

## The proposal

### On the day or the day before

The proposal says "the day before or on the day": one of the two, or a choice for the user.

### Turning reminders off

The proposal asks to turn reminders off, without saying whether per task or for the whole app.

## Approaches

Criteria come from the [proposal](proposal.md) (no server), the [constitution](../CONSTITUTION.md)
(local first; simple for non-technical users), and the decisions on
[due dates](../decisions/due-dates.md) and [task storage](../decisions/task-storage.md).

### Showing reminders

How a reminder reaches the user. See [notifications on the web](#notifications-on-the-web),
[periodic background sync](#periodic-background-sync), and [iPhone and iPad](#iphone-and-ipad).

| Option                              | Local first                | On time with the app closed          | Effort                              |
| ----------------------------------- | -------------------------- | ------------------------------------ | ----------------------------------- |
| A. While open, missed banner        | Yes                        | No, shown on next open               | Small                               |
| B. A, plus periodic background sync | Yes                        | Sometimes, in Chromium, if installed | Medium: manifest and service worker |
| C. Push server                      | No: data leaves the device | Yes                                  | Large: server and accounts          |

### Reminder time

When in the day a reminder fires, since due dates have no time. See
[what they have in common](#what-they-have-in-common).

| Option             | Useful reminders                | Change to stored data                  |
| ------------------ | ------------------------------- | -------------------------------------- |
| A. Time per task   | "Call the dentist at 2pm"       | A new field, and a change to due dates |
| B. One global time | Every reminder at the same time | None                                   |

### Day of the reminder

Which day a reminder fires. See [on the day or the day before](#on-the-day-or-the-day-before).

| Option                | Simple for users | Covers needs             |
| --------------------- | ---------------- | ------------------------ |
| A. On the due date    | Nothing to set   | No warning ahead of time |
| B. The day before     | Nothing to set   | Misses same-day tasks    |
| C. The user picks one | One more setting | Both                     |

### Turning reminders off

How users stop reminders. See [turning reminders off](#turning-reminders-off).

| Option             | Simple for users           | Covers needs              |
| ------------------ | -------------------------- | ------------------------- |
| A. Per task        | A toggle in the edit panel | Not "no reminders at all" |
| B. One app setting | One switch                 | Not "only for this task"  |
| C. Both            | Two places to look         | Both, like Todoist        |

### Needs no choice

- When to ask for the notification permission: on the first reminder turned on. Asking on a user
  action is required on iPhone, and asking on page load is what browsers discourage. See
  [iPhone and iPad](#iphone-and-ipad).

## Not checked

- How often Chromium actually wakes a service worker with periodic background sync: neither web.dev
  nor MDN gives numbers.
- Google's own documentation on Google Tasks notifications: its help pages do not describe them.
- How reminders behave in a web app added to the home screen on iPhone without a push server: no
  source covers it.
