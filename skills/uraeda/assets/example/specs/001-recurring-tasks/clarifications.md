---
status: answered
---

# Clarifications: Recurring tasks

## Session 2026-10-07

> [!IMPORTANT]
>
> 4 questions on recurring tasks, about 20 minutes.
>
> - Two choices last beyond this feature: how users pick when a task repeats, which decides what
>   "every 2 weeks" would cost later, and how due dates are stored, which every future feature with
>   dates will follow, and which needs a one-time upgrade of saved tasks.
> - The questions on when the next occurrence appears and which date it counts from work together.
>
> Answer each question with an option letter, `yes` for the recommendation, or your own words. Then
> set `status: answered` and commit.

### Context

The [proposal](proposal.md) asks for tasks that come back once completed, like "water the plants"
every week, while the app stays simple for the people who use it.

Today, a task has a title, a due date, and a done flag, stored in IndexedDB by the
[task store](/src/store/tasks.ts), and edited in a panel with two fields
([edit panel](/src/components/EditPanel.tsx)). The app only runs while it is open: there is no
background process ([app entry point](/src/main.ts)).

The full investigation is in [discovery](discovery.md). Each question below links to its topic.

### Q1: How should users choose when a task repeats?

Repeating needs a new setting in the edit panel. Other apps take different paths:

- Microsoft To Do offers a menu of presets: daily, weekdays, weekly, monthly, yearly, and a custom
  option
  ([Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do)).
- Todoist lets users type rules like "every 3 months"
  ([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)).
- Calendars use the iCalendar repeat rule
  ([RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10)), which the
  [`rrule`](https://github.com/jkbrzt/rrule) library implements in JavaScript.

Why it matters: this sets how complex the edit panel gets, and what a later "every 2 weeks" would
cost. The constitution puts a simple UI first
([principle I](../CONSTITUTION.md#i-simple-for-non-technical-users)). More in
[discovery](discovery.md#recurrence-rules).

Options:

- **A. Presets: daily, weekly, monthly.** One menu in the existing edit panel, with nothing to
  learn. Pick it if simplicity matters more than coverage. "Every 2 weeks" would later need a new
  preset or an interval field, and existing repeating tasks would keep working.
- **B. Presets plus custom intervals (every N days, weeks, or months).** Covers almost every request
  users make. Pick it if users already ask for intervals. It needs a second, more technical-looking
  screen, and either our own code or the `rrule` dependency.
- **C. Typed text, parsed by the app ("every 2nd Monday").** The most flexible, like Todoist. Pick
  it if users are comfortable typing commands. It needs a parser and clear error messages, the
  largest effort, and users have to learn the syntax.

**Recommended:** A. The constitution puts simplicity first, nothing in the proposal asks for
intervals, and A can grow into B later.

**Answer:** yes

### Q2: When does the next occurrence appear?

The app cannot create tasks while it is closed, so occurrences can only appear when the user does
something, or ahead of time. Todoist keeps a single task, and moves its due date when it is
completed
([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)).

Why it matters: this decides whether users see future tasks, whether they keep a history of
completed ones, and how fast lists grow. The constitution requires the app to stay fast with
thousands of tasks ([principle III](../CONSTITUTION.md#iii-fast-with-thousands-of-tasks)). More in
[discovery](discovery.md#generating-occurrences).

Options:

- **A. When the current task is completed, as a new task.** The completed task stays in the list
  like any other, and the next one appears. Pick it for a simple model that keeps the history. The
  list grows by one task per completion, and it is a small change in `completeTask`.
- **B. In advance: the next 4 occurrences are always visible.** Users can plan ahead. Pick it if
  users need to see upcoming tasks. Repeating tasks take four times more space in the list, and
  editing becomes ambiguous: one occurrence, or all of them?
- **C. One task whose due date moves when it is completed, like Todoist.** The list never grows.
  Pick it for the shortest list. The history of completions is lost, and undo has to restore the
  previous date.

**Recommended:** A. It keeps the history, needs no background work, and keeps lists short enough.

**Answer:** A

### Q3: Which date does the next due date count from?

Once a repeating task is completed, its next occurrence needs a due date. Todoist offers both
options below: "every" counts from the previous due date, and "every!" from the day the task was
completed
([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)).

Why it matters: for a weekly task due Monday and completed on Thursday, this decides whether it
stays a Monday task. More in [discovery](discovery.md#next-due-date).

Options:

- **A. From the previous due date.** Monday tasks stay on Mondays, whenever they are completed. Pick
  it for a predictable schedule. A task completed very late can get a next due date that is already
  past: Todoist skips to the next date in the future in that case.
- **B. From the day the task was completed.** A weekly task done on Thursday comes back next
  Thursday. Pick it when the gap matters more than the day, like watering plants. The schedule
  drifts every time a task is done late.
- **C. Users choose, per task.** Covers both needs. It adds a second setting to the edit panel,
  against the constitution's simplicity principle.

**Recommended:** A. Schedules are what users set repeating tasks up for.

**Answer:** A, but if that date is already past, use the next one in the future.

### Q4: How should the app store due dates?

Due dates are stored as timestamps at local midnight ([task store](/src/store/tasks.ts)). Repeating
tasks add date arithmetic, which breaks with timestamps:

- Adding 7 × 24 hours across a daylight saving change gives 23:00 the day before: a weekly task
  would show up a day early twice a year.
- Adding a month with the native `Date` overflows: January 31 plus one month gives March 2 or 3
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setMonth)).
  date-fns' `addMonths` gives the last day of February instead
  ([date-fns docs](https://date-fns.org/docs/addMonths)), and date-fns is already a dependency
  ([`package.json`](/package.json)).

Why it matters: this outlives the feature. Reminders, next in the [priorities](../PRIORITIES.md),
and every later feature with dates will follow it, so the answer becomes a project decision. More in
[discovery](discovery.md#date-handling).

Options:

- **A. Calendar days (`2026-10-12`), without a time, computed with date-fns.** A task due Monday is
  due Monday everywhere, with no timezone or daylight saving bugs. Pick it to fix date bugs for good
  with what the project already uses. It needs a one-time upgrade of saved tasks, and due times
  would later need a separate field.
- **B. UTC timestamps.** Exact instants, the usual choice for servers. Pick it if tasks will need
  precise times soon. A task due Monday shows as due Sunday for users west of UTC, unless every
  display converts carefully.
- **C. The Temporal API's calendar date type.** The right model, built into the language. Pick it to
  avoid a date library in the long run. It is in Firefox 139 and Chrome 144, but not in Safari, so
  not on iPhones
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)):
  until then, its polyfill adds to the bundle.

**Recommended:** A. It fixes the bug with a dependency the project already has. Temporal can replace
date-fns later, inside a single module.

**Answer:** yes
