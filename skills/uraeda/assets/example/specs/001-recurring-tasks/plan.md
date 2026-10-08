---
status: auto-approved
---

# Plan: Recurring tasks

Implements [the spec](spec.md).

## Summary

Add a `repeat` field to tasks, a repeat dropdown to the edit panel, and a pure function that
computes the next due date. Completing a repeating task creates its next occurrence in the same
IndexedDB transaction.

## Technical context

- **Language and version**: TypeScript 5, React 19
- **Dependencies**: none added, dates use the existing `date-fns`
- **Storage**: IndexedDB, through the [task store](/src/store/tasks.ts)
- **Testing**: Vitest for logic and components, the existing list benchmark for SC-002
- **Constraints**: stored tasks without `repeat` must keep working

## Data changes

`Task` gets `repeat: "never" | "daily" | "weekly" | "monthly"`, and `createdFrom?: string`, the id
of the occurrence it was created from. Tasks stored without `repeat` are read as `"never"`: no
migration.

## Constitution check

| Principle or decision               | Complies | Notes                             |
| ----------------------------------- | -------- | --------------------------------- |
| I. Simple for non-technical users   | yes      | One dropdown, existing edit panel |
| II. Local first                     | yes      | No network calls                  |
| III. Fast with thousands of tasks   | yes      | Benchmark run in step 4           |
| 0001. Tasks are stored in IndexedDB | yes      | Same store, one transaction       |
| 0003. Recurring tasks use presets   | yes      | Union type of the three presets   |
| 0004. Next occurrence on completion | yes      | Created in `completeTask`         |

## Project structure

```sh
src/
  store/tasks.ts           # repeat field, completeTask creates the next occurrence
  lib/next-due-date.ts     # new: pure next due date computation
  components/EditPanel.tsx # repeat dropdown
  components/TaskRow.tsx   # repeat icon
```

## Complexity tracking

None.

## Steps

Each step is one commit with its tests. Check its box in the same commit.

- [x] 1. `nextDueDate` function, with the edge cases. Tests: US2 scenarios 1 to 3, edge cases 1 and
      2
- [x] 2. `repeat` field in the store, read as `"never"` when missing. Tests: FR-001
- [ ] 3. Repeat dropdown and icon. Tests: US1 scenarios 1 and 2
- [ ] 4. `completeTask` creates the next occurrence, undo removes it. Tests: US2 scenario 1, edge
      case 3, list benchmark for SC-002
