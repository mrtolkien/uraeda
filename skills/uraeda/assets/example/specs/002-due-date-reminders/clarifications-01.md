---
status: answered
---

# Clarifications, round 01: Due date reminders

> [!NOTE]
>
> Answered on 2026-10-14.
>
> - How reminders reach users: without a server, they only show while the app is open. The
>   alternative goes against the constitution's local first principle.
> - When a reminder fires: a time per task changes the due dates decision, which every feature with
>   dates follows.

## Context

The [proposal](proposal.md) asks the app to remind people of tasks with a due date, on the day or
the day before, without a server.

Since recurring tasks, due dates are calendar days without a time
([due dates decision](../decisions/due-dates.md)), computed in [date helpers](/src/lib/dates.ts).
The app registers no service worker ([app entry point](/src/main.ts)), so nothing of it runs while
it is closed.

The full investigation is in [discovery](discovery-01.md). Each question below links to its topic.

## Q1: How do reminders reach the user?

Browsers show notifications from an open page or a service worker, once the user allows it
([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)). Without a push server,
something of the app must be running at the reminder time. Chrome tested a way to schedule a
notification in advance, Notification Triggers, but never launched it
([Chrome for Developers](https://developer.chrome.com/docs/web-platform/notification-triggers)).

Why it matters: a reminder that arrives with the app closed needs a server, and the constitution
does not allow sending user data to one without your approval
([principle II](../CONSTITUTION.md#ii-local-first)). More in
[discovery](discovery-01.md#showing-reminders).

Options:

- **A. A notification while the app is open, and a banner listing the missed ones.** No server, and
  it works offline. Pick it to stay local first. Users who keep the app open in a tab get every
  reminder on time, the others see what they missed when they come back.
- **B. A push server, so reminders arrive with the app closed.** Reminders always arrive. Pick it if
  reminders matter more than keeping data on the device. It needs a server, user accounts to know
  where to send reminders, and a change to the constitution.

**Recommended:** A. It keeps the app local first. B is a change of direction for the whole project,
not a reminder feature.

**Answer:** A

## Q2: When does a reminder fire?

A reminder needs a time of day, but due dates have none
([due dates decision](../decisions/due-dates.md)).

Why it matters: a time per task changes the due dates decision, which every feature with dates
follows. More in [discovery](discovery-01.md#reminder-time).

Options:

- **A. A time per task, 9:00 by default.** "Call the dentist at 2pm" reminds at 2pm. Pick it for
  reminders at the right moment. It adds a field to stored tasks, and a separate reminder time to
  the due dates decision.
- **B. One time for all reminders, in the app's settings.** Nothing changes in stored tasks. Pick it
  for the simplest feature. Every reminder fires at the same time, so a 2pm appointment is reminded
  at 9:00.

**Recommended:** A. Reminders are only useful at the right time of day, and keeping the time
separate leaves due dates unchanged.

**Answer:** A
