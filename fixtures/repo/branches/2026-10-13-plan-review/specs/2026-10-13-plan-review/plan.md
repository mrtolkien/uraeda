---
status: awaiting-human
spec-revision: 1
---

# Plan: Plan review

> [!IMPORTANT]
>
> Plan to review, about 20 minutes.
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

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

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

From [due dates](../decisions/due-dates.md):

- Due dates MUST be stored as `YYYY-MM-DD` strings.
- Date arithmetic MUST go through `src/lib/dates.ts`.
- Code MUST NOT convert a due date to a `Date`, except inside `src/lib/dates.ts` and to display it.

From [repeating tasks](../decisions/repeating-tasks.md):

- A repeating task MUST be a single task, with its repeat rule stored on it.
- Completing a repeating task MUST move its due date to the next occurrence, and MUST NOT create a
  new task.
- Features MUST NOT rely on a history of completed occurrences: there is none.

From [task storage](../decisions/task-storage.md):

- Data MUST be stored in IndexedDB, through `src/store/`.
- Components MUST NOT call IndexedDB or the `idb` library directly.
- A change to stored data MUST come with a versioned upgrade in `src/store/upgrades.ts`, tested on
  data saved by the previous version.

From [UI components](../decisions/ui-components.md):

- Components MUST be written in the project, in `src/components/`.
- Styles MUST use CSS modules, with the variables in `src/styles/theme.css`.
- Code MUST NOT add a UI component library (MUI, Chakra, shadcn/ui, ...) or a CSS framework.

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
- [`src/store/db.ts`](/src/store/db.ts): `openDatabase()` opens the `todo` database with the `idb`
  library, and runs [`upgrades.ts`](/src/store/upgrades.ts) on version changes.

## Constitution check

| I. Simple for non-technical users | II. Local first | III. Fast with thousands of tasks |
| --------------------------------- | --------------- | --------------------------------- |
|                ✅                 |       ✅        |                ✅                 |

## Complexity tracking

| Abstraction or exception                                | Why it is needed                                                                          | Simpler alternative rejected because                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/dates.ts` and `CalendarDay`                    | The one place where due dates meet `Date`, as the due dates decision requires             | date-fns calls spread in components would convert due dates everywhere          |
| `RepeatPattern` and `RepeatRule`, shared by every entry | One format for the menu, the screen, and the parser, from the [spec's architecture](spec.md#architecture) | Three formats would need three versions of `nextDueDate`                        |
| `renderApp` and its helpers, in `tests/helpers/`        | Each integration test stays a few lines long                                              | Setting up the database, clock, and timezone in each test buries what it checks |
| The failing store, in `renderApp`                       | Tests "Could not save" through the real app                                               | Mocking the store in one test would test the mock, not the error path           |

## Test map

Each scenario, edge case, and criterion of the spec, and the task whose tests cover it.

| Spec                              | Task | Test                                                       |
| --------------------------------- | ---- | ---------------------------------------------------------- |
| Edge case: a corrupted due date   | 1    | `tests/recurring-tasks/upgrade.test.tsx`                   |
| US2 1, 2, more 1, 2               | 2    | `tests/recurring-tasks/complete-a-repeating-task.test.tsx` |
| Edge cases: moved, deleted, 31st  | 2    | `tests/recurring-tasks/complete-a-repeating-task.test.tsx` |
| US1 1, 2, more 1; SC-001          | 3    | `tests/recurring-tasks/make-a-task-repeat.test.tsx`        |
| US3 1, 2, more 1                  | 4    | `tests/recurring-tasks/custom-schedule.test.tsx`           |
| US4 1, 2, more 1, 2; SC-003       | 5    | `tests/recurring-tasks/repeat-in-title.test.tsx`           |
| SC-002                            | 1–5  | the [list benchmark](/bench/list.bench.ts)                 |

---

## Task 1: Calendar-day due dates, and their upgrade

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
saved them. `loggedWarnings` spies on `console.warn`.

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

- [x] **Step 3: Run them to check they fail**

- Run: `npx vitest run tests/recurring-tasks/upgrade.test.tsx`
- Expected: FAIL, `expected '2026-10-05T07:00:00.000Z' to be '2026-10-05'`: the row still holds the
  version 1 timestamp.

- [x] **Step 4: Implement**

- `src/lib/dates.ts`: the functions above, on date-fns.
- `upgrades.ts`, version 2: `dueDate = fromTimestamp(dueDate)` for every task, with
  `console.warn("Due date is not a date:", raw)` when it returns `null`.
- `createTask`, the edit panel, and the task row read and write `CalendarDay`.

- [x] **Step 5: Run all tests, and the benchmark**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Expected: PASS, and no benchmark slower than the baseline beyond its margin of error.

- [x] **Step 6: Commit**

```bash
git add src/lib/dates.ts src/store src/components tests package.json vitest.config.ts
git commit -m "feat(recurring-tasks): calendar-day due dates, with upgrade 2"
```

## Task 2: Completing a repeating task

**Files:**

- Create: `src/lib/repeat.ts`
- Modify: `src/store/tasks.ts` (`repeat` field, `completeTask`, `restoreDueDate`, `updateTask` for
  due dates), `src/store/upgrades.ts` (`repeat: null` in upgrade 2), `src/components/TaskRow.tsx`
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

- [x] **Step 1: Write the failing tests, and the helpers they use**

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

- [x] **Step 2: Run them to check they fail**

- Run: `npx vitest run tests/recurring-tasks/complete-a-repeating-task.test.tsx`
- Expected: FAIL, `expected '2026-10-05' to be '2026-10-12'`: completing still only marks the task
  done.

- [x] **Step 3: Implement**

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

- [x] **Step 4: Run all tests, and the benchmark**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Expected: PASS, and no benchmark slower than the baseline beyond its margin of error.

- [x] **Step 5: Commit**

```bash
git add src/lib/repeat.ts src/store src/components/TaskRow.tsx tests
git commit -m "feat(recurring-tasks): complete a repeating task"
```

## Task 3: The repeat menu

**Files:**

- Modify: `src/lib/repeat.ts` (presets, labels, `alignDueDate`), `src/store/tasks.ts` (`setRepeat`),
  `src/components/EditPanel.tsx`, `src/components/TaskRow.tsx` (repeat icon),
  `src/components/icons.tsx`
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

- [x] **Step 2: Run them to check they fail**

- Run: `npx vitest run tests/recurring-tasks/make-a-task-repeat.test.tsx`
- Expected: FAIL, `Unable to find a label with the text of: Repeat`.

- [x] **Step 3: Implement**

- `alignDueDate`: today when `dueDate` is `null`, then, for patterns with `weekdays`, the first
  chosen day on or after it.
- Edit panel: a `Select` labelled "Repeat", with the global constraints' entries, calling
  `setRepeat`. "Custom..." is listed, and opens the custom screen from task 4: until then, it does
  nothing.
- Task row: the repeat icon, labelled "Repeats", when `repeat` is set.

- [x] **Step 4: Run all tests, and the benchmark**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Expected: PASS, and no benchmark slower than the baseline beyond its margin of error (SC-002).

- [x] **Step 5: Commit**

```bash
git add src/lib/repeat.ts src/store/tasks.ts src/components tests
git commit -m "feat(recurring-tasks): repeat menu"
```

## Task 4: The custom repeat screen

**Files:**

- Create: `src/components/RepeatScreen.tsx`, `src/components/RepeatScreen.module.css`
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

- [x] **Step 2: Run them to check they fail**

- Run: `npx vitest run tests/recurring-tasks/custom-schedule.test.tsx`
- Expected: FAIL, `Unable to find role="dialog" and name "Custom repeat"`.

- [x] **Step 3: Implement**

A dialog with a number input for the interval (a whole number, at least 1), a unit `Select`, and,
for weeks, seven day toggles. "Save" is enabled only for a valid pattern, and calls `setRepeat`
through the edit panel.

- [x] **Step 4: Run all tests**

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

- [x] **Step 2: Run them to check they fail**

- Run:
  `npx vitest run tests/recurring-tasks/repeat-in-title.test.tsx tests/recurring-tasks/parse-repeat.test.ts`
- Expected: FAIL, `parseRepeat is not a function`.

- [ ] **Step 3: Implement**

`parseRepeat`: one regular expression, case-insensitive, anchored at the end of the title, ignoring
a final period, for the phrases in the table, with any whole number from 1 as the interval.
`createTask` and `renameTask` call it before saving, then `setRepeat` with the pattern.

- [ ] **Step 4: Run all tests**

- Run: `npx vitest run`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repeat.ts src/store/tasks.ts tests
git commit -m "feat(recurring-tasks): repeats typed in the title"
```
