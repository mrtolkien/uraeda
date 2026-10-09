---
status: awaiting-human
---

# Assessment: Completed tasks reappear after reload

> [!IMPORTANT]
>
> Assessment to review, about 5 minutes.
>
> - Root cause: a new task is saved up to a second after its creation, from a copy that overwrites
>   any change made in between.
> - Beyond the report: a rename or a new due date in that second is lost too. The fix covers them.
> - The fix changes how every new task is saved, and keeps creating many tasks as fast as today.

A task completed in the second after its creation is completed again in the database, then
overwritten by the creation's delayed save, which still says `done: false`. The fix saves each new
task as it is when the save runs, not as it was when it was created. See [the report](report.md).

## Reproduction

The report's steps fail every time when the task is completed less than one second after its
creation, and never after. A second test shows that a rename in that second is lost the same way.

```tsx
// tests/bugs/completed-tasks-reappear.test.tsx
test("a task completed right after its creation stays completed after a reload", async () => {
  const { user } = await renderApp();
  await addTask(user, "Buy milk");
  await user.click(completeBox("Buy milk"));

  await vi.advanceTimersByTimeAsync(1000);
  await reloadApp();

  expect(completeBox("Buy milk")).toBeChecked();
});

test("a task renamed right after its creation keeps its new name after a reload", async () => {
  const { user } = await renderApp();
  await addTask(user, "Buy milk");
  await editTitle(user, "Buy milk", "Buy oat milk");

  await vi.advanceTimersByTimeAsync(1000);
  await reloadApp();

  expect(row("Buy oat milk")).toBeVisible();
});
```

- Run: `npx vitest run tests/bugs/completed-tasks-reappear.test.tsx`
- Result: FAIL, `expected element to be checked`, then
  `Unable to find an element with the text: Buy oat milk`.

## Root cause

1. [`createTask`](/src/store/tasks.ts) adds the task to the store's memory, which the list shows,
   and queues a copy of it, with `done: false`, in `pendingCreations`.
2. One second after the first queued creation, `flushCreations` writes every queued copy to
   IndexedDB in one transaction. It was added after feature 001, in `perf(store): batch new tasks`
   (`git log -S flushCreations -- src/store/tasks.ts`), to keep creating many tasks fast, as the
   constitution asks: one transaction for many tasks instead of one each.
3. [`completeTask`](/src/store/tasks.ts) writes at once. In that second, its write lands first, then
   the queued copy overwrites it.
4. The list still shows the task in memory, completed. After a reload, it reads the database, where
   the task is not completed.

Confirmed by queueing the task's id instead of a copy, with `flushCreations` reading the task from
memory when it runs: both tests pass, and no other test fails.

## Fix

`pendingCreations` holds task ids, and `flushCreations` saves each task as it is in memory when it
runs. A task deleted in that second is skipped. New tasks are still saved together, so creating many
tasks stays as fast as today.

**Files:**

- Modify: `src/store/tasks.ts` (`createTask`, `flushCreations`)
- Modify: `tests/helpers/app.tsx` (`reloadApp(): Promise<void>`, which unmounts the app, empties the
  store's memory, and renders the app again on the same database)
- Test: `tests/bugs/completed-tasks-reappear.test.tsx`

- [ ] **Step 1: Record the benchmark baseline**

- Run: `npx vitest bench --run --outputJson bench/baseline.json`
- Expected: `bench/baseline.json` written, before any change.

- [ ] **Step 2: Add the failing tests**

- Run: `npx vitest run tests/bugs/completed-tasks-reappear.test.tsx`
- Expected: FAIL, `expected element to be checked`.

- [ ] **Step 3: Fix the root cause**

`pendingCreations: Set<string>`, of task ids. `flushCreations` reads each id from memory, and writes
the tasks it finds in one transaction.

- [ ] **Step 4: Run all tests, and the benchmark**

- Run: `npx vitest run && npx vitest bench --run --compare bench/baseline.json`
- Expected: PASS, and no benchmark slower than the baseline beyond its margin of error.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(completed-tasks-reappear): save new tasks as they are when the save runs"
```
