---
status: awaiting-human
---

# Assessment: Completed tasks reappear after reload

> [!IMPORTANT]
>
> Assessment to review, about 5 minutes.
>
> - Root cause: creating and completing a task race in two separate database transactions.
> - The fix changes how the store saves every task, so it touches all features.

Assesses [the report](report.md).

## Reproduction

Reproduced in a test that completes a task before its creation is saved: `src/store/tasks.test.ts`,
"keeps a task completed right after its creation".

## Root cause

[`createTask`](/src/store/tasks.ts) and [`completeTask`](/src/store/tasks.ts) open separate
IndexedDB transactions. When the task is completed before the creation is saved, the creation
finishes last and writes the task back with `done: false`.

## Suggested fix

Queue writes per task id in the store, so a task's writes are saved in the order they were made. The
test above then passes.

## Questions

None.
