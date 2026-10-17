// A feature whose round of questions is written in the format of the clarifications redesign
// (`specs/2026-10-17-redesign-clarifications/spec.md`), for the round page's mockups in
// `QuestionCard.stories.tsx`: the skill's recurring tasks round, rewritten.
import { commitOnBranch, git } from "uraeda-binding/test-utils";

/** The mockup feature's folder and branch. */
export const ROUND_MOCKUP = "2026-10-17-round-mockup";

const PROPOSAL = `# Recurring tasks

## What

Tasks that come back once completed, like "water the plants" every week, in two clicks.
`;

const ROUND = `---
status: awaiting-human
---

# Clarifications, round 01: Recurring tasks

> [!IMPORTANT]
>
> 3 questions and 1 follow-up, about 12 minutes.
>
> - Verdict: worth building, with one change: the proposal's two clicks take three today.
> - Storing due dates as calendar days changes the due dates decision, for every later feature with
>   dates.
> - A task without a due date has no date to repeat from: settled, check it.

## Context

### Goal

Tasks that come back once completed, set in two clicks, while the app stays simple for people who
are not technical. A repeating task is read as one task whose due date moves, not as a series.

### Today

A task has a title, an optional due date, and a done flag, stored in IndexedDB by the task store.
Its edit panel has two fields, and the app only runs while it is open.

| Product         | How users pick a repeat              | A completed occurrence |
| --------------- | ------------------------------------ | ---------------------- |
| Microsoft To Do | presets, and a custom screen         | stays in the list      |
| Todoist         | a rule typed in the due date field   | moves the due date     |
| Google Calendar | a custom screen                      | stays in the calendar  |

### Scope

Repeating a task, its next due date, and how the list shows it. Reminders are left out: they are
next in the priorities.

### Sources

- The task store and the edit panel, in \`src/store/tasks.ts\` and \`src/components/EditPanel.tsx\`.
- The help pages of Microsoft To Do, Todoist, and Google Calendar.
- date-fns' \`addMonths\`, and MDN on Temporal.

## Q1: When does the next occurrence appear?

The app cannot create tasks while it is closed. Todoist keeps a single task and moves its due date
on completion:

> "When you complete a recurring task, it will automatically reschedule to the next date." Todoist
> help, Introduction to recurring dates.

\`\`\`mermaid
flowchart LR
  done[Task completed] --> repeats{Repeats?}
  repeats -- no --> closed[Marked done]
  repeats -- "yes, with A" --> next[New task, next date]
  repeats -- "yes, with C" --> moved[Same task, due date moved]
\`\`\`

Why it matters: it decides whether completed occurrences stay as a history, and whether the app
needs a notion of series.

- **A (recommended). Create the next occurrence as a new task when the current one is completed.
  Editing a task changes that task only.**
  - [pro] completed tasks stay in the list as a history.
  - [con] the list grows by one task per completion.
  - Why recommended: it keeps the history with the simplest model.
- **B. Create the next 4 occurrences in advance, so they are always visible.**
  - [pro] users can plan ahead.
  - [con] four times more repeating tasks, and the follow-up below.
- **C. Keep a single task, and move its due date to the next occurrence when it is completed, like
  Todoist.**
  - [pro] the list never grows.
  - [con] completed occurrences disappear.

**Answer:**

### Q1.B: What does editing one occurrence change?

Only if you picked B in Q1. Google Calendar asks at every edit: this event, this and following
events, or all events.

Why it matters: it decides whether the store keeps per-occurrence changes.

- **A (recommended). That occurrence only. Changing the repeat applies to the occurrences not
  created yet.**
  - [pro] no question at every edit.
  - [con] changing all 4 visible occurrences takes 4 edits.
  - Why recommended: edits stay simple.
- **B. Ask at every edit: this one, this and following, or all, like Google Calendar.**
  - [pro] full control.
  - [con] a question at every edit.

**Answer:**

## Q2: How should the app store due dates?

Due dates are timestamps at local midnight. A local day lasts 23 or 25 hours when daylight saving
time changes, so adding 7 times 24 hours can land on the day before. date-fns, already a
dependency, fixes the month overflow with \`addMonths\`.

Why it matters: reminders, and every later feature with dates, will follow this choice.

- **A (recommended). Store due dates as calendar days (\`2026-10-12\`), without a time, computed
  with date-fns.**
  - [pro] daylight saving cannot shift a calendar day.
  - [con] a one-time upgrade of saved tasks.
  - Why recommended: it fixes both problems with what the project already uses.
- **B. Store due dates as UTC timestamps.**
  - [pro] exact instants.
  - [con] a task due Monday shows as due Sunday for users west of UTC.

**Answer:**

## Q3: How does a repetition end?

Google Calendar lets users end a repetition never, on a date, or after a number of occurrences. The
proposal does not mention it.

Why it matters: an end date adds two fields to the repeat setting.

- **A (recommended). A repetition never ends on its own: users turn the repeat off.**
  - [pro] nothing to set.
  - [con] no "until the end of the semester".
  - Why recommended: turning the repeat off covers the common case.
- **B. Let users end it on a date or after a number of occurrences.**
  - [pro] covers every case.
  - [con] two more fields in the repeat setting.

**Answer:**

## Settled without the human

### Check these

- **A task without a due date** gets today as its due date when it is set to repeat, so the quick
  path works on every task.
- **Skipping one occurrence** gets no action of its own: users move its due date, as in Todoist.

### Behaviour

- **Undoing a completion** puts back what completing changed.
- **Monthly repeats on the 29th to 31st** fall on the last day of shorter months.
- **Repeating tasks show a repeat icon** in the list, next to the due date.

### Under the hood

- **Next dates are computed by date-fns**, in the date helpers, which every feature with dates uses.
- **Tests set the clock**, to cover daylight saving changes and month ends.

**Notes:**
`;

/** Adds the mockup feature on its own branch, from `main`, without a worktree. */
export function addRoundMockup(repo: string) {
  git(repo, "branch", ROUND_MOCKUP, "main");
  commitOnBranch(repo, ROUND_MOCKUP, {
    [`specs/${ROUND_MOCKUP}/clarifications-01.md`]: ROUND,
    [`specs/${ROUND_MOCKUP}/proposal.md`]: PROPOSAL,
  });
}
