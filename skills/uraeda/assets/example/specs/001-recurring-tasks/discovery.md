# Discovery: Recurring tasks

Findings and options for [the proposal](proposal.md), in the code and outside it. Decisions come
from the human's answers in [clarifications](clarifications.md).

## Session 2026-10-07

### Code

Important reads:

- [Task store](/src/store/tasks.ts): tasks are `{ id, title, done, dueDate }`, with `dueDate` a
  timestamp at local midnight. `createTask` and `completeTask` each open their own IndexedDB
  transaction.
- [Store upgrades](/src/store/upgrades.ts): the database is at version 1, with no upgrade yet.
- [Edit panel](/src/components/EditPanel.tsx): title and due date fields, built with the project's
  [`Select`](/src/components/Select.tsx) and date input.
- [Task row](/src/components/TaskRow.tsx): shows the title, the due date, and a done checkbox. Icons
  come from [`icons.tsx`](/src/components/icons.tsx).
- [`package.json`](/package.json): `date-fns` 4 is already a dependency, used only to format dates.
- [List benchmark](/bench/list.bench.ts): renders 5,000 tasks, the reference for the constitution's
  performance principle.

Likely changes:

- [`src/store/tasks.ts`](/src/store/tasks.ts): a repeat field, and `completeTask` creating the next
  occurrence in the same transaction
- [`src/store/upgrades.ts`](/src/store/upgrades.ts): an upgrade to version 2 for the new field, and
  for due dates if their format changes
- `src/lib/dates.ts`, new: next due date computation, kept out of the store so it can be tested
  without IndexedDB
- [`src/components/EditPanel.tsx`](/src/components/EditPanel.tsx) and
  [`src/components/TaskRow.tsx`](/src/components/TaskRow.tsx): the repeat setting and its icon

### Recurrence rules

What needs deciding: how users choose when a task repeats.

Findings:

- Microsoft To Do offers presets in a menu: daily, weekdays, weekly, monthly, yearly, and custom
  ([Microsoft support](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do)).
- Todoist uses typed text, like "every 3 months" or "every!"
  ([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)).
  Powerful, but it has to be learned.
- Calendars use the iCalendar recurrence rule (`RRULE`,
  [RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10)). The
  [`rrule`](https://github.com/jkbrzt/rrule) library implements it in JavaScript, but its options
  (by day, by set position, ...) need a dedicated settings screen to be usable.

| Option              | Simple for users                   | Covers needs                 | Effort                           |
| ------------------- | ---------------------------------- | ---------------------------- | -------------------------------- |
| A. Presets          | One menu, nothing to learn         | No "every 2 weeks"           | Small                            |
| B. Presets + custom | A second, technical-looking screen | Almost everything            | Medium, or a new dependency      |
| C. Typed text       | Has to be learned, errors confuse  | Everything the parser covers | Large: parser and error messages |

### Generating occurrences

What needs deciding: when the next occurrence of a repeating task appears.

Findings:

- The app only runs while it is open: there is no service worker or background process
  ([app entry point](/src/main.ts)).
- Todoist keeps a single task: completing it moves its due date to the next occurrence
  ([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)). The
  list never grows, but past completions disappear from it.

| Option                 | Simple for users                    | Fast with thousands of tasks | Effort                         |
| ---------------------- | ----------------------------------- | ---------------------------- | ------------------------------ |
| A. On completion       | One task at a time                  | No growth                    | Small                          |
| B. In advance, N ahead | Upcoming tasks visible, longer list | N × more repeating tasks     | Medium: editing a whole series |

### Next due date

What needs deciding: which date the next occurrence's due date is counted from.

Findings:

- Todoist offers both: "every" counts from the previous due date, "every!" from the day the task was
  completed. When a task is overdue past its next date, Todoist moves it to the next date in the
  future
  ([Todoist help](https://todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)).

| Option               | Predictable schedule              | Simple for users  |
| -------------------- | --------------------------------- | ----------------- |
| A. From the due date | Yes: Monday tasks stay on Mondays | Nothing to choose |
| B. From completion   | No: drifts when done late         | Nothing to choose |
| C. User chooses      | Depends                           | One more setting  |

### Date handling

What needs deciding: how due dates are stored and computed, now that the app does date arithmetic.

Findings:

- Due dates are timestamps at local midnight. Adding 7 × 24 hours across a daylight saving change
  gives 23:00 the day before, so a weekly task would show up a day early twice a year.
- Native `Date.setMonth` overflows: January 31 plus one month gives March 2 or 3
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setMonth)).
  date-fns' `addMonths` gives the last day of February instead
  ([date-fns docs](https://date-fns.org/docs/addMonths)).
- The Temporal API has a real calendar date type. It shipped in Firefox 139 and Chrome 144, but not
  in Safari, so not on iPhones
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)).
  The official polyfill works everywhere, but adds to the bundle.

| Option                         | Correct dates                                 | Effort                          | Bundle    |
| ------------------------------ | --------------------------------------------- | ------------------------------- | --------- |
| A. Calendar days + date-fns    | Yes                                           | One-time upgrade of saved tasks | No change |
| B. UTC timestamps              | A task due Monday shows as Sunday west of UTC | Upgrade of saved tasks          | No change |
| C. Temporal, with the polyfill | Yes                                           | Upgrade, and a new dependency   | Larger    |

### Not checked

- Google Tasks' repeat options: its help pages did not describe them clearly enough to compare.
- How often users would need "every 2 weeks": the app collects no usage data, by design.
