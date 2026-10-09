---
status: awaiting-human
---

# Assessment: [Bug title]

> [!IMPORTANT]
>
> Assessment to review, about [M] minutes.
>
> - [The root cause, in one line]
> - [What the fix changes beyond the bug, its risk, and any question]

[Two or three sentences: what goes wrong, why, and how the fix solves it at its source. See
[the report](report.md).]

## Reproduction

[The report's steps, as confirmed, and what makes the bug happen or not: timing, order, data.]

```ts
test("[the scenario, in words]", async () => {
  // Arrange, with the shared helpers
  // Act, the report's steps
  // Assert the expected behaviour
});
```

- Run: `[command]`
- Result: FAIL, [the failure the run hit].

## Root cause

[The chain from what the user does to what they see, step by step, with links to the code. Where the
wrong value first appears, and how the hypothesis was confirmed.]

## Fix

[The change at the root cause, and what else it changes for users.]

**Files:**

- Modify: `exact/path` ([function or lines])
- Test: `tests/exact/path`

- [ ] **Step 1: Add the failing test**

- Run: `[command]`
- Expected: FAIL, [the failure above].

- [ ] **Step 2: Fix the root cause**

[Exact signatures and files, and one line on the approach when they leave a choice.]

- [ ] **Step 3: Run all tests**

- Run: `[command]`
- Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix([slug]): [what the fix does]"
```

## Q1: [Question]

[Optional: only for what the human must decide, like an expected behaviour the report leaves open.
Two or three sentences of context, then why it matters.]

- **A (recommended). [A self-contained sentence.]**
  - [pro] [...]
  - [con] [...]
  - Why recommended: [...]
- **B. [Same.]**
  - [pro] [...]
  - [con] [...]

**Answer:**
