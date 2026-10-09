# Discovery, round 01: Due date reminders

## Summary

Reminders in established todo apps have four parts: when a reminder fires, which tasks get one, how
users turn it off, and how it reaches them. In every product reviewed, a reminder is a moment, with
a day and a time, while the due date is a day. Products differ on defaults: Todoist adds a reminder
to every task with a date and a time, Microsoft To Do only when the user asks, and Google Tasks
gives tasks with only a date a default time of 9:00.

A web page can show a notification only while it, or one of its service workers, is running. Without
a push server, reminders arrive on time only while the app is open. The [proposal](proposal.md) asks
for reminders "the day before or on the day", without a server, with a way to turn them off. The app
has the pieces for days, but none for times: due dates are calendar days
([due dates](../decisions/due-dates.md)), the app registers no service worker, and the store cannot
find tasks by due date without reading them all.

## How other products do it

### Microsoft To Do

- The due date and the reminder are two separate menus: **Add due date**, and **Remind me**, with
  "later today", "tomorrow", "next week", or a date and time
  ([Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do)).
- A task gets a reminder only when the user sets one (same source).

### Todoist

- An automatic reminder is added whenever a task gets a date and a time, a delay before the task's
  time that users set in their settings, or turn off with "No automatic reminder". A task with only
  a date gets no automatic reminder
  ([Todoist help](https://www.todoist.com/help/articles/introduction-to-reminders-9PezfU)).
- Custom reminders are set at a date and time, or a delay before the task is due. More than one
  custom reminder per task is a paid feature (same source).
- Snoozing a reminder is only available in the mobile apps, not on the web or desktop (same source).

### Google Tasks

- Google Tasks sends no notification itself: Google Calendar notifies for tasks with a date and a
  time ([third-party guide](https://tasksboard.com/blog/google-tasks-notifications-not-working),
  since Google's help does not describe it).
- Tasks with only a date default to 9:00 local time
  ([9to5Google, 2019](https://9to5google.com/2019/03/18/google-tasks-notifications-update/)).

### What they have in common

Capabilities users of these products may expect, whether or not the proposal mentions them:

- A reminder has a time of day, separate from the due date
- Turning a reminder off for one task, and choosing whether tasks get one by default
- A default time for tasks with only a date, or no reminder for them
- Quick choices ("later today", "tomorrow") before a date and time picker
- Snoozing a reminder, in mobile apps

## Standards and libraries

### Notifications on the web

- The Notification API shows notifications from a page or a service worker, after the user grants
  permission ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)).
- Firefox, since version 72, and Safari only ask for the permission in response to a user action,
  like a click: a request on page load shows no dialog
  ([MDN guide](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API),
  [Mozilla Hacks](https://hacks.mozilla.org/2019/11/upcoming-notification-permission-changes-in-firefox-72/)).
- A notification with the same `tag` as one already shown closes it and takes its place
  ([MDN guide](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)).
- Buttons on a notification, like "Snooze", need a service worker: the `actions` option throws an
  error on a notification created by a page
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification)).
- Notification Triggers, which would have scheduled a notification ahead of time, has ended its
  development and never launched
  ([Chrome for Developers](https://developer.chrome.com/docs/web-platform/notification-triggers)).

### Timers in background tabs

- Chrome runs the timers of a hidden page once per second, and once per minute after the page has
  been hidden and silent for 5 minutes. Visible pages are not throttled
  ([Chrome for Developers](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)).
- Judgement: a check every minute in a background tab can run up to a minute late, so a reminder can
  show up to two minutes after its time.

### Periodic background sync

- An installed web app can register a sync with a minimum interval, after the user grants a
  permission ([web.dev](https://web.dev/articles/web-apps/periodic-background-sync)). It is only
  available in Chromium browsers, and is still experimental
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API)).
- The app sets a minimum interval, not a schedule: a reminder at a precise time cannot rely on it.

### iPhone and iPad

- Web apps can only receive push notifications once added to the home screen, and can only ask for
  the permission after a user action, like a tap
  ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

## The code

### Important reads

- [Due dates decision](../decisions/due-dates.md): due dates are calendar days without a time, and
  only [`src/lib/dates.ts`](/src/lib/dates.ts) turns them into `Date` values. The decision says due
  times "need a change to this decision".
- [Repeating tasks decision](../decisions/repeating-tasks.md): a repeating task is one task whose
  due date moves on completion, and "features like reminders attach to the task, and move with its
  due date".
- [Task storage decision](../decisions/task-storage.md): data stays in IndexedDB, through
  `src/store/`, and every stored change comes with an upgrade.
- [Task store](/src/store/tasks.ts): tasks are `{ id, title, done, dueDate, repeat }`, with
  `dueDate` a `CalendarDay` or `null`. `completeTask` moves a repeating task's due date, and
  `restoreDueDate` puts it back for undo.
- [Database](/src/store/db.ts) and [upgrades](/src/store/upgrades.ts): the database is at version 2,
  with one object store, `tasks`, indexed by id only. Finding the tasks due on a day reads every
  task.
- [Date helpers](/src/lib/dates.ts): `today()`, `addDays`, and the other calendar-day functions.
  Nothing handles a time of day.
- [Edit panel](/src/components/EditPanel.tsx): title, due date, and the repeat menu, built on
  [`Select`](/src/components/Select.tsx).
- [App entry point](/src/main.ts): no service worker and no web app manifest, so the app cannot be
  installed. It only runs while a tab is open.
- [Test helpers](/tests/helpers/app.tsx): `renderApp` runs the app on an in-memory database, with
  the clock and timezone set by the test. Nothing fakes the Notification API.

### The proposal's path and existing actions

- **Getting a reminder**, as the proposal describes it: the app shows a browser notification on the
  due date or the day before. With the app closed, nothing runs, so nothing shows.
- **Setting a due date**: today, nothing else happens. Whether a reminder is added then depends on
  [which tasks get a reminder](#which-tasks-get-a-reminder).
- **Changing a due date**, by hand or by completing a repeating task: a reminder tied to the due
  date moves with it, as the repeating tasks decision expects. Undoing a completion restores the due
  date, and so the reminder.
- **Removing a due date**: the reminder has no day left.
- **Typing a repeat in a title** ("every monday") can set the due date to today: a reminder at 9:00
  today is already past after 9:00.
- **Completing a task**: a done task needs no reminder. **Unchecking** it brings the reminder back,
  if its time has not passed.
- **Deleting a task**: its reminder goes with it.
- **Two tabs open**: each would check reminders, and show each one twice.
- **Tasks saved before the feature**: thousands of them can have a past due date. A reminder check
  that looks at every past reminder would show them all at once.

### Likely changes

- [`src/store/tasks.ts`](/src/store/tasks.ts), [`src/store/db.ts`](/src/store/db.ts), and
  [`src/store/upgrades.ts`](/src/store/upgrades.ts): a reminder field, an index on due dates, and
  upgrade 3, under every option
- [`src/lib/dates.ts`](/src/lib/dates.ts): combining a due date and a time of day into a moment,
  with option A of [reminder time](#reminder-time)
- `src/reminders/`, new: finding due reminders and showing notifications, under every option of
  [showing reminders](#showing-reminders); a service worker and a manifest with option B
- [`src/components/EditPanel.tsx`](/src/components/EditPanel.tsx): the reminder setting, under every
  option
- A list of missed reminders above the task list, with options A and B of
  [showing reminders](#showing-reminders)
- [`tests/helpers/app.tsx`](/tests/helpers/app.tsx): a fake Notification API, under every option

## The proposal

### On the day or the day before

The proposal says "the day before or on the day": one of the two, both, or a choice for the user.

### Which tasks are reminded

"The app should remind them" of tasks with a due date reads as every task with a due date, by
default. "Let users turn reminders off" does not say whether per task or for the whole app.

### A time of day

The proposal names days, not times. A notification fires at a moment, and due dates have no time.

### Without a server

The proposal asks for no server, which the constitution's
[local first principle](../CONSTITUTION.md#ii-local-first) also requires. Without one, reminders
only arrive on time while the app is open: see
[notifications on the web](#notifications-on-the-web).

## Approaches

Criteria come from the [proposal](proposal.md) (no server, reminders on the day or the day before, a
way to turn them off), the [constitution](../CONSTITUTION.md) (simple for non-technical users, with
at most one new screen per feature; local first; fast with thousands of tasks), and the decisions on
[due dates](../decisions/due-dates.md), [repeating tasks](../decisions/repeating-tasks.md),
[task storage](../decisions/task-storage.md), and [UI components](../decisions/ui-components.md).

### Showing reminders

How a reminder reaches the user. See [notifications on the web](#notifications-on-the-web),
[periodic background sync](#periodic-background-sync), and [iPhone and iPad](#iphone-and-ipad).

| Option                                | Local first                | On time with the app closed          | Effort                              |
| ------------------------------------- | -------------------------- | ------------------------------------ | ----------------------------------- |
| A. While open, and missed ones listed | Yes                        | No: listed at the next opening       | Small                               |
| B. A, plus periodic background sync   | Yes                        | Sometimes, in Chromium, if installed | Medium: manifest and service worker |
| C. A push server, with accounts       | No: data leaves the device | Yes                                  | Large: server and accounts          |

### Reminder time

When in the day a reminder fires, since due dates have no time. See
[what they have in common](#what-they-have-in-common).

| Option                   | Useful reminders                     | Simple for users | Change to stored data                        |
| ------------------------ | ------------------------------------ | ---------------- | -------------------------------------------- |
| A. A time per task, 9:00 | "Call the dentist" reminded at 13:00 | One more field   | A field, and a change to the due dates rules |
| B. One fixed time, 9:00  | Every reminder at 9:00               | Nothing to set   | None for the time                            |

### Which tasks get a reminder

See [which tasks are reminded](#which-tasks-are-reminded) and [Todoist](#todoist).

| Option                                      | Covers the proposal's problem   | Simple for users              |
| ------------------------------------------- | ------------------------------- | ----------------------------- |
| A. Every task with a due date, off per task | Yes: nothing to remember to set | A notification per dated task |
| B. Only when the user turns one on          | No: forgotten tasks stay silent | No surprise notifications     |

### Day of the reminder

See [on the day or the day before](#on-the-day-or-the-day-before).

| Option                      | Simple for users | Covers needs             |
| --------------------------- | ---------------- | ------------------------ |
| A. The user picks, per task | One more choice  | Both                     |
| B. Always on the due date   | Nothing to set   | No warning ahead of time |
| C. Always the day before    | Nothing to set   | Misses same-day tasks    |

### Snoozing

See [Todoist](#todoist) and [notifications on the web](#notifications-on-the-web).

| Option                                 | Simple for users      | Effort                                                                           |
| -------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| A. No snooze: users move the due date  | Nothing new           | None                                                                             |
| B. "Remind me in 1 hour" in the app    | One more button       | Small, but not on the notification itself                                        |
| C. A snooze button on the notification | Where users expect it | Needs a service worker, like option B of [showing reminders](#showing-reminders) |

### Finding due reminders

How the open app finds the reminders to show. See
[timers in background tabs](#timers-in-background-tabs).

| Option                                          | On time                                 | Fast with thousands of tasks   |
| ----------------------------------------------- | --------------------------------------- | ------------------------------ |
| A. Check every minute, and when the tab shows   | Within a minute, two in background tabs | Yes, with an index on due date |
| B. One timer set for the next reminder's moment | Late in background tabs, after a sleep  | Yes, but reset at every edit   |

### Missed reminders

Which reminders count as missed when the app opens. See
[the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                      | Right after the update       | Repeated after a reload |
| ------------------------------------------- | ---------------------------- | ----------------------- |
| A. Those since the app's last check, stored | Nothing old shows            | Never                   |
| B. Every past reminder of a task not done   | Every old overdue task shows | Until the task is done  |

### Needs no choice

- **Quick choices before a picker**: with a reminder tied to the due date, its day and time are the
  whole setting: there is no free date to pick.

Two points leave a choice, settled in the questions file rather than here: when to ask for the
notification permission (Firefox and Safari only ask after a click: see
[notifications on the web](#notifications-on-the-web)), and how two open tabs avoid showing the same
reminder twice (IndexedDB runs overlapping write transactions in order, and a notification `tag`
replaces a duplicate).

## Not checked

- How often Chromium actually wakes a service worker with periodic background sync: neither web.dev
  nor MDN gives numbers.
- Google's own documentation on Google Tasks notifications: its help pages do not describe them.
- Timer throttling in Firefox and Safari background tabs: no official page gives their rules.
- How many tasks with a due date users have: the app collects no usage data, by design.
