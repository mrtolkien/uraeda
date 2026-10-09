---
status: answered
---

# Clarifications, round 01: Due date reminders

> [!NOTE]
>
> Answered on 2026-10-14.
>
> - Two choices last beyond this feature: how reminders reach users, where a server would go against
>   the constitution's local first principle, and whether reminders get a time of day, which changes
>   the due dates decision every feature with dates follows.
> - Three questions come from gaps in the proposal: which tasks are reminded, on which day, and at
>   what time. The first two work together: a reminder on by default must have a day that suits most
>   tasks.
> - Snoozing, which mobile todo apps offer, is out of the proposal: one question checks it stays
>   out.
> - Eight points are settled without you, at the end: check them.

## Context

The [proposal](proposal.md) asks the app to remind people of tasks with a due date, the day before
or on the day, without a server, with a way to turn reminders off.

Since recurring tasks, due dates are calendar days without a time
([due dates decision](../decisions/due-dates.md)), and a repeating task is one task whose due date
moves when it is completed ([repeating tasks decision](../decisions/repeating-tasks.md)). The app
registers no service worker ([app entry point](/src/main.ts)): nothing of it runs while it is
closed.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: How do reminders reach users?

Browsers show a notification from an open page, or from a service worker, once the user allows it
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)). Without a push server,
something of the app must be running at the reminder's time: Chrome's way to schedule a notification
in advance was abandoned
([Chrome for Developers](https://developer.chrome.com/docs/web-platform/notification-triggers)).
More in [discovery](discovery-01.md#showing-reminders).

Why it matters: a reminder that arrives with the app closed needs a server, and the constitution
does not allow sending user data to one without your approval
([principle II](../CONSTITUTION.md#ii-local-first)).

- **A (recommended). Show a notification while the app is open in a tab, and list the reminders
  missed while it was closed when it opens again.**
  - [pro] no server, works offline, in every browser.
  - [con] users who close the app get their reminders late, when they come back.
  - Why recommended: it keeps the app local first, and costs little.
- **B. A, plus periodic background sync: once the app is installed, Chromium browsers wake it from
  time to time to show reminders.**
  - [pro] some reminders arrive with the app closed.
  - [con] only in Chrome and Edge, only once installed, at times the browser chooses
    ([web.dev](https://web.dev/articles/web-apps/periodic-background-sync)); the app needs a
    manifest and a service worker.
- **C. A push server, so reminders arrive with the app closed.**
  - [pro] reminders always arrive on time.
  - [con] a server, user accounts to know where to send reminders, and an exception to the local
    first principle that you would have to accept.

**Answer:** A. Installing the app is its own project, maybe with the mobile layout, not now.

## Q2: Which tasks get a reminder?

Todoist adds a reminder to every task with a date and a time, and lets users turn the default off;
Microsoft To Do reminds only when the user sets one
([Todoist help](https://www.todoist.com/help/articles/introduction-to-reminders-9PezfU),
[Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do)).
The proposal says "the app should remind them" and "let users turn reminders off", which reads as on
by default. Which day suits a default is Q4. More in
[discovery](discovery-01.md#which-tasks-get-a-reminder).

Why it matters: it decides whether the feature helps users who would never think of setting a
reminder, and how many notifications they get.

- **A (recommended). Every task with a due date gets a reminder, which users turn off per task in
  the edit panel.**
  - [pro] users get reminded without setting anything, which is the proposal's problem.
  - [con] one notification per task with a due date, even for tasks the user did not want reminded.
  - Why recommended: people forget tasks precisely because they did not plan for it.
- **B. A task gets a reminder only when the user turns "Remind me" on in its edit panel.**
  - [pro] no notification the user did not ask for.
  - [con] the tasks people forget are also the ones they forget to set a reminder on.

**Answer:** A, but not for the tasks people already have: only tasks that get a due date after the
update. My mom has 200 old tasks with dates, she does not want 200 notifications.

## Q3: At what time does a reminder fire?

A notification fires at a moment, and due dates have no time. Google Tasks gives tasks with only a
date a default of 9:00
([9to5Google](https://9to5google.com/2019/03/18/google-tasks-notifications-update/)). The time would
be stored apart from the due date, so due dates and their arithmetic do not change. More in
[discovery](discovery-01.md#reminder-time).

Why it matters: a time per task changes the [due dates decision](../decisions/due-dates.md), which
every feature with dates follows, and a later "due time" feature would build on it.

- **A (recommended). A time per task, in the edit panel next to the reminder, 9:00 by default.**
  - [pro] "Call the dentist" can be reminded at 13:00, when the office opens after lunch.
  - [con] one more field in the edit panel, and in stored tasks.
  - Why recommended: a reminder at the wrong time of day is easy to dismiss and forget, and the
    field stays apart from due dates.
- **B. Every reminder at 9:00, with nothing to set.**
  - [pro] the simplest feature, and no change to the due dates decision.
  - [con] a reminder for an evening task arrives in the morning.

**Answer:** A

## Q4: On which day does a reminder fire?

The proposal says "the day before or on the day". Microsoft To Do offers "tomorrow" and "later
today" as quick choices
([Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do)).
With A in Q2, the day chosen here, or its default, applies to every task with a due date. More in
[discovery](discovery-01.md#day-of-the-reminder).

Why it matters: a reminder on the day leaves no time to prepare, and a reminder the day before only
can come too early for daily tasks.

- **A (recommended). Users pick, per task, "On the day" or "The day before", next to the time; "On
  the day" by default.**
  - [pro] covers both cases the proposal names.
  - [con] one more choice in the edit panel.
  - Why recommended: it is what the proposal asks, and the default matches the due date users set.
- **B. Always on the due date.**
  - [pro] nothing to set.
  - [con] no warning ahead of time, for tasks that need preparing.
- **C. Always the day before.**
  - [pro] nothing to set, and time to prepare.
  - [con] a task due today, added today, is never reminded.

**Answer:** A, but default to the day before: that's when you can still do something about it.

## Q5: Can users snooze a reminder?

Todoist lets users snooze a reminder in its mobile apps, but not on the web
([Todoist help](https://www.todoist.com/help/articles/introduction-to-reminders-9PezfU)). A "Snooze"
button on the notification itself needs a service worker
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification)), which A in Q1
does not have. The proposal does not mention it. More in [discovery](discovery-01.md#snoozing).

Why it matters: it decides whether the feature ends with the notification, or adds a reminder state
to keep.

- **A (recommended). No snooze: users who want a later reminder move the task's due date.**
  - [pro] nothing new to learn or store.
  - [con] no "remind me in an hour".
  - Why recommended: moving the due date already does it, and snoozing can come later.
- **B. A "Remind me in 1 hour" button in the app's list of reminders.**
  - [pro] a quick way to put a reminder off.
  - [con] a second reminder moment to store per task, and the button is not on the notification.

**Answer:** A

## Settled without the human

- **The notification permission** is asked from a "Turn on notifications" button next to the
  reminder in the edit panel, shown until the browser's permission is granted or refused: Firefox
  and Safari only ask after a click. See [discovery](discovery-01.md#notifications-on-the-web).
- **When notifications are refused**, reminders show in the app's list of reminders instead, while
  the app is open. See [discovery](discovery-01.md#notifications-on-the-web).
- **Missed reminders** are the ones whose time passed since the app last checked, a moment stored
  with the tasks: old overdue tasks never show, and a reminder never shows twice. See
  [discovery](discovery-01.md#missed-reminders).
- **Due reminders** are found by the open app every minute, and when its tab comes back to the
  front, reading tasks by due date. In a background tab, a reminder can show up to two minutes late.
  See [discovery](discovery-01.md#finding-due-reminders).
- **A reminder follows its task's due date**: moving the due date, completing a repeating task, or
  undoing a completion moves the reminder too, as the
  [repeating tasks decision](../decisions/repeating-tasks.md) says. Removing the due date removes
  the reminder. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Done and deleted tasks** are not reminded. Unchecking a task brings its reminder back, if its
  time has not passed. Same section of the discovery.
- **Turning every reminder off at once** has no switch in the app: the edit panel turns off one
  task's reminder, and the browser's notification setting stops every notification. An app-wide
  switch would need a settings place the app does not have. See
  [discovery](discovery-01.md#which-tasks-are-reminded).
- **Two open tabs** show each reminder once: the last check is read and updated in one database
  transaction. See [discovery](discovery-01.md#needs-no-choice).
