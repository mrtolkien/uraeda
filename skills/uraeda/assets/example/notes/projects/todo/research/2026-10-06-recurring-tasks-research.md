---
description: Recurring tasks: what the research found, in one page, with the wiki notes it wrote
feature: 2026-10-06-recurring-tasks
checked: 2026-10-07
---

# Research: Recurring tasks

Every product that repeats tasks answers the same five questions: how you pick a repeat, when the
next one appears, which date it counts from, whether one occurrence can differ, and when it ends.
The products differ most on the first and the fourth. The surprise was in our own code: due dates
are stored in a way that breaks as soon as the app adds days to them.

The findings behind each question, with their sources, are in git:
`specs/2026-10-06-recurring-tasks/discovery-01.md`.

## What we learned

- **Products pick a repeat in three ways**: a menu of presets, a rule you type, or a custom screen.
  The comparison is in [[recurring-dates]].
- **Todoist keeps one task and moves its date** when you complete it, so the list never grows and
  past completions leave it: [[todoist]].
- **Editing one occurrence is what makes calendars complicated.** They store it as an exception to
  the rule, and ask "this one, the following, or all" at every edit: [[recurring-dates]].
- **Adding 7 days to a due date can give the wrong day**, twice a year, with the dates the app
  stores today: [[javascript-date-24-hours-is-not-a-day]].
- **The date library we already have adds months correctly**: [[date-fns]].

## Round 01, 2026-10-07

- **Looked at**: Microsoft To Do, Todoist, Google Calendar and Google Tasks, the iCalendar standard
  and its `rrule` library, date-fns, and the Temporal API.
- **Could not check**: how Google Tasks and Microsoft To Do edit one occurrence, since their help
  pages do not say, and how often users would need "every 2 weeks".
