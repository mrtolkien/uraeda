---
status: approved
revision: 1
clarifications: 1
risk-tier: high
---

# Spec: Recurring tasks

> [!NOTE]
>
> Approved on 2026-10-09.
>
> - Two new decisions: [repeating tasks](../decisions/repeating-tasks.md), one task whose due date
>   moves, with no history of completions; and [due dates](../decisions/due-dates.md), calendar days
>   for every feature with dates.
> - Every saved due date is converted once, when users get the new version. A value that is not a
>   date, from corrupted data, is removed and logged; no task is deleted.
> - Your answer said rules are typed "when editing the task's title". This spec reads every title
>   typed, when a task is created or edited, like Todoist. Say so if you meant editing only.
> - A "weekends" preset is added next to "weekdays", for your weekdays against weekends need.
> - Risk tier `high`, because of the upgrade of every saved due date: the plan waits for your
>   review.

Users can make a task repeat from a menu in its edit panel, from a custom screen for other
intervals, or by typing the rule in its title. Completing a repeating task moves it to its next due
date. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## User stories

### US1: Make a task repeat (P1)

In a task's edit panel, a repeat menu offers: never, daily, weekdays, weekends, weekly, monthly,
yearly, and custom. Repeating tasks show a repeat icon in the list.

Why this priority: it is the proposal's path, and every other story builds on it.

Acceptance scenarios:

1. **Given** an open task due Monday the 5th, **When** the user opens the repeat menu and picks
   "weekly", **Then** the task repeats every Monday, and shows the repeat icon in the list.
2. **Given** an open task without a due date, **When** the user picks "weekly", **Then** its due
   date becomes today, and it repeats on today's day of the week.
3. **Given** a repeating task, **When** the user picks "never", **Then** it stops repeating, keeps
   its due date, and loses the icon.

### US2: Complete a repeating task (P1)

Completing a repeating task moves it to its next due date instead of marking it done. The row says
so for 5 seconds, with an undo button.

Why this priority: this is what saves users from recreating tasks.

Acceptance scenarios:

1. **Given** a weekly task due Monday the 5th, **When** the user completes it on Monday the 5th,
   **Then** it stays in the list, not done, due Monday the 12th.
2. **Given** a weekly task due Monday the 5th, **When** the user completes it on Thursday the 8th,
   **Then** it is due Monday the 12th.
3. **Given** a weekly task due Monday the 5th, **When** the user completes it on Wednesday the 14th,
   **Then** it is due Monday the 19th: the 12th is already past.
4. **Given** a repeating task just moved from the 5th to the 12th, **When** the user clicks undo
   within 5 seconds, **Then** it is due the 5th again.

### US3: Repeat on a custom schedule (P2)

The repeat menu's "custom" entry opens a screen to repeat every N days, weeks, months, or years,
and, for weeks, on chosen days.

Why this priority: the human needs weekdays against weekends, and intervals like "every 2 weeks"
([Q1](clarifications-01.md#q1-how-should-users-pick-when-a-task-repeats)).

Acceptance scenarios:

1. **Given** a task due Monday the 5th, **When** the user sets "every 2 weeks", **Then** completing
   it moves it to Monday the 19th.
2. **Given** a task due Monday the 5th, set to repeat on Mondays and Thursdays, **When** the user
   completes it on Monday, **Then** it is due Thursday the 8th.
3. **Given** a task due Tuesday the 6th, **When** the user sets it to repeat on Mondays and
   Thursdays, **Then** its due date moves to Thursday the 8th, the first chosen day from its due
   date.

### US4: Type a repeat in the title (P3)

When a task's title is saved with a repeat phrase at its end, like "every monday", the app removes
the phrase from the title and sets the repeat.

Why this priority: the human asked for it as a shortcut, on top of the menu
([Q1](clarifications-01.md#q1-how-should-users-pick-when-a-task-repeats)).

Acceptance scenarios:

1. **Given** a new task, **When** the user saves the title "Water the plants every monday" on
   Thursday the 8th, **Then** the title is "Water the plants", it repeats every Monday, and it is
   due Monday the 12th.
2. **Given** a task due Wednesday the 7th, **When** the user edits its title to "Call mom every
   monday", **Then** the title is "Call mom", and it is due Monday the 12th.
3. **Given** a task without a due date, **When** the user saves the title "Call mom every 2 weeks"
   on Thursday the 8th, **Then** the title is "Call mom", it is due today, and repeats every 2
   weeks.
4. **Given** a task, **When** the user saves the title "Read every so often", **Then** the title is
   unchanged, and nothing repeats.

## Edge cases

- A monthly task due on the 29th to 31st is due on the last day of shorter months, and back on its
  day in longer ones.
- Moving the due date of a repeating task by hand restarts its schedule from the new date: by its
  interval from it, or on the chosen days after it. This is how users skip an occurrence.
- Deleting a repeating task deletes it, which ends the repetition.
- A title made only of a repeat phrase ("every monday") is kept as a title, without a repeat.

## Success criteria

- **SC-001**: Setting a preset repeat takes two clicks from the open task.
- **SC-002**: Rendering a list of 5,000 tasks is not slower than before the feature.
- **SC-003**: The title parser recognizes every phrase in its list, and leaves every other title
  unchanged.

## Design

### Approach

A repeating task stays a normal task with a repeat rule, as the new
[repeating tasks](../decisions/repeating-tasks.md) decision says: completing it moves its due date.
Due dates become calendar days, following the new [due dates](../decisions/due-dates.md) decision,
so next dates are computed without timezone bugs. Rules are pure data with pure functions, so the
menu, the custom screen, and the title parser all produce the same rule. See the
[discovery](discovery-01.md#approaches).

### Data

A task gets `repeat: RepeatRule | null`, where `RepeatRule` is
`{ unit: "day" | "week" | "month" | "year", interval: number, weekdays?: number[], from: CalendarDay }`.
`dueDate` becomes a `YYYY-MM-DD` string or `null`.

- Weekly rules always store their days: "weekly" is every week on the due date's day, "weekdays"
  every week on Monday to Friday, "weekends" every week on Saturday and Sunday.
- Setting a repeat on a task without a due date sets it to today. Setting a weekly rule then moves
  the due date to the first chosen day on or after it.
- `from` is the date the schedule starts from: the due date when the repeat is set, or when the user
  moves the due date by hand. The rule's dates are counted from it: every N days, every N months on
  its day of the month, or the chosen days of every Nth week from its week. Counting from `from`
  keeps a task due on the 31st on the 31st, after a shorter month.
- The next due date is the first date of the rule after the previous due date, skipping dates
  already past.

Completing a repeating task: the task row calls `completeTask`, which computes and saves the next
due date, and returns the previous one. The row keeps it for 5 seconds, for undo.

### Components

- **Date helpers** (`src/lib/dates.ts`, new): calendar day arithmetic on `YYYY-MM-DD` strings, built
  on date-fns, and today's date. Used by repeat rules and the store, depends on nothing else in the
  app.
- **Repeat rules** (`src/lib/repeat.ts`, new): the `RepeatRule` type, the presets, the label shown
  in the menu ("Every 2 weeks on Monday"), `nextDueDate(rule, dueDate, today)`, and
  `parseRepeat(title)`. Pure functions, depending on the date helpers only.
- **Task store** ([`src/store/tasks.ts`](/src/store/tasks.ts)): `completeTask` moves the due date of
  a repeating task, and returns the previous one. `restoreDueDate` puts it back. Saving a title runs
  `parseRepeat`. Setting a repeat aligns the due date, as described in [Data](#data).
- **Store upgrade 2** ([`src/store/upgrades.ts`](/src/store/upgrades.ts)): converts saved due dates
  to calendar days, and adds `repeat: null` to saved tasks.
- **Edit panel** ([`EditPanel.tsx`](/src/components/EditPanel.tsx)): the repeat menu, built on the
  existing [`Select`](/src/components/Select.tsx), whose "custom" entry opens the custom screen.
- **Custom repeat screen** (`src/components/RepeatScreen.tsx`, new): interval, unit, and days of the
  week, built in the project as the [UI components](../decisions/ui-components.md) decision
  requires. It is the one new screen the constitution allows for this feature.
- **Task row** ([`TaskRow.tsx`](/src/components/TaskRow.tsx)): the repeat icon, and the confirmation
  "Next: Monday 12" with its undo button after a completion.

### Error handling

- The upgrade meets a saved due date that is not a valid timestamp: it sets it to `null`, logs the
  raw value, and continues. No task is ever deleted by the upgrade.
- Saving a moved due date fails: the task keeps its previous date, and the row shows "Could not
  save".
- The parser does not recognize a phrase: the title is saved as typed, without a repeat.

### Testing

Integration tests render the app on an in-memory IndexedDB, with today's date set by the test, and
drive it like a user: open a task, pick "weekly", complete it, read the list.

| What                                              | Test                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| US1 to US4, and the edge cases                    | One integration test per scenario                                                |
| Upgrade of version 1 data, with invalid due dates | Integration test: the app opened on a database saved by version 1                |
| "Could not save" after a completion               | Integration test with a store that fails to save                                 |
| SC-001                                            | Integration test counting clicks from the open task                              |
| SC-003                                            | Table-driven test of `parseRepeat`: one row per phrase, and per title left alone |
| SC-002                                            | The existing [list benchmark](/bench/list.bench.ts), before and after            |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- Undoing a completion restores the previous due date.
- Deleting a repeating task ends the repetition.
- Skipping one occurrence has no dedicated action: users move the due date, or complete the task.
- Monthly repeats on the 29th to 31st fall on the last day of shorter months.
- Repeating tasks show a repeat icon in the list.

Settled while writing this spec:

- The presets are those of Microsoft To Do, plus weekends: daily, weekdays, weekends, weekly,
  monthly, yearly ([discovery](discovery-01.md#microsoft-to-do)).
- The title parser reads every title typed, at creation and on edit. It knows English phrases only,
  at the end of the title: "every day", "every weekday", "every weekend", "every week", "every
  month", "every year", "every N days", "every N weeks", "every N months", and "every" followed by
  day names.
- The confirmation after a completion shows for 5 seconds, in the task row itself: no new global
  component. A failed save shows "Could not save" in the same place.

## Decisions

New, applied when this spec is approved:

- [Repeating tasks](../decisions/repeating-tasks.md): a repeating task is one task, whose due date
  moves when it is completed.
- [Due dates](../decisions/due-dates.md): due dates are calendar days, and all date arithmetic lives
  in `src/lib/dates.ts`.

Relied on:

- [Task storage](../decisions/task-storage.md): the `repeat` field and the new due date format come
  with upgrade 2.
- [UI components](../decisions/ui-components.md): the menu uses `Select`, and the custom screen is
  built in the project.

## Constitution check

| Principle                         | Complies | Notes                                          |
| --------------------------------- | -------- | ---------------------------------------------- |
| I. Simple for non-technical users | yes      | One menu in the existing panel, one new screen |
| II. Local first                   | yes      | Nothing leaves the device                      |
| III. Fast with thousands of tasks | yes      | Lists do not grow; SC-002 checks it            |

## Risk tier

**High**: it changes the format of every saved due date, in an app with no backup of users' data.
