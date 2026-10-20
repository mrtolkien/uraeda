---
kind: feature
finished: 2026-10-13
pull-request: https://github.com/example/todo/pull/42
---

# Record: Recurring tasks

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-06, finished on
> 2026-10-13, in [its pull request](https://github.com/example/todo/pull/42). Its full files are in
> git: `git log -- specs/2026-10-06-recurring-tasks/`.

## What and why

Users mark a task as repeating, like "water the plants" every week, and completing it brings it back
for the next time. It is a core use of a todo app, and it had to stay simple: the human's parents
use the app, two clicks should be enough, and Google Calendar's custom repeat screen was the
opposite of what they wanted.

## Behaviour

- A repeat menu in the edit panel offers never, daily, weekdays, weekends, weekly, monthly, yearly,
  and custom; repeating tasks show a repeat icon in the list. A task without a due date gets today.
- Completing a repeating task moves its due date to the next date of its rule, skipping dates
  already past, and never marks it done; the row shows "Next: Monday 12" with an undo for 5 seconds.
- "Custom" repeats every N days, weeks, months, or years, and on chosen days for weeks; the due date
  moves to the first chosen day.
- A title saved with a repeat phrase at its end, like "every monday", loses the phrase and sets the
  repeat, like Todoist.
- A repetition never ends on its own: users set the repeat back to "never".

## Design

A repeating task stays one task with a `repeat` rule, `{ unit, interval, weekdays?, from }`, and due
dates are calendar days, `YYYY-MM-DD`. Rules are pure data with pure functions, so the menu, the
custom screen, and the title parser produce the same rule; schedules count from `from`, so a task
due on the 31st stays on the 31st after a shorter month.

- Date helpers, `src/lib/dates.ts`, and repeat rules, `src/lib/repeat.ts`, with `nextDueDate` and
  `parseRepeat`.
- The task store's `completeTask` and `restoreDueDate`, in
  [`src/store/tasks.ts`](/src/store/tasks.ts), and store upgrade 2, which converted saved due dates,
  in [`src/store/upgrades.ts`](/src/store/upgrades.ts).
- The repeat menu in [`EditPanel.tsx`](/src/components/EditPanel.tsx), the custom screen
  `RepeatScreen.tsx`, and the icon and undo in [`TaskRow.tsx`](/src/components/TaskRow.tsx).

## Questions

### Round 01

#### Q1: How should users pick when a task repeats?

**Answer:** B and C: presets plus a custom screen, for weekdays against weekends, and repeat rules
typed in the title, like Todoist.

#### Q2: When does the next occurrence appear?

**Answer:** C: one task whose due date moves when it is completed, with no history, "we're a todo
app, not a calendar".

#### Q3: Which date does the next due date count from?

**Answer:** A: from the previous due date, but a date already past moves to the next one in the
future.

#### Q4: How should the app store due dates?

**Answer:** A: calendar days, `YYYY-MM-DD`, converted once for saved tasks.

#### Q5: How does a repetition end?

**Answer:** A: never on its own, users set it back to "never".

#### Q6: Where do the two clicks start?

**Answer:** B: from the edit panel, "let's not overload the interface".

#### Q7: What happens when a task without a due date is set to repeat?

**Answer:** A: its due date becomes today.

## Decisions

- [Repeating tasks](../decisions/repeating-tasks.md), new: one task whose due date moves when it is
  completed.
- [Due dates](../decisions/due-dates.md), new: due dates are calendar days, and all date arithmetic
  lives in `src/lib/dates.ts`.

## Changes after approval

- A repeat phrase in a title needs a space before it: "Gymevery day" stays as typed, since a phrase
  glued to a word is more likely a typo than a rule.
