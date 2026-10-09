---
status: [awaiting-human | auto-approved]
spec-revision: [the spec's revision]
---

# Plan: [Feature name]

> [!IMPORTANT]
>
> [Only when the plan waits for a review.] Plan to review, about [M] minutes.
>
> - [Where your attention matters most, one line each: the review focus, new dependencies, the order
>   of risky tasks]

**Goal:** [one sentence on what the feature builds]

**Architecture:** [two or three sentences on the approach. See the [spec's design](spec.md#design).]

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **[Input or failure mode]**: [the behaviour a reasonable person would expect]. Task [N].

## Global constraints

From the decisions and the spec, every task's requirements include these:

- [A rule, format, limit, or exact text, copied word for word, with its source]

## Code read

- [`path`](/path): [what it showed: the test setup and layout, the places that read changed data]

## Constitution check

| Principle      | Complies | Notes |
| -------------- | -------- | ----- |
| I. [Principle] | yes      |       |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Topic](../decisions/decision-topic.md): [how the plan follows it (task N)]

## Complexity tracking

[Every new abstraction: a type, module, layer, wrapper, or helper shared by several parts, tests
included, even when the spec's design introduced it. Every constitution exception the human
accepted. "None." otherwise.]

| Abstraction or exception | Why it is needed | Simpler alternative rejected because |
| ------------------------ | ---------------- | ------------------------------------ |

---

## Task 1: [Component or deliverable]

**Files:**

- Create: `exact/path`
- Modify: `exact/path` ([function or lines])
- Test: `tests/exact/path`

**Interfaces:**

- Consumes: [what this task uses from earlier tasks, with exact signatures]
- Produces: [what later tasks rely on: exact names, parameters, and return types]

- [ ] **Step 1: Write the failing tests**

```ts
test("[the scenario, in words]", async () => {
  // Arrange, with the shared helpers
  // Act
  // Assert, with the spec's exact values
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `[command]`
- Expected: FAIL, [the expected failure].

- [ ] **Step 3: Implement**

[Exact signatures and files, the values the spec pins, and one line on the approach when the
signature and tests leave a choice.]

- [ ] **Step 4: Run all tests**

- Run: `[command]`
- Expected: PASS[, and the benchmark result].

- [ ] **Step 5: Commit**

```bash
git commit -m "feat([number]): [what this task delivers]"
```
