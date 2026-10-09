# Discovery: Due date reminders

Findings and options for [the proposal](proposal.md), in the code and outside it. Decisions come
from the human's answers in [clarifications](clarifications.md).

## Session 2026-10-14

### Code

Important reads:

- [Due dates decision](../decisions/due-dates.md): due dates are calendar days, without a time.
- [Task store](/src/store/tasks.ts) and [store upgrades](/src/store/upgrades.ts): at version 2,
  after recurring tasks.
- [Date helpers](/src/lib/dates.ts): calendar day arithmetic, and `nextDueDate` for repeating tasks.
- [App entry point](/src/main.ts): no service worker is registered.

Likely changes:

- [`src/store/tasks.ts`](/src/store/tasks.ts) and [`src/store/upgrades.ts`](/src/store/upgrades.ts):
  a reminder field, upgrade to version 3
- [`src/lib/dates.ts`](/src/lib/dates.ts): combining a due date and a time of day
- `src/reminders/`, new: checking due reminders, showing notifications and the missed banner
- [`src/components/EditPanel.tsx`](/src/components/EditPanel.tsx): the reminder toggle and time

### Showing reminders

What needs deciding: how a reminder reaches the user, given the app has no server.

Findings:

- The Notification API shows notifications from a page or a service worker, after the user grants
  permission ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)). Without a
  push server, something must be running at the reminder time.
- Notification Triggers, which would schedule a notification ahead of time, finished its origin
  trial in Chrome but never launched
  ([Chrome for Developers](https://developer.chrome.com/docs/web-platform/notification-triggers)).

| Option                       | Local first                | Reminders with the app closed | Effort                     |
| ---------------------------- | -------------------------- | ----------------------------- | -------------------------- |
| A. While open, missed banner | Yes                        | No, shown on next open        | Small                      |
| B. Push server               | No: data leaves the device | Yes                           | Large: server and accounts |

### Reminder time

What needs deciding: when in the day a reminder fires, since due dates have no time.

Findings:

- [Due dates](../decisions/due-dates.md) stores calendar days, and keeps date arithmetic in
  `src/lib/dates.ts`. A time per task needs a change to that decision.

| Option             | Useful reminders                | Change to stored data                  |
| ------------------ | ------------------------------- | -------------------------------------- |
| A. Time per task   | "Call the dentist at 2pm"       | A new field, and a change to due dates |
| B. One global time | Every reminder at the same time | None                                   |

### Not checked

- How reminders behave on iPhone home screen apps: no test device available in this session.
