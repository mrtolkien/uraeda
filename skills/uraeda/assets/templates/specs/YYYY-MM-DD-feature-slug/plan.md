---
status: [awaiting-human | auto-approved]
spec-revision: [the spec's revision]
---

# Plan: [Feature name]

> [!IMPORTANT]
>
> [Only when the plan waits for a review.] Plan to review, about [M] minutes.
>
> - [Where the plan goes beyond the spec, one line each: the review focus, a new dependency, a new
>   lint marker, the order of risky tasks]

**Goal:** [one sentence on what the feature builds]

**Architecture:** [the approach, who owns each changed rule, state, and resource, and the boundaries
tasks rely on. See the [spec's architecture](spec.md#architecture).]

**Spec:** [spec.md](spec.md)

## Review focus

[Optional: the conditions the spec implies but does not name, which the build must still get right,
each with the task that covers it.]

1. **[An input or sequence the spec does not mention]** [what must happen]. Task [N].

## Global constraints

What every task must keep, each with its source. Only the rules a task could break: link the rest.

- [An approved rule, word for word, from a decision, the spec, or an approval comment that replaces
  a spec clause.]
- [An existing guarantee the change must preserve, with a link to its code or test.]
- [**Out of validation**, only when the feature replaces code: the suites of the replaced code,
  which nothing runs from the task that freezes it to the one that removes it.]

## Code read

[Optional: what the next agent could not find fast: the test setup, the validation commands, and
every reader and writer of the data that changes, each with a link.]

- [`path`](/path): [what it showed]

## Constitution check

[Optional: only when a principle is in tension. One line per tension, and what it costs.]

## Complexity tracking

[Optional: only when there is one. Each new abstraction shared by several parts, each unit a task
grows past the project's limits or marks, and each constitution exception the human accepted, with
why it is needed and the simpler alternative rejected.]

| Abstraction or exception | Why it is needed | Simpler alternative rejected because |
| ------------------------ | ---------------- | ------------------------------------ |

## Review comments

[Optional: only when the spec was approved with comments, each comment of `spec-review.md`, named by
its subject, and the task that carries it out.]

## Test map

[How the tests run: what they render, on which store, with which clock, and which use a real
boundary.] Each scenario, edge case, and criterion of the spec, with the task and test that own it,
or "none" and why.

| Spec                                                      | Task | Test                       |
| --------------------------------------------------------- | ---- | -------------------------- |
| [US1 1, 2; an edge case; SC-001; Review focus: a subject] | [N]  | [`tests/exact/path`, what] |
| [US2 3: a scenario the project's stage asks no test for]  | none | [why]                      |

## Waves

1. Task 1: [why it comes alone, such as a data change every later task builds on]
2. Tasks [2] and [3]: [the different parts of the code each touches, and any shared file each adds
   its own part to]

---

## Task 1: [Component or deliverable]

**Risky:** [Optional: for a task that changes security, the format of stored data or its migration,
concurrency, or a rule several callers share, what makes it risky. It is reviewed on its own.]

**Files:**

- Start from: [Optional: for a view whose mockups are the project's own stories, the picked story,
  `path#Export`, whose component this task starts from]
- Create: `exact/path`
- Modify: `exact/path` ([function])
- Test: `tests/exact/path`

**Interfaces:**

- Consumes: [what this task uses from earlier tasks, with exact names and signatures]
- Produces: [what later tasks rely on: exact names, parameters, return types, and behaviour]

- [ ] **Split first: [Optional: only when the task touches a unit over the project's limit]**

[The unit, how to split it without changing what it does, and its marker to remove. The tests pass
before and after. Its own commit: `refactor([slug]): [the restructuring]`.]

- [ ] **Tests**

[Each test by name, with the values the spec pins and the break it catches. Code only where an
assertion is not obvious from that. The helpers the tests need.]

- `[the scenario, in words]`: [given, act, expected value]. Catches [the realistic mistake].

- [ ] **Implement**

[The responsibility, the values the spec pins, and an algorithm only when correctness depends on it.
Private structure is the implementer's.]

- [ ] **Use it: [Optional: only when the task builds something a user acts on]**

[The act to do in the running product, and the effect to see.]

- [ ] **Validate and commit**

- Run: `[the task's validation command]`[, and the benchmark against its baseline]
- Commit: `feat([slug]): [what this task delivers]`
