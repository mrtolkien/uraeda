# Research: Recurring tasks

Findings and options for [the proposal](proposal.md). Decisions come from the human's answers in
[clarifications](clarifications.md).

## Session 2026-10-07

### Recurrence rules

Tasks are stored as `{ id, title, done, dueDate }` in IndexedDB ([store](/src/store/tasks.ts)).
There is no recurrence field yet. Popular todo apps offer either presets or full calendar rules (RFC
5545 `RRULE`).

| Option             | Pros                        | Cons                                        |
| ------------------ | --------------------------- | ------------------------------------------- |
| A. Presets         | One dropdown, easy to test  | No "every 2 weeks"                          |
| B. Presets + rules | Covers most needs           | A second, technical-looking settings screen |
| C. Free text       | Flexible, no extra controls | Needs a parser, errors are confusing        |

Sources:

- [Task store](/src/store/tasks.ts)
- [RFC 5545, recurrence rule](https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10)

### Generating occurrences

The app has no background process: it only runs while open.

| Option                  | Pros                              | Cons                                               |
| ----------------------- | --------------------------------- | -------------------------------------------------- |
| A. On completion        | Simple, no scheduling, short list | The next task only exists once the current is done |
| B. In advance (N ahead) | Users see upcoming tasks          | Long lists, harder to edit a series                |

Sources:

- [App entry point](/src/main.ts)

### Date handling

`dueDate` is a timestamp at local midnight ([store](/src/store/tasks.ts)). Adding 7 × 24 hours
across a daylight saving change gives 23:00 the day before, so a weekly task drifts by a day twice a
year. Reminders, next in the priorities, will compute dates too.

| Option                  | Pros                                | Cons                                          |
| ----------------------- | ----------------------------------- | --------------------------------------------- |
| A. Calendar day strings | No timezone or daylight saving bugs | One-time upgrade of stored tasks              |
| B. UTC timestamps       | Exact instants                      | A task due Monday shows as Sunday west of UTC |
| C. Temporal API         | The right model for dates and times | Not available in all supported browsers yet   |

Sources:

- [Task store](/src/store/tasks.ts)
- [Temporal API, browser support](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
