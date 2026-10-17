---
status: awaiting-human
revision: 2
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Recurring tasks

> [!IMPORTANT]
>
> Spec to review, revision 2, about 10 minutes.
>
> - You approve tasks that repeat from a menu, a custom screen, or a phrase in their title.
>   Completing one moves it to its next due date.
> - Task storage changes: an upgrade that cannot read a saved value clears it and logs it, and never
>   deletes a task.
> - Every saved due date is converted once, from a timestamp to a calendar day.
> - You said rules are typed "when editing the task's title". This spec reads every title typed, at
>   creation too, as Todoist does.

## Your review

- **C1** (add weekends): done. "Weekends" sits next to "weekdays" in the repeat menu.
- **C2** (undo too short): done. The undo now stays 5 seconds, in the task row.
- **C3** (French phrases): declined. The title parser knows English phrases only: other languages
  need their own feature, with a list of phrases per language.

## Decisions

- **New: [Repeating tasks](../decisions/repeating-tasks.md)**. A repeating task is one task whose
  due date moves when it is completed. No history of completions is kept.
- **Changed: [Task storage](../decisions/task-storage.md)**. An upgrade that cannot read a saved
  value clears it and logs it, and never deletes a task.
- **Removed: Task history** (`task-history.md`). Repeating tasks keep no history of completions,
  so the decision has nothing left to govern.

Relied on:

| Decision                                         | What it means for this spec                       |
| ------------------------------------------------ | ------------------------------------------------- |
| [Due dates](../decisions/due-dates.md)           | next dates are counted in calendar days           |
| [UI components](../decisions/ui-components.md)   | the menu is Astryx's `Select`                    |
| [Preview](../decisions/preview.md)               | the mockups are stories of the real components    |

## User stories

### US1: Make a task repeat (P1)

In a task's edit panel, a repeat menu offers never, daily, weekdays, weekends, weekly, monthly,
yearly, and custom. A repeating task shows a repeat icon in the list.

[Repeat menu, open](/src/tasks/RepeatMenu.stories.tsx#Open)

Key scenarios:

1. **Given** an open task due Monday the 5th, **When** the user picks "weekly", **Then** the task
   repeats every Monday, and shows the repeat icon.
2. **Given** a task without a due date, **When** the user picks "weekly", **Then** it is due today,
   and repeats on today's day of the week.

More scenarios:

1. **Given** a repeating task, **When** the user picks "never", **Then** it stops repeating, keeps
   its due date, and loses the icon.

### US2: Complete a repeating task (P1)

Completing a repeating task moves it to its next due date, instead of marking it done. The row says
so for 5 seconds, with an undo button.

[Repeating task, completed](/src/tasks/RepeatMenu.stories.tsx#Completed)

Key scenarios:

1. **Given** a weekly task due Monday the 5th, **When** the user completes it on Thursday the 8th,
   **Then** it stays in the list, not done, due Monday the 12th.
2. **Given** a task just moved from the 5th to the 12th, **When** the user taps undo within 5
   seconds, **Then** it is due the 5th again.

More scenarios:

1. **Given** a weekly task due Monday the 5th, **When** the user completes it on Monday the 5th,
   **Then** it is due Monday the 12th.
2. **Given** a weekly task due Monday the 5th, **When** the user completes it on Wednesday the 14th,
   **Then** it is due Monday the 19th: the 12th is already past.
3. **Given** a daily task due today, **When** the user completes it twice in a row, **Then** it is
   due the day after tomorrow.

### US3: Repeat on a custom schedule (P2)

The menu's "custom" entry opens a screen to repeat every N days, weeks, months, or years, and, for
weeks, on chosen days.

[Custom repeat screen](/src/tasks/RepeatMenu.stories.tsx#Custom)

Key scenarios:

1. **Given** a task due Monday the 5th, **When** the user sets "every 2 weeks", **Then** completing
   it moves it to Monday the 19th.
2. **Given** a task due Monday the 5th, repeating on Mondays and Thursdays, **When** the user
   completes it on Monday, **Then** it is due Thursday the 8th.

### US4: Type a repeat in the title (P3)

A title saved with a repeat phrase at its end, like "every monday", loses the phrase and sets the
repeat.

[Title with a repeat phrase](mockups/title.html)

Key scenarios:

1. **Given** a new task, **When** the user saves "Water the plants every monday" on Thursday the
   8th, **Then** the title is "Water the plants", and it is due Monday the 12th.
2. **Given** a task, **When** the user saves "Read every so often", **Then** the title is
   unchanged, and nothing repeats.

## Architecture

A repeating task stays a normal task with a repeat rule. Rules are plain data computed by pure
functions, so the menu, the custom screen, and the title parser all make the same rule.

- **Date helpers** compute calendar days, and own every date calculation.
- **Repeat rules** hold the presets, the next due date, and the title parser.
- **The task store** completes tasks, and runs the one-time upgrade of saved due dates.

Tradeoffs:

- No history of completions, as the repeating tasks decision accepts.
- Every saved due date is converted once, with no way back.

## Edge cases

| Importance | Situation                                          | What happens                                        |
| ---------- | -------------------------------------------------- | --------------------------------------------------- |
| High       | The due date moved by hand                         | the schedule restarts from the new date             |
| High       | A save fails after a completion                    | the task keeps its date, and the row says "Could not save" |
| Normal     | A monthly task due on the 31st, in a shorter month | due on the month's last day, back on the 31st after |
| Niche      | A title made only of "every monday"                | it stays a title, without a repeat                  |
| Niche      | A repeat phrase in capitals, "EVERY MONDAY"        | it is read like "every monday"                      |

## Success criteria

- **SC-001** (two clicks): Setting a preset repeat takes two clicks from the open task.
- **SC-002** (no slower): A list of 5,000 tasks renders no slower than before the feature.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- The presets are Microsoft To Do's, plus weekends.
- The title parser knows English phrases only, at the end of the title.

## Constitution check

| I. Simple | II. Local first | III. Fast |
| --------- | --------------- | --------- |
| ✅        | ✅              | ⚠️        |

Principle III holds with a cost: the one-time upgrade of saved due dates delays the first start
after the update.

## Risk tier

**High**: it converts every saved due date, in an app that keeps no backup of users' data.

## History

> [!NOTE]
>
> Changes requested on 2026-10-08: add weekends, a longer undo, and French phrases in titles.
