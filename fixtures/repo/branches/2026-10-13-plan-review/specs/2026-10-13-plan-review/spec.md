---
status: approved
revision: 1
clarifications: 1
risk-tier: high
plan-review: true
---

# Spec: Plan review

> [!NOTE]
>
> Approved on 2026-10-09.
>
> - You approve tasks that repeat from a menu, a custom screen, or a phrase at the end of their
>   title. Completing one moves it to its next due date.
> - Two new decisions: repeating tasks, one task whose due date moves, with no history of
>   completions; and due dates, calendar days for every feature with dates.
> - Every saved due date is converted once, when users get the new version. A value that is not a
>   date, from corrupted data, is removed and logged; no task is deleted.
> - Your answer said rules are typed "when editing the task's title". This spec reads every title
>   typed, when a task is created or edited, like Todoist. Say so if you meant editing only.
> - Risk tier `high`, because of the upgrade of every saved due date: the plan waits for your
>   review.

Users can make a task repeat from a menu in its edit panel, from a custom screen for other
intervals, or by typing the rule in its title. Completing a repeating task moves it to its next due
date. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

- **New: Repeating tasks**. A repeating task is one task, whose
  due date moves when it is completed.
- **New: Due dates**. Due dates are calendar days, and all date
  arithmetic lives in `src/lib/dates.ts`.

Relied on:

| Decision                                       | What it means for this spec                                        |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Task storage                                 | the `repeat` field and the new due date format come with upgrade 2 |
| UI components                                  | the menu uses `Select`, and the custom screen is built here        |

## User stories

### US1: Make a task repeat (P1)

In a task's edit panel, a repeat menu offers: never, daily, weekdays, weekends, weekly, monthly,
yearly, and custom. Repeating tasks show a repeat icon in the list.

The [Repeat](mockups/repeat.html) mockup shows the menu open, the custom screen, and the undo.

Why this priority: it is the proposal's path, and every other story builds on it.

Key scenarios:

1. **Given** an open task due Monday the 5th, **When** the user opens the repeat menu and picks
   "weekly", **Then** the task repeats every Monday, and shows the repeat icon in the list.
2. **Given** an open task without a due date, **When** the user picks "weekly", **Then** its due
   date becomes today, and it repeats on today's day of the week.

More scenarios:

1. **Given** a repeating task, **When** the user picks "never", **Then** it stops repeating, keeps
   its due date, and loses the icon.

### US2: Complete a repeating task (P1)

Completing a repeating task moves it to its next due date instead of marking it done. The row says
so for 5 seconds, with an undo button.

Why this priority: this is what saves users from recreating tasks.

Key scenarios:

1. **Given** a repeating task just moved from the 5th to the 12th, **When** the user clicks undo
   within 5 seconds, **Then** it is due the 5th again.
2. **Given** a weekly task due Monday the 5th, **When** the user completes it on Wednesday the 14th,
   **Then** it is due Monday the 19th: the 12th is already past.

More scenarios:

1. **Given** a weekly task due Monday the 5th, **When** the user completes it on Monday the 5th,
   **Then** it stays in the list, not done, due Monday the 12th.
2. **Given** a weekly task due Monday the 5th, **When** the user completes it on Thursday the 8th,
   **Then** it is due Monday the 12th.

### US3: Repeat on a custom schedule (P2)

The repeat menu's "custom" entry opens a screen to repeat every N days, weeks, months, or years,
and, for weeks, on chosen days.

Why this priority: the human needs weekdays against weekends, and intervals like "every 2 weeks"
([how users pick a repeat](clarifications-01.md#q1-how-should-users-pick-when-a-task-repeats)).

Key scenarios:

1. **Given** a task due Monday the 5th, **When** the user sets "every 2 weeks", **Then** completing
   it moves it to Monday the 19th.
2. **Given** a task due Monday the 5th, set to repeat on Mondays and Thursdays, **When** the user
   completes it on Monday, **Then** it is due Thursday the 8th.

More scenarios:

1. **Given** a task due Tuesday the 6th, **When** the user sets it to repeat on Mondays and
   Thursdays, **Then** its due date moves to Thursday the 8th, the first chosen day from its due
   date.

### US4: Type a repeat in the title (P3)

When a task's title is saved with a repeat phrase at its end, like "every monday", the app removes
the phrase from the title and sets the repeat.

Why this priority: the human asked for it as a shortcut, on top of the menu
([how users pick a repeat](clarifications-01.md#q1-how-should-users-pick-when-a-task-repeats)).

Key scenarios:

1. **Given** a new task, **When** the user saves the title "Water the plants every monday" on
   Thursday the 8th, **Then** the title is "Water the plants", it repeats every Monday, and it is
   due Monday the 12th.
2. **Given** a task, **When** the user saves the title "Read every so often", **Then** the title is
   unchanged, and nothing repeats.

More scenarios:

1. **Given** a task due Wednesday the 7th, **When** the user edits its title to "Call mom every
   monday", **Then** the title is "Call mom", and it is due Monday the 12th.
2. **Given** a task without a due date, **When** the user saves the title "Call mom every 2 weeks"
   on Thursday the 8th, **Then** the title is "Call mom", it is due today, and repeats every 2
   weeks.

## Architecture

A repeating task stays a normal task with a repeat rule: completing it moves its due date. Due dates
become calendar days, so next dates are computed without timezone bugs. Rules are pure data with
pure functions, so the menu, the custom screen, and the title parser all produce the same rule. See
the [discovery](discovery-01.md#approaches).

- **Date helpers** compute on calendar days, in `src/lib/dates.ts`, and own all date arithmetic.
- **Repeat rules** hold the presets, the next due date, and the title parser, in
  `src/lib/repeat.ts`.
- **The task store** completes tasks, sets repeats, and runs the one-time upgrade of saved due
  dates.

Tradeoffs:

- One task whose due date moves keeps no history of completions.
- Due dates are converted once, by an upgrade of every saved task.

## Edge cases

| Importance | Situation                                             | What happens                                                           |
| ---------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| High       | The upgrade meets a saved due date that is not a date | it is removed and logged; no task is ever deleted by the upgrade       |
| High       | Saving a moved due date fails                         | the task keeps its previous date, and the row says "Could not save"    |
| Normal     | The due date of a repeating task is moved by hand     | the schedule restarts from the new date: this is how users skip a date |
| Normal     | A monthly task due on the 29th to 31st                | due on the last day of shorter months, and back on its day after       |
| Normal     | A repeating task is deleted                           | it is deleted, which ends the repetition                               |
| Niche      | A title made only of a repeat phrase, "every monday"  | it is kept as a title, without a repeat                                |

## Success criteria

- **SC-001** (two clicks): Setting a preset repeat takes two clicks from the open task.
- **SC-002** (no slower): Rendering a list of 5,000 tasks is not slower than before the feature.
- **SC-003** (every phrase): The title parser recognizes every phrase in its list, and leaves every
  other title unchanged.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- The presets are those of Microsoft To Do, plus weekends: daily, weekdays, weekends, weekly,
  monthly, yearly ([discovery](discovery-01.md#microsoft-to-do)).
- The title parser reads every title typed, at creation and on edit. It knows English phrases only,
  at the end of the title: "every day", "every weekday", "every weekend", "every week", "every
  month", "every year", "every N days", "every N weeks", "every N months", and "every" followed by
  day names.
- The confirmation after a completion shows for 5 seconds, in the task row itself: no new global
  component. A failed save shows "Could not save" in the same place.

## Constitution check

| I. Simple for non-technical users | II. Local first | III. Fast with thousands of tasks |
| --------------------------------- | --------------- | --------------------------------- |
|                ✅                 |       ✅        |                ✅                 |

## Risk tier

**High**: it changes the format of every saved due date, in an app with no backup of users' data.
