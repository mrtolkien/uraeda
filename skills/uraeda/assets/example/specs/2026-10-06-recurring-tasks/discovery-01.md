# Discovery, round 01: Recurring tasks

## Summary

Recurring tasks in established products combine five parts: how users pick a repeat, when the next
occurrence appears, which date it counts from, whether one occurrence can be edited apart from the
others, and when the repetition ends. Products differ most on the first and the fourth: Microsoft To
Do uses a menu of presets, Todoist typed rules, and Google Calendar a custom screen, which also lets
users edit one occurrence, the following ones, or all of them.

The [proposal](proposal.md) asks for the simplest end of that range: weekly in two clicks, for
non-technical users. It leaves out editing occurrences and ending the repetition, and its two-click
path needs a third click with the app's current menus. The app has no recurrence yet. Its due dates
are timestamps at local midnight, which break as soon as the app adds days or months to them. The
full research, with the approaches compared, is in the human's notes:
`projects/todo/research/2026-10-06-recurring-tasks-01.md`.

## Findings

### Recurrence rules

| Product         | How users pick a repeat                                                     | Source                                                                                                       |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Microsoft To Do | daily, weekdays, weekly, monthly, yearly, and custom, in the task's details | [Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do) |
| Todoist         | a rule typed in the due date field: "every 3 months", "every monday"        | [Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)                   |
| Google Calendar | a menu, and a custom screen of interval, days, and end                      | [Google Calendar help](https://support.google.com/calendar/answer/37115)                                     |

The proposal names Google Calendar's custom screen as what to avoid.

### Generating occurrences

- Todoist keeps a single task: completing it moves its due date to the next occurrence, and past
  completions leave the list
  ([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)).
- The app cannot create tasks while it is closed: it has no service worker or background process
  ([app entry point](/src/main.ts)).

### Editing occurrences

- Google Calendar asks for a scope when one occurrence is edited or deleted: this event, this and
  following events, or all events
  ([Google Calendar help](https://support.google.com/calendar/answer/37113)).
- iCalendar stores an edited occurrence as an override pointing to its original date
  (`RECURRENCE-ID`), and a removed one in `EXDATE`
  ([RFC 5545, 3.8.4.4](https://icalendar.org/iCalendar-RFC-5545/3-8-4-4-recurrence-id.html)).
- Todoist moves one occurrence by rescheduling the task, without changing the rule
  ([user guide, 2016](https://tomtalks.blog/2016/09/changing-due-date-todoist-reoccurring-task-without-breaking-reoccurrence/)).

### Ending the repetition

- Google Calendar and Google Tasks end a repeat never, on a date, or after a number of occurrences
  ([Google Workspace Updates](https://workspaceupdates.googleblog.com/2022/05/set-recurring-google-task-options.html)).

### Next due date

- Todoist's "every" counts the next date from the previous due date, "every!" from the day the task
  was completed. A task overdue past its next date moves to the next date in the future
  ([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)).

### Dates in JavaScript

- `Date.setMonth` overflows: January 31 plus one month gives March 2 or 3
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setMonth)).
- date-fns' `addMonths` gives the last day of February instead
  ([date-fns docs](https://date-fns.org/docs/addMonths)). date-fns 4 is already a dependency.
- A local day lasts 23 or 25 hours when daylight saving time changes: a timestamp at local midnight
  plus 7 × 24 hours lands on 23:00 the day before across the autumn change
  ([guide](https://www.golinuxcloud.com/javascript-add-days-to-date/)).
- Temporal has a calendar date type, but not in Safari, so not on iPhones, and its polyfill adds to
  the bundle
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)).

## The code

### Important reads

- [Task store](/src/store/tasks.ts): tasks are `{ id, title, done, dueDate }`, with `dueDate` a
  timestamp at local midnight. `createTask` and `completeTask` each open their own IndexedDB
  transaction. `updateTask` is over the 80-line limit of
  [code quality](../decisions/code-quality.md), marked: a task that changes it splits it first.
- [Store upgrades](/src/store/upgrades.ts): the database is at version 1, with no upgrade yet.
- [Edit panel](/src/components/EditPanel.tsx): title and due date fields, built with the project's
  [`Select`](/src/components/Select.tsx) and date input. `Select` is a menu: one click to open it,
  one to pick a value.
- [Task row](/src/components/TaskRow.tsx): shows the title, the due date, and a done checkbox. Icons
  come from [`icons.tsx`](/src/components/icons.tsx).
- [`package.json`](/package.json): `date-fns` 4, used only to format dates.
- [App entry point](/src/main.ts): no service worker or background process. The app only runs while
  it is open.
- [List benchmark](/bench/list.bench.ts): renders 5,000 tasks, the reference for the constitution's
  performance principle.

### The proposal's path and existing actions

- **Making a task repeat**, as the proposal describes it: opening the task is one click, opening a
  repeat menu a second, picking "weekly" a third. Two clicks fit only if the choices are buttons
  shown in the panel.
- **A task without a due date**: the proposal's path never sets one, and due dates are optional
  ([task store](/src/store/tasks.ts)). A repeat then has no date to count from.
- **Unchecking a completed task**: today it sets `done: false`. If completing created the next
  occurrence, unchecking leaves both.
- **Deleting a repeating task**: today it deletes that task only. Whether the repetition stops
  depends on how occurrences are stored.
- **Editing the title or due date of one occurrence**: today it edits that task only.

### Rules and their owners

- **A due date is local midnight**: [`createTask` and `updateTask`](/src/store/tasks.ts) write it.
  [`TaskRow`](/src/components/TaskRow.tsx) and [`EditPanel`](/src/components/EditPanel.tsx) each
  turn it back into a `Date` to show it, a copy of the same rule.
- **Completing a task marks it done**: [`completeTask`](/src/store/tasks.ts) alone, which the task
  row's checkbox calls.

### Likely changes

- [`src/store/tasks.ts`](/src/store/tasks.ts): a repeat field under every option. `completeTask`
  creates the next occurrence, creates several, or moves the due date, as
  [generating occurrences](#generating-occurrences) is answered.
- [`src/store/upgrades.ts`](/src/store/upgrades.ts): an upgrade to version 2 for the new field under
  every option, and for due dates under every option of [dates in JavaScript](#dates-in-javascript)
- `src/lib/dates.ts`, new: next due date computation under every option, kept out of the store so it
  can be tested without IndexedDB
- [`src/components/EditPanel.tsx`](/src/components/EditPanel.tsx) and
  [`src/components/TaskRow.tsx`](/src/components/TaskRow.tsx): the repeat setting and its icon under
  every option, and a second screen with a custom option of [recurrence rules](#recurrence-rules)

## The proposal

### Two clicks

The proposal asks for two clicks, "task -> recurrence -> weekly", which reads as three steps. With
the app's current menus, it takes three clicks: see
[the proposal's path](#the-proposals-path-and-existing-actions).

### Repeating a task without a due date

The proposal does not say what a repeating task without a due date does. Its path does not set one.

### Editing and ending the repetition

The proposal does not mention editing one occurrence or ending the repetition, which every product
reviewed offers: see [editing occurrences](#editing-occurrences) and
[ending the repetition](#ending-the-repetition).

## Worth it and feasibility

Every product reviewed repeats tasks, and the proposal's weekly chores are the most common case, so
the feature is worth its cost: one new field, an upgrade of the stored tasks, and at most one new
screen. It relies on no undocumented behaviour: date-fns documents its month arithmetic, including
the end of the month (see [dates in JavaScript](#dates-in-javascript)), and IndexedDB's upgrades are
standard. No option relaxes a guard: the tasks stay in the browser.

## Not checked

- Google Tasks' and Microsoft To Do's behaviour when editing one occurrence: their help pages do not
  describe it.
- Todoist's current menus: the source for rescheduling one occurrence is a 2016 user guide.
- How often users would need "every 2 weeks" or an end date: the app collects no usage data, by
  design.
