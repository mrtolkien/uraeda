---
status: answered
---

# Clarifications: Recurring tasks

Answer each question with an option letter, `yes` to accept the recommendation, or your own short
answer. Then set `status: answered` and commit.

## Session 2026-10-07

### Q1: How should users choose when a task repeats?

Why it matters: this decides how complex the repeat settings screen is.

**Recommended:** Option A - presets cover most needs and keep the UI simple for non-technical users.
See [research](research.md#recurrence-rules).

| Option | Description                                       |
| ------ | ------------------------------------------------- |
| A      | Presets: daily, weekly, monthly                   |
| B      | Presets plus custom rules (every N days, ...)     |
| C      | Free text, parsed by the app ("every 2nd Monday") |

**Answer:** yes

### Q2: When does the next occurrence appear?

Why it matters: this decides whether users see future tasks in their list.

**Recommended:** Option A - the list stays short, and nothing runs while the app is closed. See
[research](research.md#generating-occurrences).

| Option | Description                                           |
| ------ | ----------------------------------------------------- |
| A      | When the current task is completed                    |
| B      | In advance: the next 4 occurrences are always visible |

**Answer:** A

### Q3: What happens to the due date of the next occurrence?

Why it matters: a task completed late could otherwise drift, for example a weekly Monday task that
becomes a Thursday task.

**Recommended:** Option A - the schedule stays the same, whenever the task is completed.

| Option | Description                                         |
| ------ | --------------------------------------------------- |
| A      | Next due date follows the previous due date         |
| B      | Next due date follows the day the task is completed |

**Answer:** A, but if that date is already past, use the next one in the future.

### Q4: How should the app store due dates?

Why it matters: this affects every feature with dates. Today, weekly tasks would show up a day early
twice a year, after daylight saving changes.

**Recommended:** Option A - calendar days avoid timezone bugs for good, and the upgrade of stored
tasks is small. See [research](research.md#date-handling).

| Option | Description                                            |
| ------ | ------------------------------------------------------ |
| A      | Calendar days (`2026-10-12`), without a time           |
| B      | UTC timestamps                                         |
| C      | The Temporal API, once it is available in all browsers |

**Answer:** yes
