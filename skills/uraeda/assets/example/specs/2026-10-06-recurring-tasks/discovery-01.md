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
are timestamps at local midnight, which break as soon as the app adds days or months to them.

## How other products do it

### Microsoft To Do

- Repeat is a menu in the task's details: daily, weekdays, weekly, monthly, yearly, and custom
  ([Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do)).
- The repeat is set together with the due date, in the same panel.

### Todoist

- Users type the rule in the due date field: "every 3 months", "every monday"
  ([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)).
- A recurring task is a single task: completing it moves its due date to the next occurrence. The
  list never grows, and past completions disappear from it.
- "every" counts the next date from the previous due date, "every!" from the day the task was
  completed. When a task is overdue past its next date, completing it moves it to the next date in
  the future (same source).
- One occurrence can be moved without changing the rule, by rescheduling the task
  ([user guide, 2016](https://tomtalks.blog/2016/09/changing-due-date-todoist-reoccurring-task-without-breaking-reoccurrence/)).

### Google Calendar and Google Tasks

- A repeat is chosen from a menu next to "Does not repeat", with how often the event repeats and
  when it ends. A repeating event has at most 730 occurrences
  ([Google Calendar help](https://support.google.com/calendar/answer/37115)).
- The custom repeat screen asks for an interval and a unit, the days of the week or the monthly
  pattern, and an end: never, on a date, or after a number of occurrences
  ([third-party guide](https://nocal.app/help/google-calendar/custom-recurring-events), since
  Google's help does not list the fields). The proposal names this screen as what to avoid.
- Deleting one occurrence asks for its scope: **this event**, **this and following events**, or
  **all events**. Deleting "this and following" cannot be undone
  ([Google Calendar help](https://support.google.com/calendar/answer/37113)). Editing asks for the
  same scopes
  ([Stony Brook IT guide](https://it.stonybrook.edu/help/kb/setting-up-a-recurring-repeating-meeting-in-google-calendar)).
- Changing "this and following events" gives the following events their own Google Meet link, while
  the earlier ones keep the original: the series is split in two
  ([Google Workspace Updates](https://workspaceupdates.googleblog.com/2025/11/google-meet-link-updates-for-recurring-calendar-events.html)).
- Google Tasks offers the same end options for recurring tasks
  ([Google Workspace Updates](https://workspaceupdates.googleblog.com/2022/05/set-recurring-google-task-options.html)).

### What they have in common

Capabilities users of these products may expect, whether or not the proposal mentions them:

- Picking a repeat: presets, custom intervals ("every 2 weeks"), or typed rules
- The next date counted from the due date or from completion, and a rule for overdue tasks
- Editing or skipping one occurrence without changing the others, and changing the whole series
- Ending the repetition: never, on a date, or after a number of occurrences

## Standards and libraries

### iCalendar

- Calendars describe repetition with the recurrence rule, `RRULE`
  ([RFC 5545, 3.3.10](https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10)).
- An edited occurrence is stored as an override that points to the original occurrence's date, with
  `RECURRENCE-ID`. With `RANGE=THISANDFUTURE`, the change applies to that occurrence and all later
  ones ([RFC 5545, 3.8.4.4](https://icalendar.org/iCalendar-RFC-5545/3-8-4-4-recurrence-id.html)).
- A removed occurrence is listed in `EXDATE`
  ([RFC 5545, 3.8.5.1](https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.5.1)).

This is the model behind Google Calendar's three edit scopes: a rule, plus exceptions to it.

### rrule

The [`rrule`](https://github.com/jkbrzt/rrule) library implements `RRULE` in JavaScript, with sets
of rules and excluded dates. Judgement: its options (by day, by set position, ...) would need a
dedicated settings screen to be usable.

### Dates in JavaScript

- Native `Date.setMonth` overflows: January 31 plus one month gives March 2 or 3
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setMonth)).
- date-fns' `addMonths` gives the last day of February instead
  ([date-fns docs](https://date-fns.org/docs/addMonths)). date-fns 4 is already a dependency.
- A local day lasts 23 or 25 hours when daylight saving time changes, so adding 24 hours is not
  always adding a day ([guide](https://www.golinuxcloud.com/javascript-add-days-to-date/)). For a
  timestamp at local midnight, adding 7 × 24 hours gives 23:00 the day before when the week includes
  the autumn change, so the date is wrong, and 01:00 the right day when it includes the spring
  change.
- The Temporal API has a real calendar date type. It shipped in Firefox 139 and Chrome 144, but not
  in Safari, so not on iPhones
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)).
  The official polyfill works everywhere, but adds to the bundle.

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
  creates the next occurrence (option A of [generating occurrences](#generating-occurrences)),
  creates several (B), or moves the due date (C).
- [`src/store/upgrades.ts`](/src/store/upgrades.ts): an upgrade to version 2 for the new field under
  every option, and for due dates under every option of [date handling](#date-handling)
- `src/lib/dates.ts`, new: next due date computation under every option, kept out of the store so it
  can be tested without IndexedDB
- [`src/components/EditPanel.tsx`](/src/components/EditPanel.tsx) and
  [`src/components/TaskRow.tsx`](/src/components/TaskRow.tsx): the repeat setting and its icon under
  every option, and a second screen with option B of [recurrence rules](#recurrence-rules)

## The proposal

### Two clicks

The proposal asks for two clicks, "task -> recurrence -> weekly", which reads as three steps. With
the app's current menus, it takes three clicks: see
[the proposal's path](#the-proposals-path-and-existing-actions).

### Repeating a task without a due date

The proposal does not say what a repeating task without a due date does. Its path does not set one.

### Editing and ending the repetition

The proposal does not mention editing one occurrence or ending the repetition, which every product
reviewed offers: see [what they have in common](#what-they-have-in-common).

## Approaches

Criteria come from the [proposal](proposal.md) (two clicks: task, repeat, weekly), the
[constitution](../CONSTITUTION.md) (simple for non-technical users, with at most one new screen per
feature; local first; fast with thousands of tasks), and the
[UI components decision](../decisions/ui-components.md) (no component library: every control is
built in the project).

### Recurrence rules

How users pick a repeat. See [how other products do it](#how-other-products-do-it).

| Option              | Clicks after opening the task     | Simple for users                   | Covers needs                 | Effort                                                |
| ------------------- | --------------------------------- | ---------------------------------- | ---------------------------- | ----------------------------------------------------- |
| A. Presets          | Two with a menu, one as buttons   | One control, nothing to learn      | No "every 2 weeks"           | Small: the existing `Select`                          |
| B. Presets + custom | Same for presets, more for custom | A second, technical-looking screen | Almost everything            | Medium: a new screen built in the project, or `rrule` |
| C. Typed text       | None, but the rule is typed       | Has to be learned, errors confuse  | Everything the parser covers | Large: parser and error messages                      |

### Generating occurrences

When the next occurrence appears. The app cannot create tasks while it is closed.

| Option                    | Simple for users                    | Fast with thousands of tasks | History of completions | Effort                         |
| ------------------------- | ----------------------------------- | ---------------------------- | ---------------------- | ------------------------------ |
| A. New task on completion | One task at a time                  | One more task per completion | Kept                   | Small                          |
| B. In advance, N ahead    | Upcoming tasks visible, longer list | N times more repeating tasks | Kept                   | Medium: editing a whole series |
| C. One task, date moves   | One task, like Todoist              | No growth                    | Lost                   | Small, undo restores the date  |

### Editing occurrences

What editing, skipping, or deleting one occurrence changes. See
[Google Calendar's edit scopes](#google-calendar-and-google-tasks) and
[iCalendar's exceptions](#icalendar). This depends on how occurrences are generated: with a new task
on completion, only one future occurrence exists at a time.

| Option                                  | Simple for users                        | Fits generating options | Effort                                                     |
| --------------------------------------- | --------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| A. Each occurrence is its own task      | Editing a task edits that task only     | A                       | None: changing the repeat applies from the next occurrence |
| B. This one, this and following, or all | A choice at every edit, as in calendars | B                       | Large: a series, and overrides per occurrence              |
| C. The task is the series               | Editing the task edits the series       | C                       | Small, but one occurrence cannot differ                    |

### Ending the repetition

How a repetition stops. See [Google Calendar and Google Tasks](#google-calendar-and-google-tasks).

| Option                                      | Simple for users              | Covers needs                        | Effort |
| ------------------------------------------- | ----------------------------- | ----------------------------------- | ------ |
| A. Never: the user turns the repeat off     | Nothing to set                | Not "until the end of the semester" | None   |
| B. Never, on a date, or after N occurrences | Two more fields to understand | Everything Google offers            | Small  |

### Next due date

Which date the next occurrence counts from. See [Todoist](#todoist).

| Option               | Predictable schedule              | Simple for users  |
| -------------------- | --------------------------------- | ----------------- |
| A. From the due date | Yes: Monday tasks stay on Mondays | Nothing to choose |
| B. From completion   | No: drifts when done late         | Nothing to choose |
| C. User chooses      | Depends                           | One more setting  |

With A, a task completed very late can get a next date that is already past: Todoist moves it to the
next date in the future.

### Date handling

How due dates are stored and computed, now that the app adds days and months to them. See
[dates in JavaScript](#dates-in-javascript).

| Option                         | Correct dates                                 | Effort                          | Bundle    |
| ------------------------------ | --------------------------------------------- | ------------------------------- | --------- |
| A. Calendar days + date-fns    | Yes                                           | One-time upgrade of saved tasks | No change |
| B. UTC timestamps              | A task due Monday shows as Sunday west of UTC | Upgrade of saved tasks          | No change |
| C. Temporal, with the polyfill | Yes                                           | Upgrade, and a new dependency   | Larger    |

## Not checked

- Google Tasks' and Microsoft To Do's behaviour when editing one occurrence: their help pages do not
  describe it.
- Todoist's current menus: the source for rescheduling one occurrence is a 2016 user guide.
- How often users would need "every 2 weeks" or an end date: the app collects no usage data, by
  design.
