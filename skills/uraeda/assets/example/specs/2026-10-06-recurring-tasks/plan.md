---
status: approved
spec-revision: 2
---

# Plan: Recurring tasks

> [!NOTE]
>
> Approved on 2026-10-10.
>
> - Five inputs the spec does not mention must still behave: see [review focus](#review-focus).
> - Beyond the spec: a new development dependency, `fake-indexeddb`, so tests run the real store in
>   memory. The project's tests have no IndexedDB today.
> - Calendar-day due dates and their upgrade come first, so every later task is built on them.

**Goal:** users can make a task repeat, from a menu, a custom screen, or its title, and completing
it moves it to its next due date.

**Architecture:** repeat rules are plain data. The date module, `src/lib/dates.ts`, owns calendar
arithmetic. The repeat module, `src/lib/repeat.ts`, owns recurrence rules. The store owns
transactions, and applies those rules for every entry point: completing, moving, editing, renaming.
The edit panel, the custom screen, and the title parser all produce one `RepeatPattern`, which the
store turns into a `RepeatRule` with its starting date. Components keep only the confirmation and
undo state, and never calculate a next date. See the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md)

## Review focus

1. **A double click on a repeating task's checkbox** moves it once. Task 2.
2. **A title phrase in another case, or with a final period**, "Water the plants Every Monday.", is
   recognized. Task 5.
3. **An interval of 0**, in a title or the custom screen, is refused: the title stays as typed, and
   "Save" stays disabled. Tasks 4 and 5.
4. **A yearly task due on February 29** falls on February 28 in years without one. Task 2.
5. **A weekly custom rule with no day chosen** cannot be saved. Task 4.

## Global constraints

The rules a task here could break. The other rules of [task storage](../decisions/task-storage.md),
[UI components](../decisions/ui-components.md), [preview](../decisions/preview.md), and
[code quality](../decisions/code-quality.md) apply as written there.

- From [due dates](../decisions/due-dates.md): "Due dates MUST be stored as `YYYY-MM-DD` strings."
  "Code MUST NOT convert a due date to a `Date`, except inside the date module and to display it."
- From [repeating tasks](../decisions/repeating-tasks.md): "A repeating task MUST be a single task,
  with its repeat rule stored on it." "Completing a repeating task MUST move its due date to the
  next occurrence, in place of creating a new task."
- From [task storage](../decisions/task-storage.md): "A change to stored data MUST come with a
  versioned upgrade, tested on data saved by the previous version."
- From [the spec](spec.md): the repeat menu's entries read, in order, "Never", "Daily", "Weekdays",
  "Weekends", "Weekly", "Monthly", "Yearly", "Custom...".
- From the spec: the confirmation after a completion reads "Next: " then the next due date, as in
  "Next: Monday 12" (date-fns' `EEEE d`), with an "Undo" button, for 5 seconds. A failed save shows
  "Could not save", and keeps the previous due date.
- Existing behaviour: completing a task without a repeat marks it done
  ([the store](/src/store/tasks.ts)).
- SC-002: no benchmark of the 5,000-task list slower than its baseline from before task 1, beyond
  the benchmark's own margin of error.

## Code read

- [`vitest.config.ts`](/vitest.config.ts): Vitest with jsdom, Testing Library, and `user-event`,
  benchmarks in [`bench/`](/bench/). [`tests/task-list.test.tsx`](/tests/task-list.test.tsx) is the
  only test, on a store mock. No test uses IndexedDB.
- Due dates are read in three places: `createTask` in [the task store](/src/store/tasks.ts), the
  date input of [the edit panel](/src/components/EditPanel.tsx), and
  [the task row](/src/components/TaskRow.tsx), whose `<time dateTime>` the tests read.
- [`eslint.config.js`](/eslint.config.js) holds the limits, run by `npx eslint src`. `updateTask`,
  in the task store, is 96 lines, the only function over them, and carries its marker.
- [`src/store/db.ts`](/src/store/db.ts) opens the `todo` database with `idb`, and runs
  [`upgrades.ts`](/src/store/upgrades.ts) on version changes.

## Complexity tracking

| Abstraction or exception                         | Why it is needed                                                | Simpler alternative rejected because                                |
| ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/dates.ts` and `CalendarDay`             | The one place where due dates meet `Date`, as the decision asks | date-fns calls in components would convert due dates everywhere     |
| `RepeatPattern` and `RepeatRule`                 | One format for the menu, the screen, and the parser             | Three formats would need three versions of `nextDueDate`            |
| `renderApp` and its helpers, in `tests/helpers/` | Each test stays a few lines long                                | Setting up the database, clock, and timezone in each test buries it |

## Test map

The tests render the real app on an in-memory IndexedDB, with the clock and timezone set by the
test. None uses a real browser: the app has no browser runner.

| Spec                                                                 | Task | Test                                                             |
| -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| Edge case: a saved due date that is not a date                       | 1    | `tests/recurring-tasks/upgrade.test.tsx`                         |
| US2; edge cases: moved, deleted, the 31st, a failed save             | 2    | `tests/recurring-tasks/complete-a-repeating-task.test.tsx`       |
| Review focus: a double click; February 29                            | 2    | the same file                                                    |
| US1; SC-001                                                          | 3    | `tests/recurring-tasks/make-a-task-repeat.test.tsx`              |
| US3; review focus: an interval of 0, no day chosen                   | 4    | `tests/recurring-tasks/custom-schedule.test.tsx`                 |
| US4; edge cases: a phrase alone, an unknown phrase                   | 5    | `tests/recurring-tasks/repeat-in-title.test.tsx`                 |
| SC-003; review focus: another case, a final period, an interval of 0 | 5    | `tests/recurring-tasks/parse-repeat.test.ts`, a row a phrase     |
| SC-002                                                               | 1–5  | the [list benchmark](/bench/list.bench.ts), against its baseline |
| The repeat icon's look, the screen's layout                          | none | looked at in the running app, in each task's "Use it"            |

## Waves

1. Task 1: calendar-day due dates and their upgrade, which every later task is built on.
2. Task 2: completing a repeating task, which defines `RepeatPattern` and `RepeatRule`.
3. Task 3: the repeat menu, whose `setRepeat` and `pickRepeat` tasks 4 and 5 use.
4. Tasks 4 and 5: the custom screen changes the components, and the title parser the repeat module
   and the store. Both add their own helpers to `tests/helpers/app.tsx`.

---

## Task 1: Calendar-day due dates, and their upgrade

**Risky:** it rewrites every stored task's due date when the database upgrades: a mistake loses
users' dates.

**Files:**

- Create: `src/lib/dates.ts`, `tests/setup.ts`, `tests/helpers/app.tsx`, `tests/helpers/database.ts`
- Modify: `src/store/tasks.ts` (`Task`, `createTask`), `src/store/upgrades.ts`,
  `src/components/EditPanel.tsx` (date input), `src/components/TaskRow.tsx` (date display),
  `package.json` (`fake-indexeddb`), `vitest.config.ts` (`setupFiles`)
- Test: `tests/recurring-tasks/upgrade.test.tsx`; move `tests/task-list.test.tsx` to the helpers

**Interfaces:**

- Produces, in `src/lib/dates.ts`: `type CalendarDay = string` (`YYYY-MM-DD`);
  `today(): CalendarDay`; `addDays(day, n): CalendarDay`; `addMonths(day, n): CalendarDay`, clamped
  to the month's last day; `weekday(day): number` (0 is Sunday); `weekStart(day): CalendarDay`, the
  Monday of its week; `fromTimestamp(ms: unknown): CalendarDay | null`, in the local timezone,
  `null` when `ms` is not a finite number.
- Produces, in `tests/helpers/app.tsx`:
  `renderApp(options?: { tasks?: SeedTask[]; today?: CalendarDay; timezone?: string }): Promise<{ user }>`,
  `today` defaulting to `"2026-10-05"` and `timezone` to `"UTC"`;
  `SeedTask = { title: string; dueDate?: CalendarDay | null; done?: boolean }`;
  `dueDateOf(title): CalendarDay | null`, read from the row's `<time dateTime>`; `row(title)`;
  `loggedWarnings(): string[]`.
- Produces, in `tests/helpers/database.ts`:
  `versionOneDatabase(tasks: { title: string; dueDate: unknown }[], options?: { timezone?: string })`.

- [x] **Tests**

The helpers first: a fresh in-memory `IDBFactory` before each test; `renderApp` sets the timezone
and the clock, seeds the database, then starts the app; teardown closes everything, even on a
failure. Record the benchmark baseline before any change:
`npx vitest bench --run --outputJson bench/baseline.json`.

- `converts version 1 due dates to calendar days, west of UTC`: a version 1 task due at midnight Los
  Angeles time on 2026-10-05 shows `2026-10-05`. Catches an upgrade that keeps the timestamp, or
  writes it as a UTC instant, a day late.
- `removes a saved due date that is not a date, keeps the task, and logs it`: `"not a date"` gives a
  visible row, no due date, and a warning. Catches a conversion that throws and loses the task.

- [x] **Implement**

`upgrades.ts`, version 2: `dueDate = fromTimestamp(dueDate)` for every task, with a `console.warn`
when it returns `null`. `createTask`, the edit panel, and the task row read and write `CalendarDay`.

- [x] **Use it**

Open the app on a database saved by version 1: every due date shows the same day as before.

- [x] **Validate and commit**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Commit: `feat(recurring-tasks): calendar-day due dates, with upgrade 2`

## Task 2: Completing a repeating task

**Risky:** it splits `updateTask`, which every edit of a task goes through.

**Files:**

- Create: `src/lib/repeat.ts`
- Modify: `src/store/tasks.ts` (`updateTask`, `repeat` field, `completeTask`, `restoreDueDate`),
  `src/store/upgrades.ts` (`repeat: null` in upgrade 2), `src/components/TaskRow.tsx`,
  `tests/helpers/app.tsx`
- Test: `tests/recurring-tasks/complete-a-repeating-task.test.tsx`

**Interfaces:**

- Consumes: `CalendarDay`, `addDays`, `addMonths`, `weekday`, `weekStart`, `today` from task 1.
- Produces, in `src/lib/repeat.ts`:
  `type RepeatPattern = { unit: "day" | "week" | "month" | "year"; interval: number; weekdays?: number[] }`;
  `type RepeatRule = RepeatPattern & { from: CalendarDay }`;
  `nextDueDate(rule: RepeatRule, dueDate: CalendarDay, today: CalendarDay): CalendarDay`.
- Produces, in `src/store/tasks.ts`:
  `completeTask(id): Promise<{ previousDueDate: CalendarDay | null }>`;
  `restoreDueDate(id, day: CalendarDay | null): Promise<void>`; `updateTask(id, { dueDate })` now
  also sets `repeat.from` to the new date on a repeating task.
- Produces, in `tests/helpers/app.tsx`: `SeedTask.repeat?: RepeatRule | null`; `renderApp`'s
  `failingStore?: boolean`, every save rejecting after the seed; `completeBox(title)`;
  `openTask(user, title)`; `moveDueDate(user, title, day)`; `deleteFromPanel(user, title)`.

- [x] **Split first**

`updateTask` is 96 lines, over the limit, and this task changes it. Move its title, notes, and due
date updates into one private function each, and remove its marker. `npx vitest run` and
`npx eslint src` pass before and after. Commit:
`refactor(recurring-tasks): split updateTask by field`.

- [x] **Tests**

"Water the plants" repeats every Monday from 2026-10-05, and is due that day.

- `completing a weekly task moves it to its next date`, a row per case: on its due date gives
  `2026-10-12`; three days late gives `2026-10-12`; after its next date passed, on the 14th, gives
  `2026-10-19`. The box ends unchecked. Catches counting from today, and skipping the check against
  today.
- `the confirmation names the next date, and disappears after 5 seconds`: "Next: Monday 12" and
  "Undo", gone after 5,000 ms. Catches a timer never set.
- `undo puts the previous due date back`: `2026-10-05`. Catches restoring nothing, or today.
- `a double click moves the task once`: `2026-10-12`. Catches a checkbox left enabled.
- `a failed save keeps the due date, and says so`: `2026-10-05` and "Could not save". Catches
  showing the new date before the save resolves.
- `a monthly task due on the 31st comes back to the 31st`: completed twice from 2026-10-31, it gives
  `2026-11-30`, then `2026-12-31`. Catches adding a month to the previous date, which gives the
  30th.
- `a yearly task due on February 29 falls on February 28`: from 2028-02-29, `2029-02-28`. Catches
  adding 365 days.
- `moving a weekly task by hand restarts its schedule`: moved to Wednesday the 7th and completed, it
  gives `2026-10-12`. Catches `updateTask` dropping the rule.
- `deleting a repeating task ends it`: the row is gone. Catches a delete that only clears the date.
- In `upgrade.test.tsx`: a task upgraded from version 1 does not repeat. It already passes.

- [x] **Implement**

`nextDueDate` generates the rule's dates from `rule.from`, in order, and returns the first one after
`dueDate` that is on or after `today`. Always from `from`, never from the previous date, so month
ends do not drift:

- `day`: `addDays(from, k × interval)`; `month`: `addMonths(from, k × interval)`; `year`:
  `addMonths(from, 12 × k × interval)`.
- `week`: the chosen `weekdays` of the week starting `addDays(weekStart(from), 7 × k × interval)`.

`completeTask` saves the next date in one transaction and returns the previous one. The task row
disables the checkbox while the confirmation shows.

- [x] **Use it**

Complete a repeating task: the row shows "Next: …" and "Undo", the date moves, and the box is free
again after 5 seconds. Press Undo. Double click the box.

- [x] **Validate and commit**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Commit: `feat(recurring-tasks): complete a repeating task`

## Task 3: The repeat menu

**Files:**

- Start from: `src/tasks/RepeatMenu.stories.tsx#Open`, the menu written with the spec
- Modify: `src/lib/repeat.ts` (presets, labels, `alignDueDate`), `src/store/tasks.ts` (`setRepeat`),
  `src/components/EditPanel.tsx`, `src/components/TaskRow.tsx` (repeat icon),
  `src/components/icons.tsx`, `tests/helpers/app.tsx`
- Test: `tests/recurring-tasks/make-a-task-repeat.test.tsx`

**Interfaces:**

- Consumes: `RepeatPattern`, `RepeatRule`, `nextDueDate`, `openTask` from task 2; `today`, `weekday`
  from task 1.
- Produces, in `src/lib/repeat.ts`:
  `type Preset = "daily" | "weekdays" | "weekends" | "weekly" | "monthly" | "yearly"`;
  `presetPattern(preset): RepeatPattern`, where "weekly" has no `weekdays`;
  `repeatLabel(rule): string`;
  `alignDueDate(pattern, dueDate: CalendarDay | null, today): CalendarDay`: today when there is no
  due date, then the first chosen weekday on or after it.
- Produces, in `src/store/tasks.ts`: `setRepeat(id, pattern: RepeatPattern | null): Promise<void>`.
  It aligns the due date, fills a weekly pattern without `weekdays` with that date's day, and saves
  the rule with `from` set to that date.
- Produces, in `tests/helpers/app.tsx`: `repeatMenu()`; `pickRepeat(user, entry)`.

- [x] **Tests**

- `the menu offers its entries in order`: the eight entries of the global constraints. Catches one
  missing, or out of order.
- `picking weekly makes a task repeat on its due date's day, in two clicks`: due Monday the 5th, the
  menu reads "Every week on Monday", and the row has the "Repeats" icon. Catches a preset saved
  without the weekday.
- `picking weekly on a task without a due date sets it to today`: on Thursday the 8th, `2026-10-08`
  and "Every week on Thursday". Catches a repeat that leaves the date empty.
- `picking never stops the repeat, and keeps the due date`. Catches clearing the date too.

- [x] **Implement**

The edit panel draws the `Open` story's menu, a `Select` labelled "Repeat", and calls `setRepeat`.
"Custom..." is listed, and does nothing until task 4. The task row shows the repeat icon, labelled
"Repeats", when `repeat` is set.

- [x] **Use it**

Open a task, pick "Weekly" with the keyboard alone, then "Never". At the phone's width, the menu
stays inside the panel.

- [x] **Validate and commit**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Commit: `feat(recurring-tasks): repeat menu`

## Task 4: The custom repeat screen

**Files:**

- Start from: `src/tasks/RepeatMenu.stories.tsx#Custom`, the `RepeatScreen` written with the spec
- Modify: `src/components/RepeatScreen.tsx`, `src/components/RepeatScreen.module.css`,
  `src/components/EditPanel.tsx` ("Custom..." opens the screen), `tests/helpers/app.tsx`
- Test: `tests/recurring-tasks/custom-schedule.test.tsx`

**Interfaces:**

- Consumes: `RepeatPattern`, `repeatLabel`, `setRepeat`, `pickRepeat`, `openTask` from tasks 2
  and 3.
- Produces:
  `RepeatScreen(props: { pattern: RepeatPattern | null; onSave(pattern): void; onCancel(): void })`,
  a dialog named "Custom repeat".
- Produces, in `tests/helpers/app.tsx`:
  `fillCustomRepeat(user, { every: number; unit: "days" | "weeks" | "months" | "years"; days?: string[] })`,
  which fills the open screen without saving.

- [x] **Tests**

- `every 2 weeks moves a completed task two weeks later`: due Monday the 5th, `2026-10-19`. Catches
  an ignored interval.
- `Mondays and Thursdays move a Monday task to Thursday`: `2026-10-08`. Catches keeping only the
  first chosen day.
- `choosing days moves the due date to the first chosen day`: due Tuesday the 6th, `2026-10-08`.
  Catches a rule saved without aligning the date.
- `Save stays disabled`, a row per case: an interval of 0; weeks with no day chosen. Catches a
  pattern that never repeats.

- [x] **Implement**

"Save" is enabled only for a valid pattern: an interval of at least 1 and, for weeks, a day chosen.
It calls `setRepeat` through the edit panel.

- [x] **Use it**

Open the screen from "Custom...", set every 2 weeks on Monday and Thursday, save, and read the
menu's label. Leave with Escape: nothing changed. At the phone's width, the seven days fit.

- [x] **Validate and commit**

- Run: `npx vitest run`
- Commit: `feat(recurring-tasks): custom repeat screen`

## Task 5: Repeats typed in the title

**Files:**

- Modify: `src/lib/repeat.ts` (`parseRepeat`), `src/store/tasks.ts` (`createTask`, `renameTask`),
  `tests/helpers/app.tsx`
- Test: `tests/recurring-tasks/repeat-in-title.test.tsx`,
  `tests/recurring-tasks/parse-repeat.test.ts`

**Interfaces:**

- Consumes: `RepeatPattern` from task 2; `setRepeat` from task 3.
- Produces, in `src/lib/repeat.ts`:
  `parseRepeat(title: string): { title: string; pattern: RepeatPattern } | null`, `null` when the
  title has no phrase at its end, or nothing before it.
- Produces, in `src/store/tasks.ts`: `renameTask(id, title): Promise<void>`, which parses the title
  before saving, as `createTask` now does.
- Produces, in `tests/helpers/app.tsx`: `addTask(user, title)`; `editTitle(user, from, to)`.

- [x] **Tests**

- `a new task's title sets the repeat, and its next Monday`: "Water the plants every monday" typed
  on Thursday the 8th gives the icon and `2026-10-12`.
- `an edited title sets the repeat, and moves the due date`: "Call mom", due the 7th, renamed "Call
  mom every monday" gives `2026-10-12`. With the test above, catches a phrase parsed by only one of
  `createTask` and `renameTask`.
- `an interval in the title starts today on a task without a due date`: "every 2 weeks" on the 8th
  gives `2026-10-08`. Catches a pattern saved without aligning.
- `stays as typed, without a repeat`: "Read every so often", and "every monday" alone. Catches any
  "every ..." stripped, or a title emptied.
- `parse-repeat.test.ts`, a table with a row per phrase of the spec (SC-003): every day, weekday,
  weekend, week, month, year; every 3 days, 2 weeks, 6 months; "every monday and thursday"; and "Gym
  Every Monday." Each gives the title "Gym" and its pattern. "Gym", "Gym every so often", "Gym every
  0 days", and "every monday" give `null`. Catches a case-sensitive match, a final period kept, or a
  0 interval accepted.

- [x] **Implement**

`parseRepeat` recognizes the spec's phrases at the end of the title, whatever their case, ignoring a
final period, with any whole number from 1 as the interval. `createTask` and `renameTask` call it
before saving, then `setRepeat` with the pattern.

- [x] **Use it**

Type "Water the plants every monday" as a new task: the title loses the phrase, and the row repeats.
Rename a task the same way.

- [x] **Validate and commit**

- Run: `npx vitest run`
- Commit: `feat(recurring-tasks): repeats typed in the title`
