// TEMPORARY: the two decisions the spec page's mockups show, as the specs redesign's mockup feature
// (`.storybook/specMockup.ts`) commits them: task storage before and after the change its spec
// proposes, and the new repeating tasks decision. The server reads decisions from the default
// branch only today, so the mockups take the branch's text from here: the implementation reads it
// from the feature's branch.

/** Task storage as it reads on `main`, before the change the mockup's spec proposes. */
export const TASK_STORAGE_BEFORE = `---
status: active
approved-by: mrtolkien
icon: database
---

# Task storage

All task data lives in the browser's IndexedDB, behind the store module in \`src/store/\`. UI code
never touches the database directly, and every change to stored data comes with a versioned upgrade,
so users never lose their tasks when the app updates.

## Rules

- Data MUST be stored in IndexedDB, through \`src/store/\`. Checked by review.
- Components MUST NOT call IndexedDB or the \`idb\` library directly. Checked by ESLint's
  \`no-restricted-imports\` and \`no-restricted-globals\` in \`src/components/\`.
- A change to stored data MUST come with a versioned upgrade in \`src/store/upgrades.ts\`, tested on
  data saved by the previous version. Checked by review, and by the upgrade's own test.

## Why

The constitution requires tasks to stay on the user's device, and the app to stay fast with
thousands of tasks. Users cannot be asked to export and import their tasks after an update, so data
changes must be upgraded in place, from one place.

## Consequences

- Stored data is tested in one place, and components stay free of storage code.
- Every feature that changes stored data needs an upgrade and its test.

## Applies to

- [The store](/src/store/), and any feature that adds or changes stored data
`;

/** Task storage as the mockup's spec would leave it, on its branch. */
export const TASK_STORAGE_AFTER = `---
status: proposed
approved-by:
icon: database
---

# Task storage

All task data lives in the browser's IndexedDB, behind the store module in \`src/store/\`. UI code
never touches the database directly, and every change to stored data comes with a versioned upgrade,
so users never lose their tasks when the app updates.

## Rules

- Data MUST be stored in IndexedDB, only through \`src/store/\`: components never reach the database
  themselves. Checked by ESLint's \`no-restricted-imports\` in \`src/components/\`.
- A change to stored data MUST come with a versioned upgrade in \`src/store/upgrades.ts\`, tested on
  data saved by every earlier version. Checked by the upgrade's own test.
- An upgrade that cannot read a saved value MUST clear it and log it, and MUST NOT delete a task.
  Checked by the upgrade's test on corrupted data.

## Why

The constitution requires tasks to stay on the user's device, and the app to stay fast with
thousands of tasks. Users cannot be asked to export and import their tasks after an update, so data
changes must be upgraded in place, from one place.

## Consequences

- Stored data is tested in one place, and components stay free of storage code.
- Every feature that changes stored data needs an upgrade and its test.
- A corrupted value costs the user that value, never the task.

## Applies to

- [The store](/src/store/), and any feature that adds or changes stored data
`;

/** The new decision the mockup's spec proposes, on its branch. */
export const REPEATING_TASKS = `---
status: proposed
approved-by:
icon: repeat
---

# Repeating tasks

A repeating task is a single task that carries its repeat rule. Completing it moves its due date to
the next occurrence instead of creating a new task: lists never grow, and the app keeps no history
of past completions.

## Rules

- A repeating task MUST be a single task, with its repeat rule stored on it. Checked by the
  \`RepeatRule\` field of the \`Task\` type.
- Completing a repeating task MUST move its due date to the next occurrence, and MUST NOT create a
  new task. Checked by the completion tests of the task store.
- Features MUST NOT rely on a history of completed occurrences: there is none. Checked by review.

## Why

You chose a single task whose date moves: "we're a todo app, not a calendar".

## Consequences

- Lists stay short, and a repeating task is edited like any other task.
- Skipping one occurrence, or editing one apart from the others, needs a change to this decision.

## Applies to

- [The task store](/src/store/tasks.ts), and any feature that reads due dates or completion
`;

/** A decision the mockup's spec removes: its text on the default branch. */
export const TASK_HISTORY = `---
status: active
approved-by: mrtolkien
icon: history
---

# Task history

Completed tasks stay in a history that users can browse and restore from, so nothing done is lost.

## Rules

- Completing a task MUST keep it, marked done, in the history. Checked by the store's tests.
- The history MUST be browsable by day. Checked by the UI tests.
`;

/** Due dates on the default branch, which the mockup's branch changes without listing it. */
export const DUE_DATES_BEFORE = `---
status: active
approved-by: mrtolkien
icon: calendar-clock
---

# Due dates

Due dates are calendar days, like \`2026-10-12\`, without a time or a timezone.

## Rules

- Due dates MUST be stored as \`YYYY-MM-DD\` strings. Checked by the \`CalendarDay\` type.
- Date arithmetic MUST go through \`src/lib/dates.ts\`. Checked by review.
`;

/** Due dates as the mockup's branch leaves it, though its spec does not list the change. */
export const DUE_DATES_AFTER = `---
status: proposed
approved-by:
icon: calendar-clock
---

# Due dates

Due dates are calendar days, like \`2026-10-12\`, without a time or a timezone.

## Rules

- Due dates MUST be stored as \`YYYY-MM-DD\` strings. Checked by the \`CalendarDay\` type.
- Date arithmetic MUST go through \`src/lib/dates.ts\` or \`date-fns\`. Checked by review.
`;
