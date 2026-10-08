# Research: Due date reminders

Findings and options for [the proposal](proposal.md). Decisions come from the human's answers in
[clarifications](clarifications.md).

## Session 2026-10-14

### Showing reminders

Browsers show notifications with the Notification API, but only while a page or a service worker
runs. Scheduled notifications (Notification Triggers) were abandoned by Chrome. Without a push
server, a reminder can only appear while the app is open, or when it is opened again.

| Option                       | Pros                                 | Cons                                                      |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------- |
| A. While open, missed banner | No server, works offline             | Reminders are missed while the app is closed              |
| B. Push server               | Reminders arrive with the app closed | Sends data to a server: against the local first principle |

Sources:

- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

### Reminder time

Due dates are calendar days, without a time ([due dates](../decisions/due-dates.md)). A reminder
needs a time of day: either one time for every reminder, or a time per task.

| Option             | Pros                           | Cons                                      |
| ------------------ | ------------------------------ | ----------------------------------------- |
| A. Time per task   | Fits "call the dentist at 2pm" | One more field, and a change to due dates |
| B. One global time | No change to stored tasks      | Every reminder fires at the same time     |

Sources:

- [Due dates decision](../decisions/due-dates.md)
