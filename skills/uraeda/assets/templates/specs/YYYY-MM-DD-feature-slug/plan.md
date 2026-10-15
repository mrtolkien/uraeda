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

**Architecture:** [the approach, ownership of changed rules, state, and resources, and the
boundaries tasks rely on. Scale the detail to the change. See the
[spec's architecture](spec.md#architecture).]

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **[An input or failure mode the spec does not mention]** [the behaviour a reasonable person would
   expect]. Task [N].

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these:

- [An approved rule, copied word for word with its source; or an existing guarantee, described with
  links to its code and tests. Use an approval comment where it explicitly replaces a spec clause.]

## Code read

- [`path`](/path): [what it showed: the test setup and layout, the readers, writers, and entry
  points affected by the change]

## Constitution check

| Principle      | Complies | Notes |
| -------------- | -------- | ----- |
| I. [Principle] | yes      |       |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Topic](../decisions/decision-topic.md): [how the plan follows it (task N)]

## Complexity tracking

[Every new abstraction: a type, module, layer, wrapper, or helper shared by several parts, tests
included, even when the spec's architecture or details introduced it. Every function or file a task
grows past the project's limits, or leaves over them. Every constitution exception: one the human
accepted in the questions, or a new marker on code over a limit, for the plan's review to approve.
Name the callers, shared rule, or approved variation that needs each one, and the simpler
alternative rejected. "None." otherwise.]

| Abstraction or exception | Why it is needed | Simpler alternative rejected because |
| ------------------------ | ---------------- | ------------------------------------ |

## Review comments

[Optional: only when the spec was approved with comments, each comment of `spec-review.md`, and the
task that carries it out. State which spec clause it supersedes when it explicitly changes one.]

---

## Task 1: [Component or deliverable]

**Files:**

- Start from: [Optional: for a view whose mockups are the project's own stories, the picked story,
  `path#Export`, whose component this task starts from]
- Create: `exact/path`
- Modify: `exact/path` ([function or lines])
- Test: `tests/exact/path`

**Interfaces:**

- Consumes: [what this task uses from earlier tasks, with exact signatures]
- Produces: [what callers or later tasks rely on: exact names, parameters, return types, and
  behaviour. Private helpers and internal decomposition remain implementation choices.]

- [ ] **Step 1: [Only when the task touches a unit over the project's limit.] Split `[unit]` before
      it changes**

[How to restructure the unit without changing what it does, and its marker to remove.]

- Run: `[the tests and the check of the limits]`, before and after the split
- Expected: PASS both times, [with no unused marker]

```bash
git add [the restructured files]
git commit -m "refactor([number]): [the restructuring]"
```

- [ ] **Step 2: Write the failing tests, and the helpers they use**

```ts
// tests/exact/path
test("[the scenario, in words]", async () => {
  // Arrange, with the shared helpers
  // Act
  // Assert, with values derived from the approved behaviour, independently of implementation
});
```

The break each test catches:

- [The test, in a few words]: [the realistic mistake that makes it fail].

- [ ] **Step 3: Run them to check they fail**

- Run: `[command]`
- Expected: FAIL, [the first failure the run will hit].

- [ ] **Step 4: Implement**

[Responsibilities, files, the values the spec pins, and exact signatures for public and cross-task
contracts. Explain an algorithm when correctness depends on it; leave private implementation choices
to the implementer.]

- [ ] **Step 5: Run all tests[, and the benchmark]**

- Run: `[command]`
- Expected: PASS[, and no benchmark slower than its baseline beyond the tolerance the spec sets].

- [ ] **Step 6: Commit**

```bash
git add [the files of this task]
git commit -m "feat([number]): [what this task delivers]"
```
