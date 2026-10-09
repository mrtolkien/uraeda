---
status: auto-approved
---

# Plan: Recurring tasks

Implements the design of [the spec](spec.md).

## Files

- `src/lib/dates.ts`, new: `toCalendarDay`, `addPeriod`, and `nextDueDate`, on `YYYY-MM-DD` strings
- [`src/lib/dates.test.ts`](/src/lib/dates.test.ts), new: unit tests for the date helpers
- [`src/store/upgrades.ts`](/src/store/upgrades.ts): upgrade 2, converting saved due dates and
  adding `repeat`
- [`src/store/tasks.ts`](/src/store/tasks.ts): `Task` type, `completeTask` and `uncompleteTask`
- [`src/store/tasks.test.ts`](/src/store/tasks.test.ts): completion, undo, and upgrade tests
- [`src/components/EditPanel.tsx`](/src/components/EditPanel.tsx): the repeat menu, on `Select`
- [`src/components/TaskRow.tsx`](/src/components/TaskRow.tsx): the repeat icon
- [`src/components/icons.tsx`](/src/components/icons.tsx): a repeat icon

## Constitution check

| Principle or decision             | Complies | Notes                                     |
| --------------------------------- | -------- | ----------------------------------------- |
| I. Simple for non-technical users | yes      | One menu, existing edit panel             |
| II. Local first                   | yes      | No network calls                          |
| III. Fast with thousands of tasks | yes      | Benchmark run in step 4                   |
| Task storage                      | yes      | Store upgrade 2, tested on version 1 data |
| UI components                     | yes      | Menu built on the existing `Select`       |
| Due dates                         | yes      | All arithmetic in `src/lib/dates.ts`      |

## Complexity tracking

None.

## Steps

Each step is one commit with its tests. Check its box in the same commit.

- [x] 1. Date helpers and `nextDueDate`, with the edge cases. Tests: US2 scenarios 1 to 3, month-end
      edge case
- [x] 2. Store upgrade 2: calendar day due dates and the `repeat` field. Tests: upgrade of version 1
      data, including unreadable due dates
- [ ] 3. Repeat menu and icon. Tests: US1 scenarios 1 and 2
- [ ] 4. `completeTask` creates the next occurrence, undo removes it. Tests: US2 scenario 1, undo
      edge case, list benchmark for SC-002
