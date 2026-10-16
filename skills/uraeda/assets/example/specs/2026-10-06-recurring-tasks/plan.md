---
status: approved
spec-revision: 1
---

# Plan: Recurring tasks

> [!NOTE]
>
> Approved on 2026-10-10.
>
> - Five inputs the spec does not mention get a test each: see [review focus](#review-focus).
> - Beyond the spec: a new development dependency, `fake-indexeddb`, so integration tests run the
>   real store in memory. The project's tests have no IndexedDB today.
> - Calendar-day due dates and their upgrade come first, so every later task is built and tested on
>   them.

**Goal:** users can make a task repeat, from a menu, a custom screen, or its title, and completing
it moves it to its next due date.

**Architecture:** repeat rules are plain data, with pure functions in `src/lib/repeat.ts` on top of
calendar-day helpers in `src/lib/dates.ts`. The store applies them when a task is completed, moved,
edited, or renamed. The edit panel, the custom screen, and the title parser all produce the same
`RepeatPattern`, which the store turns into a `RepeatRule` with its starting date. See the
[spec's architecture](spec.md#architecture).

The date module owns calendar arithmetic; the repeat module owns recurrence rules; the store owns
transactions and applies those rules for every entry point. Components keep only the confirmation
and undo state, and never calculate or save a next date themselves. The test helpers own the
database, clock, and timezone setup and restore or close them after each test. A later preset should
produce another `RepeatPattern`, without adding another scheduling implementation.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A double click on a repeating task's checkbox** moves it once: clicks while the confirmation
   shows are ignored. Task 2.
2. **A title phrase in another case, or with a final period**, like "Water the plants Every
   Monday.", is recognized. Task 5.
3. **An interval of 0**, in a title or the custom screen, is refused: the title stays as typed, and
   the screen's "Save" stays disabled. Tasks 4 and 5.
4. **A yearly task due on February 29** falls on February 28 in years without one. Task 2.
5. **A weekly custom rule with no day chosen** cannot be saved. Task 4.

## Global constraints

From the decisions and the spec, word for word. Every task's requirements include these.

Existing behaviour to preserve, from [the store](/src/store/tasks.ts): completing a task without a
repeat marks it done. Task 2 checks this through the app on an upgraded task. The spec's
[error handling](spec.md#error-handling) also requires a failed save to keep the previous due date;
task 2 checks that together with the error shown.

From [due dates](../decisions/due-dates.md):

- Due dates MUST be stored as `YYYY-MM-DD` strings. Checked by the `CalendarDay` type and the
  store's upgrade test.
- Date arithmetic MUST go through `src/lib/dates.ts`. Checked by review.
- Code MUST NOT convert a due date to a `Date`, except inside `src/lib/dates.ts` and to display it.
  Checked by review.

From [repeating tasks](../decisions/repeating-tasks.md):

- A repeating task MUST be a single task, with its repeat rule stored on it. Checked by the
  `RepeatRule` field of the `Task` type.
- Completing a repeating task MUST move its due date to the next occurrence, and MUST NOT create a
  new task. Checked by the completion tests of the task store.
- Features MUST NOT rely on a history of completed occurrences: there is none. Checked by review.

From [task storage](../decisions/task-storage.md):

- Data MUST be stored in IndexedDB, through `src/store/`. Checked by review.
- Components MUST NOT call IndexedDB or the `idb` library directly. Checked by ESLint's
  `no-restricted-imports` and `no-restricted-globals` in `src/components/`.
- A change to stored data MUST come with a versioned upgrade in `src/store/upgrades.ts`, tested on
  data saved by the previous version. Checked by review, and by the upgrade's own test.

From [UI components](../decisions/ui-components.md):

- Components MUST be written in the project, in `src/components/`. Checked by review.
- Styles MUST use CSS modules, with the variables in `src/styles/theme.css`. Checked by Stylelint's
  `color-no-hex` outside `theme.css`.
- Code MUST NOT add a UI component library (MUI, Chakra, shadcn/ui, ...) or a CSS framework. Checked
  by review of `package.json`.

From [preview](../decisions/preview.md):

- The preview MUST be the app's Storybook, at the repository's top level, run by
  `npx storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}`. This decision's
  frontmatter MUST hold them as `preview-folder: .` and that `preview-command`. Checked by
  `ura check`.
- Storybook MUST use its Vite builder, through `@storybook/react-vite`. Checked by Uraeda's helper,
  which stops a webpack Storybook.
- Mockups and named states MUST be stories, in `*.stories.tsx` files under `src/`, one export per
  state or variant. Checked by review.
- Stories MUST get their tasks from the app's own store, on an in-memory IndexedDB the story fills,
  as the integration tests do. Checked by review.
- Storybook's `main.ts` MUST be wrapped by `.storybook/uraeda-preview.js`, and its preview MUST load
  `.storybook/uraeda-pick.js`, both copied unchanged from the Uraeda skill's `assets/storybook/`.
  Checked by review.
- Storybook's packages MUST be pinned to exact versions, upgraded together, and its telemetry MUST
  be off. Checked by review of `package.json` and `main.ts`.

From [code quality](../decisions/code-quality.md):

- Functions MUST NOT be longer than 80 lines. Checked by ESLint's `max-lines-per-function`.
- Functions MUST NOT take more than 4 parameters. Checked by ESLint's `max-params`.
- Code MUST NOT nest blocks more than 3 levels deep inside a function. Checked by ESLint's
  `max-depth`.
- Source files MUST NOT be longer than 400 lines. Tests are exempt. Checked by ESLint's `max-lines`.
- Code that broke a limit when this decision was approved MUST be marked where it stands, with an
  `// eslint-disable-next-line <rule> -- <reason>` comment. A marker on code that no longer breaks
  its limit MUST fail the lint. Checked by ESLint's `reportUnusedDisableDirectives: "error"`.
- A new marker MUST NOT be added unless a human approves it as a constitution exception in the
  plan's complexity tracking. Checked by review.

From [the spec](spec.md):

- The repeat menu offers: never, daily, weekdays, weekends, weekly, monthly, yearly, and custom. Its
  entries read, in order: "Never", "Daily", "Weekdays", "Weekends", "Weekly", "Monthly", "Yearly",
  "Custom...".
- The confirmation after a completion reads "Next: " then the next due date, as in "Next: Monday 12"
  (date-fns' `EEEE d` format), with an "Undo" button, for 5 seconds. A failed save shows "Could not
  save".
- SC-002: rendering a list of 5,000 tasks is not slower than before the feature: no benchmark slower
  than its baseline from before task 1, beyond the benchmark's own reported margin of error.

## Code read

- [`vitest.config.ts`](/vitest.config.ts): Vitest with jsdom, Testing Library, and `user-event`,
  benchmarks in [`bench/`](/bench/). Tests live in [`tests/`](/tests/);
  [`tests/task-list.test.tsx`](/tests/task-list.test.tsx) is the only one, and renders the list on
  an empty store mock. No test uses IndexedDB.
- Due dates are read in three places: `createTask` in [the task store](/src/store/tasks.ts), the
  date input of [the edit panel](/src/components/EditPanel.tsx), and
  [the task row](/src/components/TaskRow.tsx), which shows them in a `<time>` element: its text
  formatted with date-fns' `EEE, MMM d`, its `dateTime` attribute the timestamp's `toISOString()`.
- The edit panel saves its date input with `updateTask(id, { dueDate })`, and has a "Delete" button
  calling `deleteTask(id)`, both in [the task store](/src/store/tasks.ts).
- [`eslint.config.js`](/eslint.config.js): the [code quality](../decisions/code-quality.md) limits,
  run by `npx eslint src`. `updateTask`, in [the task store](/src/store/tasks.ts), is 96 lines, the
  only function over them, and carries its `max-lines-per-function` marker.
- [`src/store/db.ts`](/src/store/db.ts): `openDatabase()` opens the `todo` database with the `idb`
  library, and runs [`upgrades.ts`](/src/store/upgrades.ts) on version changes.

## Constitution check

| Principle                         | Complies | Notes                                                                  |
| --------------------------------- | -------- | ---------------------------------------------------------------------- |
| I. Simple for non-technical users | yes      | As in the spec: one menu, one new screen                               |
| II. Local first                   | yes      | The new dependency only runs in tests                                  |
| III. Fast with thousands of tasks | yes      | Every task that changes the row compares the benchmark to its baseline |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Repeating tasks](../decisions/repeating-tasks.md): `completeTask` moves the due date, and never
  creates a task (task 2).
- [Due dates](../decisions/due-dates.md): only `src/lib/dates.ts` turns due dates into `Date` values
  (task 1).
- [Task storage](../decisions/task-storage.md): upgrade 2, tested on version 1 data (tasks 1 and 2).
- [UI components](../decisions/ui-components.md): the menu uses `Select`, and the custom screen is
  built in the project (tasks 3 and 4).
- [Preview](../decisions/preview.md): the menu and the custom screen start from the components the
  spec's stories `Open` and `Custom` show, in `src/tasks/RepeatMenu.stories.tsx`, not a rewrite.
  Each task adds its scenarios' tests, then wires the component into the app, and the stories stay
  as the views' states (tasks 3 and 4).
- [Code quality](../decisions/code-quality.md): `updateTask` is split, and its marker removed,
  before task 2 changes it.

## Complexity tracking

| Abstraction or exception                                | Why it is needed                                                                          | Simpler alternative rejected because                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/dates.ts` and `CalendarDay`                    | The one place where due dates meet `Date`, as the due dates decision requires             | date-fns calls spread in components would convert due dates everywhere          |
| `RepeatPattern` and `RepeatRule`, shared by every entry | One format for the menu, the screen, and the parser, from the [spec's data](spec.md#data) | Three formats would need three versions of `nextDueDate`                        |
| `renderApp` and its helpers, in `tests/helpers/`        | Each integration test stays a few lines long                                              | Setting up the database, clock, and timezone in each test buries what it checks |
| The failing store, in `renderApp`                       | Tests "Could not save" through the real app                                               | Mocking the store in one test would test the mock, not the error path           |

---

## Task 1: Calendar-day due dates, and their upgrade

**Risky:** it rewrites every stored task's due date when the database upgrades: a mistake loses
users' dates.

**Files:**

- Create: `src/lib/dates.ts`
- Modify: `src/store/tasks.ts` (`Task` type, `createTask`), `src/store/upgrades.ts`,
  `src/components/EditPanel.tsx` (date input), `src/components/TaskRow.tsx` (date display)
- Create: `tests/setup.ts`, `tests/helpers/app.tsx`, `tests/helpers/database.ts`
- Test: `tests/recurring-tasks/upgrade.test.tsx`; move `tests/task-list.test.tsx` to the helpers
- Modify: `package.json` (`fake-indexeddb` as a development dependency), `vitest.config.ts`
  (`setupFiles: ["tests/setup.ts"]`)

**Interfaces:**

- Produces, in `src/lib/dates.ts`: `type CalendarDay = string` (`YYYY-MM-DD`);
  `today(): CalendarDay`; `addDays(day: CalendarDay, n: number): CalendarDay`;
  `addMonths(day: CalendarDay, n: number): CalendarDay`, clamped to the month's last day;
  `weekday(day: CalendarDay): number` (0 is Sunday); `weekStart(day: CalendarDay): CalendarDay`, the
  Monday of its week; `fromTimestamp(ms: unknown): CalendarDay | null`, in the local timezone,
  `null` when `ms` is not a finite number.
- Produces, in `tests/helpers/app.tsx`:
  `renderApp(options?: { tasks?: SeedTask[]; today?: CalendarDay; timezone?: string }): Promise<{ user: UserEvent }>`,
  with `today` defaulting to `"2026-10-05"` and `timezone` to `"UTC"`, where `SeedTask` is
  `{ title: string; dueDate?: CalendarDay | null; done?: boolean }`;
  `dueDateOf(title: string): CalendarDay | null`, read from the row's `<time dateTime>`;
  `row(title: string): HTMLElement`; `loggedWarnings(): string[]`.
- Produces, in `tests/helpers/database.ts`:
  `versionOneDatabase(tasks: { title: string; dueDate: unknown }[], options?: { timezone?: string }): Promise<void>`.

- [x] **Step 1: Record the benchmark baseline**

- Run: `npx vitest bench --run --outputJson bench/baseline.json`
- Expected: `bench/baseline.json` written, before any change.

- [x] **Step 2: Write the failing tests, and the helpers they use**

The helpers: `tests/setup.ts` imports `fake-indexeddb/auto`, with a fresh `IDBFactory` before each
test. `renderApp` sets `process.env.TZ`, fakes the clock with `vi.setSystemTime`, writes the seed
tasks to the database directly, then starts the app. `versionOneDatabase` writes tasks as version 1
saved them. `loggedWarnings` spies on `console.warn`. Teardown unmounts the app, closes database
connections, and restores the timezone, timers, and spies, even when a test fails.

```tsx
// tests/recurring-tasks/upgrade.test.tsx
test("converts version 1 due dates to calendar days, west of UTC", async () => {
  const midnight = new Date("2026-10-05T00:00:00-07:00").getTime();
  await versionOneDatabase([{ title: "Pay rent", dueDate: midnight }], {
    timezone: "America/Los_Angeles",
  });

  await renderApp({ timezone: "America/Los_Angeles" });

  expect(dueDateOf("Pay rent")).toBe("2026-10-05");
});

test("removes a saved due date that is not a date, keeps the task, and logs it", async () => {
  await versionOneDatabase([{ title: "Old task", dueDate: "not a date" }]);

  await renderApp();

  expect(row("Old task")).toBeVisible();
  expect(dueDateOf("Old task")).toBeNull();
  expect(loggedWarnings()).toContainEqual(expect.stringContaining("not a date"));
});
```

The break each test catches:

- West of UTC: an upgrade that leaves the timestamp, or writes it as an ISO instant.
- Not a date: a conversion that throws on a string, losing the task, or saves `Invalid Date`.

- [x] **Step 3: Run them to check they fail**

- Run: `npx vitest run tests/recurring-tasks/upgrade.test.tsx`
- Expected: FAIL, `expected '2026-10-05T07:00:00.000Z' to be '2026-10-05'`: the row still holds the
  version 1 timestamp.

- [x] **Step 4: Implement**

- `src/lib/dates.ts`: the functions above, on date-fns.
- `upgrades.ts`, version 2: `dueDate = fromTimestamp(dueDate)` for every task, with
  `console.warn("Due date is not a date:", raw)` when it returns `null`.
- `createTask`, the edit panel, and the task row read and write `CalendarDay`.

- [x] **Step 5: Run the project's validation, and the benchmark**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Expected: PASS, and no benchmark slower than the baseline beyond its margin of error.

- [x] **Step 6: Commit**

```bash
git add src/lib/dates.ts src/store src/components tests package.json vitest.config.ts
git commit -m "feat(recurring-tasks): calendar-day due dates, with upgrade 2"
```

## Task 2: Completing a repeating task

**Risky:** it splits `updateTask`, which every edit of a task goes through.

**Files:**

- Create: `src/lib/repeat.ts`
- Modify: `src/store/tasks.ts` (`updateTask` split first; `repeat` field, `completeTask`,
  `restoreDueDate`, `updateTask` for due dates), `src/store/upgrades.ts` (`repeat: null` in upgrade
  2), `src/components/TaskRow.tsx`
- Modify: `tests/helpers/app.tsx` (`SeedTask` gets `repeat`; `renderApp` gets `failingStore`;
  `completeBox`, `openTask`, `moveDueDate`, `deleteFromPanel`)
- Test: `tests/recurring-tasks/complete-a-repeating-task.test.tsx`

**Interfaces:**

- Consumes: `CalendarDay`, `addDays`, `addMonths`, `weekday`, `weekStart`, `today` from task 1.
- Produces, in `src/lib/repeat.ts`:
  `type RepeatPattern = { unit: "day" | "week" | "month" | "year"; interval: number; weekdays?: number[] }`;
  `type RepeatRule = RepeatPattern & { from: CalendarDay }`;
  `nextDueDate(rule: RepeatRule, dueDate: CalendarDay, today: CalendarDay): CalendarDay`.
- Produces, in `src/store/tasks.ts`:
  `completeTask(id: string): Promise<{ previousDueDate: CalendarDay | null }>`;
  `restoreDueDate(id: string, day: CalendarDay | null): Promise<void>`;
  `updateTask(id, { dueDate })` now also sets `repeat.from` to the new date on a repeating task.
- Produces, in `tests/helpers/app.tsx`: `SeedTask.repeat?: RepeatRule | null`; `renderApp`'s
  `failingStore?: boolean`, which wraps the app's store so every save rejects, after seeding;
  `completeBox(title: string): HTMLElement`; `openTask(user, title): Promise<void>`;
  `moveDueDate(user, title: string, day: CalendarDay): Promise<void>`;
  `deleteFromPanel(user, title: string): Promise<void>`.

- [x] **Step 1: Split `updateTask` before it changes**

`updateTask` is over the 80-line limit, and this task changes it. Move its title, notes, and due
date updates into one private function each, without changing what it does, and remove its marker.

- Run: `npx vitest run && npx eslint src`, before and after the split
- Expected: PASS both times, with no unused disable directive

```bash
git add src/store/tasks.ts
git commit -m "refactor(recurring-tasks): split updateTask by field"
```

- [x] **Step 2: Write the failing tests, and the helpers they use**

```tsx
// tests/recurring-tasks/complete-a-repeating-task.test.tsx
const everyMonday: RepeatRule = { unit: "week", interval: 1, weekdays: [1], from: "2026-10-05" };
const plants = { title: "Water the plants", dueDate: "2026-10-05", repeat: everyMonday };

test.each([
  ["on its due date", "2026-10-05", "2026-10-12"],
  ["three days late", "2026-10-08", "2026-10-12"],
  ["after its next date passed", "2026-10-14", "2026-10-19"],
])("completing a weekly task %s moves it to its next date", async (_, day, next) => {
  const { user } = await renderApp({ today: day, tasks: [plants] });

  await user.click(completeBox("Water the plants"));

  expect(dueDateOf("Water the plants")).toBe(next);
  expect(completeBox("Water the plants")).not.toBeChecked();
});

test("the confirmation names the next date, and disappears after 5 seconds", async () => {
  const { user } = await renderApp({ tasks: [plants] });

  await user.click(completeBox("Water the plants"));

  expect(row("Water the plants")).toHaveTextContent("Next: Monday 12");
  vi.advanceTimersByTime(5000);
  expect(row("Water the plants")).not.toHaveTextContent("Next:");
  expect(within(row("Water the plants")).queryByRole("button", { name: "Undo" })).toBeNull();
});

test("undo puts the previous due date back", async () => {
  const { user } = await renderApp({ tasks: [plants] });
  await user.click(completeBox("Water the plants"));

  await user.click(within(row("Water the plants")).getByRole("button", { name: "Undo" }));

  expect(dueDateOf("Water the plants")).toBe("2026-10-05");
});

test("a double click moves the task once", async () => {
  const { user } = await renderApp({ tasks: [plants] });

  await user.dblClick(completeBox("Water the plants"));

  expect(dueDateOf("Water the plants")).toBe("2026-10-12");
});

test("a failed save keeps the due date, and says so", async () => {
  const { user } = await renderApp({ tasks: [plants], failingStore: true });

  await user.click(completeBox("Water the plants"));

  expect(dueDateOf("Water the plants")).toBe("2026-10-05");
  expect(row("Water the plants")).toHaveTextContent("Could not save");
});

test("a monthly task due on the 31st comes back to the 31st after a shorter month", async () => {
  const repeat: RepeatRule = { unit: "month", interval: 1, from: "2026-10-31" };
  const { user } = await renderApp({
    today: "2026-10-31",
    tasks: [{ title: "Rent", dueDate: "2026-10-31", repeat }],
  });

  await user.click(completeBox("Rent"));
  const first = dueDateOf("Rent");
  vi.advanceTimersByTime(5000);
  await user.click(completeBox("Rent"));

  expect([first, dueDateOf("Rent")]).toEqual(["2026-11-30", "2026-12-31"]);
});

test("a yearly task due on February 29 falls on February 28 in other years", async () => {
  const repeat: RepeatRule = { unit: "year", interval: 1, from: "2028-02-29" };
  const { user } = await renderApp({
    today: "2028-02-29",
    tasks: [{ title: "Leap", dueDate: "2028-02-29", repeat }],
  });

  await user.click(completeBox("Leap"));

  expect(dueDateOf("Leap")).toBe("2029-02-28");
});

test("moving a weekly task by hand restarts its schedule on its chosen days", async () => {
  const { user } = await renderApp({ today: "2026-10-07", tasks: [plants] });
  await moveDueDate(user, "Water the plants", "2026-10-07");

  await user.click(completeBox("Water the plants"));

  expect(dueDateOf("Water the plants")).toBe("2026-10-12");
});

test("deleting a repeating task ends it", async () => {
  const { user } = await renderApp({ tasks: [plants] });

  await deleteFromPanel(user, "Water the plants");

  expect(screen.queryByText("Water the plants")).toBeNull();
});
```

Also in `tests/recurring-tasks/upgrade.test.tsx`: a task upgraded from version 1 does not repeat:
completing it marks it done.

The expected dates come from the approved schedule rules, independently of `nextDueDate`. The
non-repeating completion check preserves existing behaviour and already passes before this task. The
break each test catches:

- Moves: counting from today, which puts the late task on 2026-10-15, or skipping the check against
  today, which leaves the third on 2026-10-12.
- Confirmation: a timer never set, so "Next:" stays.
- Undo: restoring nothing, or today's date.
- Double click: a checkbox left enabled during the confirmation, which moves the task two weeks.
- Failed save: showing the new date before the save resolves.
- Month end: adding a month to the previous date, which gives December 30 on the second completion.
- February 29: adding 365 days, which gives March 1.
- Moving by hand: `updateTask` dropping the rule when the date changes, so completing marks it done.
- Deleting: a delete that only clears a repeating task's due date.

- [x] **Step 3: Run them to check they fail**

- Run: `npx vitest run tests/recurring-tasks/complete-a-repeating-task.test.tsx`
- Expected: FAIL, `expected '2026-10-05' to be '2026-10-12'`: completing still only marks the task
  done.

- [x] **Step 4: Implement**

`nextDueDate` generates the rule's dates from `rule.from`, in order, and returns the first one after
`dueDate` that is on or after `today`:

- `day`: `addDays(from, k × interval)`, for k = 0, 1, 2, ...
- `month`: `addMonths(from, k × interval)`; `year`: `addMonths(from, 12 × k × interval)`. Always
  from `from`, never from the previous date, so month ends do not drift.
- `week`: for k = 0, 1, 2, ..., the chosen `weekdays` of the week starting
  `addDays(weekStart(from), 7 × k × interval)`, in order.

`completeTask`, for a repeating task, saves `nextDueDate(...)` in one transaction and returns the
previous date; for other tasks, unchanged. The task row shows "Next: ..." and "Undo" for 5 seconds,
with the checkbox disabled meanwhile, and "Could not save" when the store rejects.

- [x] **Step 5: Run the project's validation, and the benchmark**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Expected: PASS, and no benchmark slower than the baseline beyond its margin of error.

- [x] **Step 6: Commit**

```bash
git add src/lib/repeat.ts src/store src/components/TaskRow.tsx tests
git commit -m "feat(recurring-tasks): complete a repeating task"
```

## Task 3: The repeat menu

**Files:**

- Start from: `src/tasks/RepeatMenu.stories.tsx#Open`, the repeat menu written with the spec, a
  `Select` labelled "Repeat" shown on its own: the tests of US1's scenarios come first, then the
  edit panel draws it, wired to the store.
- Modify: `src/lib/repeat.ts` (presets, labels, `alignDueDate`), `src/store/tasks.ts` (`setRepeat`),
  `src/components/EditPanel.tsx` (draws the story's menu), `src/components/TaskRow.tsx` (repeat
  icon), `src/components/icons.tsx`, `src/tasks/RepeatMenu.stories.tsx` (`Open` fills the store)
- Modify: `tests/helpers/app.tsx` (`repeatMenu`, `pickRepeat`)
- Test: `tests/recurring-tasks/make-a-task-repeat.test.tsx`

**Interfaces:**

- Consumes: `RepeatPattern`, `RepeatRule`, `nextDueDate` from task 2; `today`, `weekday` from task
  1; `openTask` from task 2.
- Produces, in `src/lib/repeat.ts`:
  `type Preset = "daily" | "weekdays" | "weekends" | "weekly" | "monthly" | "yearly"`;
  `presetPattern(preset: Preset): RepeatPattern`, where "weekly" has no `weekdays`;
  `repeatLabel(rule: RepeatRule): string`;
  `alignDueDate(pattern: RepeatPattern, dueDate: CalendarDay | null, today: CalendarDay): CalendarDay`.
- Produces, in `src/store/tasks.ts`:
  `setRepeat(id: string, pattern: RepeatPattern | null): Promise<void>`. It aligns the due date,
  fills a weekly pattern without `weekdays` with the aligned date's day, and saves the rule with
  `from` set to that date.
- Produces, in `tests/helpers/app.tsx`: `repeatMenu(): HTMLElement`;
  `pickRepeat(user, entry: string): Promise<void>`, which opens the menu and picks the entry.

- [x] **Step 1: Write the failing tests, and the helpers they use**

```tsx
// tests/recurring-tasks/make-a-task-repeat.test.tsx
test("the menu offers its entries in order", async () => {
  const { user } = await renderApp({ tasks: [{ title: "Gym" }] });
  await openTask(user, "Gym");

  await user.click(repeatMenu());

  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
    "Never",
    "Daily",
    "Weekdays",
    "Weekends",
    "Weekly",
    "Monthly",
    "Yearly",
    "Custom...",
  ]);
});

test("picking weekly makes a task repeat on its due date's day, in two clicks", async () => {
  const { user } = await renderApp({
    tasks: [{ title: "Water the plants", dueDate: "2026-10-05" }],
  });
  await openTask(user, "Water the plants");

  await user.click(repeatMenu());
  await user.click(screen.getByRole("option", { name: "Weekly" }));

  expect(repeatMenu()).toHaveTextContent("Every week on Monday");
  expect(within(row("Water the plants")).getByLabelText("Repeats")).toBeVisible();
});

test("picking weekly on a task without a due date sets it to today", async () => {
  const { user } = await renderApp({ today: "2026-10-08", tasks: [{ title: "Call mom" }] });
  await openTask(user, "Call mom");

  await pickRepeat(user, "Weekly");

  expect(dueDateOf("Call mom")).toBe("2026-10-08");
  expect(repeatMenu()).toHaveTextContent("Every week on Thursday");
});

test("picking never stops the repeat, and keeps the due date", async () => {
  const repeat: RepeatRule = { unit: "week", interval: 1, weekdays: [1], from: "2026-10-05" };
  const { user } = await renderApp({ tasks: [{ title: "Gym", dueDate: "2026-10-05", repeat }] });
  await openTask(user, "Gym");

  await pickRepeat(user, "Never");

  expect(dueDateOf("Gym")).toBe("2026-10-05");
  expect(within(row("Gym")).queryByLabelText("Repeats")).toBeNull();
});
```

The break each test catches:

- Entries: one missing, or out of order.
- Weekly: a preset saved without the due date's weekday, which reads "Every week".
- Without a due date: a repeat that leaves the date empty.
- Never: clearing the due date with the repeat.

- [x] **Step 2: Run them to check they fail**

- Run: `npx vitest run tests/recurring-tasks/make-a-task-repeat.test.tsx`
- Expected: FAIL, `Unable to find a label with the text of: Repeat`.

- [x] **Step 3: Implement**

- `alignDueDate`: today when `dueDate` is `null`, then, for patterns with `weekdays`, the first
  chosen day on or after it.
- Edit panel: the `Open` story's menu, a `Select` labelled "Repeat" with the global constraints'
  entries, drawn in the panel and calling `setRepeat`. "Custom..." is listed, and opens the custom
  screen from task 4: until then, it does nothing. The story keeps showing the menu open, on a task
  its store holds.
- Task row: the repeat icon, labelled "Repeats", when `repeat` is set.

- [x] **Step 4: Run the project's validation, and the benchmark**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Expected: PASS, and no benchmark slower than the baseline beyond its margin of error (SC-002).

- [x] **Step 5: Commit**

```bash
git add src/lib/repeat.ts src/store/tasks.ts src/components tests
git commit -m "feat(recurring-tasks): repeat menu"
```

## Task 4: The custom repeat screen

**Files:**

- Start from: `src/tasks/RepeatMenu.stories.tsx#Custom`, the `RepeatScreen` written with the spec:
  the tests of US3's scenarios come first, then the edit panel opens it and saves its pattern.
- Modify: `src/components/RepeatScreen.tsx`, `src/components/RepeatScreen.module.css` (from the
  `Custom` story: Save's rules)
- Modify: `src/components/EditPanel.tsx` ("Custom..." opens the screen)
- Modify: `tests/helpers/app.tsx` (`fillCustomRepeat`)
- Test: `tests/recurring-tasks/custom-schedule.test.tsx`

**Interfaces:**

- Consumes: `RepeatPattern`, `repeatLabel` from tasks 2 and 3; `setRepeat`, `pickRepeat` from task
  3; `openTask` from task 2.
- Produces:
  `RepeatScreen(props: { pattern: RepeatPattern | null; onSave(pattern: RepeatPattern): void; onCancel(): void })`,
  a dialog named "Custom repeat".
- Produces, in `tests/helpers/app.tsx`:
  `fillCustomRepeat(user, { every: number; unit: "days" | "weeks" | "months" | "years"; days?: string[] }): Promise<void>`,
  which fills the open screen without saving.

- [x] **Step 1: Write the failing tests, and the helpers they use**

```tsx
// tests/recurring-tasks/custom-schedule.test.tsx
async function setCustom(user, title, fields) {
  await openTask(user, title);
  await pickRepeat(user, "Custom...");
  await fillCustomRepeat(user, fields);
  await user.click(screen.getByRole("button", { name: "Save" }));
}

test("every 2 weeks moves a completed task two weeks later", async () => {
  const { user } = await renderApp({ tasks: [{ title: "Clean", dueDate: "2026-10-05" }] });
  await setCustom(user, "Clean", { every: 2, unit: "weeks", days: ["Monday"] });

  await user.click(completeBox("Clean"));

  expect(dueDateOf("Clean")).toBe("2026-10-19");
});

test("Mondays and Thursdays move a Monday task to Thursday", async () => {
  const { user } = await renderApp({ tasks: [{ title: "Run", dueDate: "2026-10-05" }] });
  await setCustom(user, "Run", { every: 1, unit: "weeks", days: ["Monday", "Thursday"] });

  await user.click(completeBox("Run"));

  expect(dueDateOf("Run")).toBe("2026-10-08");
});

test("choosing days moves the due date to the first chosen day", async () => {
  const { user } = await renderApp({ tasks: [{ title: "Run", dueDate: "2026-10-06" }] });

  await setCustom(user, "Run", { every: 1, unit: "weeks", days: ["Monday", "Thursday"] });

  expect(dueDateOf("Run")).toBe("2026-10-08");
});

test.each([
  ["an interval of 0", { every: 0, unit: "days" }],
  ["weeks with no day chosen", { every: 1, unit: "weeks", days: [] }],
])("Save stays disabled with %s", async (_, fields) => {
  const { user } = await renderApp({ tasks: [{ title: "Run" }] });
  await openTask(user, "Run");
  await pickRepeat(user, "Custom...");

  await fillCustomRepeat(user, fields);

  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});
```

The break each test catches:

- Every 2 weeks: an ignored interval, which gives 2026-10-12.
- Mondays and Thursdays: only the first chosen day kept, which gives 2026-10-12.
- Choosing days: a rule saved without aligning the due date, which stays on 2026-10-06.
- Save disabled: a pattern accepted with an interval of 0, or no day, which never repeats.

- [x] **Step 2: Run them to check they fail**

- Run: `npx vitest run tests/recurring-tasks/custom-schedule.test.tsx`
- Expected: FAIL, `Unable to find role="dialog" and name "Custom repeat"`.

- [x] **Step 3: Implement**

The `Custom` story's dialog keeps its number input for the interval, its unit `Select`, and, for
weeks, its seven day toggles. "Save" is enabled only for a valid pattern, an interval of at least 1
and, for weeks, a day chosen, and calls `setRepeat` through the edit panel.

- [x] **Step 4: Run the project's validation**

- Run: `npx vitest run`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components tests
git commit -m "feat(recurring-tasks): custom repeat screen"
```

## Task 5: Repeats typed in the title

**Files:**

- Modify: `src/lib/repeat.ts` (`parseRepeat`), `src/store/tasks.ts` (`createTask`, `renameTask`)
- Modify: `tests/helpers/app.tsx` (`addTask`, `editTitle`)
- Test: `tests/recurring-tasks/repeat-in-title.test.tsx`,
  `tests/recurring-tasks/parse-repeat.test.ts`

**Interfaces:**

- Consumes: `RepeatPattern` from task 2; `setRepeat` from task 3, which aligns the due date and
  fills a weekly pattern's day.
- Produces, in `src/lib/repeat.ts`:
  `parseRepeat(title: string): { title: string; pattern: RepeatPattern } | null`, `null` when the
  title has no phrase at its end, or nothing before it.
- Produces, in `src/store/tasks.ts`: `renameTask(id: string, title: string): Promise<void>`, which
  parses the title before saving, as `createTask` now does.
- Produces, in `tests/helpers/app.tsx`: `addTask(user, title: string): Promise<void>`;
  `editTitle(user, from: string, to: string): Promise<void>`.

- [x] **Step 1: Write the failing tests, and the helpers they use**

```tsx
// tests/recurring-tasks/repeat-in-title.test.tsx
test("a new task's title sets the repeat, and its next Monday", async () => {
  const { user } = await renderApp({ today: "2026-10-08" });

  await addTask(user, "Water the plants every monday");

  expect(within(row("Water the plants")).getByLabelText("Repeats")).toBeVisible();
  expect(dueDateOf("Water the plants")).toBe("2026-10-12");
});

test("an edited title sets the repeat, and moves the due date", async () => {
  const { user } = await renderApp({ tasks: [{ title: "Call mom", dueDate: "2026-10-07" }] });

  await editTitle(user, "Call mom", "Call mom every monday");

  expect(within(row("Call mom")).getByLabelText("Repeats")).toBeVisible();
  expect(dueDateOf("Call mom")).toBe("2026-10-12");
});

test("an interval in the title starts today on a task without a due date", async () => {
  const { user } = await renderApp({ today: "2026-10-08", tasks: [{ title: "Call mom" }] });

  await editTitle(user, "Call mom", "Call mom every 2 weeks");

  expect(within(row("Call mom")).getByLabelText("Repeats")).toBeVisible();
  expect(dueDateOf("Call mom")).toBe("2026-10-08");
});

test.each(["Read every so often", "every monday"])(
  "%s stays as typed, without a repeat",
  async (typed) => {
    const { user } = await renderApp();

    await addTask(user, typed);

    expect(within(row(typed)).queryByLabelText("Repeats")).toBeNull();
  },
);
```

```ts
// tests/recurring-tasks/parse-repeat.test.ts, one row per phrase (SC-003)
test.each([
  ["Gym every day", { unit: "day", interval: 1 }],
  ["Gym every weekday", { unit: "week", interval: 1, weekdays: [1, 2, 3, 4, 5] }],
  ["Gym every weekend", { unit: "week", interval: 1, weekdays: [0, 6] }],
  ["Gym every week", { unit: "week", interval: 1 }],
  ["Gym every month", { unit: "month", interval: 1 }],
  ["Gym every year", { unit: "year", interval: 1 }],
  ["Gym every 3 days", { unit: "day", interval: 3 }],
  ["Gym every 2 weeks", { unit: "week", interval: 2 }],
  ["Gym every 6 months", { unit: "month", interval: 6 }],
  ["Gym every monday and thursday", { unit: "week", interval: 1, weekdays: [1, 4] }],
  ["Gym Every Monday.", { unit: "week", interval: 1, weekdays: [1] }],
])("%s", (typed, pattern) => {
  expect(parseRepeat(typed)).toEqual({ title: "Gym", pattern });
});

test.each(["Gym", "Gym every so often", "Gym every 0 days", "every monday"])(
  "%s is left alone",
  (typed) => expect(parseRepeat(typed)).toBeNull(),
);
```

The break each test catches:

- New and edited titles: a phrase parsed by only one of `createTask` and `renameTask`.
- An interval without a due date: a pattern saved without aligning, which leaves no date.
- Stays as typed: any "every ..." stripped, or a title made only of a phrase emptied.
- The table: a case-sensitive match, a final period kept, or a 0 interval accepted.

- [x] **Step 2: Run them to check they fail**

- Run:
  `npx vitest run tests/recurring-tasks/repeat-in-title.test.tsx tests/recurring-tasks/parse-repeat.test.ts`
- Expected: FAIL, `parseRepeat is not a function`.

- [x] **Step 3: Implement**

`parseRepeat` recognizes the table's phrases case-insensitively at the end of the title, ignoring a
final period, with any whole number from 1 as the interval. Unrecognized phrases and titles made
only of a repeat phrase stay unchanged. `createTask` and `renameTask` call it before saving, then
`setRepeat` with the pattern; the parser's private implementation is left to the implementer.

- [x] **Step 4: Run the project's validation**

- Run: `npx vitest run`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/repeat.ts src/store/tasks.ts tests
git commit -m "feat(recurring-tasks): repeats typed in the title"
```
