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
