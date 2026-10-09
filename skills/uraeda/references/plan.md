# Plan

Turns the approved spec into an implementation plan: bite-sized tasks, each with its exact files,
interfaces, failing tests as code, commands, and commit, written for an agent who has seen neither
the codebase nor the spec.

- **Runs when**: `spec.md` is `approved` and its decisions are active, and there is no `plan.md`, or
  its `spec-revision` is lower than the spec's `revision`; or `plan.md` is `changes-requested`
- **Writes**: `plan.md`, `rulings.md` when there are rulings, and `data-model.md` or `contracts/`
  when needed
- **Ends at**: a human gate (`awaiting-human`), the [implementation](implementation.md) step
  (`auto-approved`), or, rarely, a new round of questions (see
  [Stopping to go back to the human](#stopping-to-go-back-to-the-human))

Read this file in full before writing. Beyond the tasks, the plan holds the parts an asynchronous,
file-based workflow needs: the review block, the code read, the constitution check, the decisions,
and complexity tracking.

## Overview

Write the plan for an engineer who has not seen this codebase or this spec. Assume they write
idiomatic code in the project's language once they know the exact interface and the exact test, and
that they will make a reasonable choice wherever the plan leaves one open. What they cannot know is
what you decided: which files, which names and signatures, which values from the spec, which tests
prove each task. Document those. Give them the whole plan as bite-sized tasks. DRY. YAGNI. Tests
first. Frequent commits.

In Uraeda, this is literally true: the implementation runs later, often in another session, often by
another agent, and each task may go to a fresh agent that sees only that task. Anything you leave
out, they guess.

## Read first

1. `spec.md` in full, especially its **Design**, **Testing**, and **Assumptions**, and the decisions
   it lists.
2. The constitution, and the active decisions that apply to the code you will touch, as they are
   now: a human may have changed one since the spec was approved. If one now conflicts with the
   spec, start a new round of questions, following
   [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).
3. The discovery files of every round: their map of the code is your starting point.
4. The code itself: its structure and patterns, the test setup and existing helpers, every place
   that reads or writes data the feature changes, and the commands that validate the project
   (formatter, linter, type checker, tests, benchmarks). Read it: do not plan from the discovery's
   summary alone.

If `spec.md` still opens with a `> [!IMPORTANT]` block, the approval step did not run, for example
because the spec proposes no decision: turn the block into a record, as described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human), in the plan's commit.

## Scope check

If the spec covers several independent subsystems, it should have been split before approval. If it
was not, do not write one plan for all of them: stop, as described in
[Stopping to go back to the human](#stopping-to-go-back-to-the-human), with a question proposing the
split, the recommended split as option A. Each plan must produce working, testable software on its
own.

## File structure

Before defining tasks, map out which files will be created or modified, and what each one is
responsible for. This is where the decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file has one clear
  responsibility.
- You reason best about code you can hold in context at once, and edits are more reliable when files
  are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together live together. Split by responsibility, not by technical layer.
- In an existing codebase, follow its established patterns. If it uses large files, do not
  restructure it unilaterally; but if a file you are modifying has grown unwieldy, a targeted split
  in the plan is reasonable.
- Tests are code too. They follow the project's test layout, and share helpers, fixtures, and fakes
  (rendering the app, seeding the store, setting the clock), so each test stays a few lines long.
  The spec's [Tests](spec.md#tests) rules apply: integration tests by default, Arrange, Act, Assert.

This structure informs the task decomposition. Each task produces self-contained changes that make
sense on their own.

## Task right-sizing

A task is the smallest unit that carries its own test cycle and is worth a fresh reviewer's gate.
When drawing task boundaries:

- Fold setup, configuration, scaffolding, test helpers, and documentation into the task whose
  deliverable needs them. A helper is created in the first task whose tests use it.
- Split only where a reviewer could meaningfully reject one task while approving its neighbour.
- Order the tasks so each one is built and tested on what the earlier ones made: data changes come
  before the code that relies on them.
- Each task ends with an independently testable deliverable, and leaves the project working.

## Step granularity

Each step is one action with a checkable result:

- "Write the failing tests" is a step.
- "Run them to check they fail" is a step.
- "Implement the code that makes them pass" is a step.
- "Run all tests" is a step.
- "Commit" is a step.

## Plan document

Use [the template](../assets/templates/specs/000-feature-name/plan.md). Every plan has this
frontmatter and these sections, in this order:

```markdown
---
status: [awaiting-human | auto-approved]
spec-revision: [the spec's revision]
---

# Plan: [Feature name]

> [!IMPORTANT]
>
> [Only when the plan waits for a review: see "Set the status".]

**Goal:** [One sentence on what this builds]

**Architecture:** [Two or three sentences on the approach, linking to the spec's design]

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

[The five input classes or failure modes the spec implies but no task's tests would otherwise
exercise, most likely to bite a person using this software first, one line each: the input or
condition, the behaviour a reasonable person would expect, and the task whose tests cover it.]

## Global constraints

[The project-wide rules every task must follow, one line each, copied word for word from the
decisions and the spec, with their source: formats, limits, exact user-facing text, names, timings.
Every task's requirements implicitly include this section.]

## Code read

[The code the plan relies on, with links and what each showed.]

## Constitution check

[Every principle of the constitution, against the plan.]

## Decisions

[Only the decisions the plan relies on, each with where the plan follows it.]

## Complexity tracking

[Every new abstraction, and every constitution exception the human accepted.]

---

[The tasks, in order.]
```

What goes in each section:

- **Review focus**: the spec is a vision document. It says what the software must do, not everything
  it will meet, and its silence on an input is not permission for that input to break the program.
  Write the list here, once, with the spec in front of you. Then, for each line, add the test that
  pins it to the task that owns the code, in that task's own step style. These are the only
  behaviours the plan adds to the spec, which is why they come first, and why the review block
  always mentions them. A review-focus item never narrows a rule of the spec: a new limit, like a
  maximum length or count, is a question for the human, not a review-focus item.
- **Global constraints**: copy, do not paraphrase. When a decision says "Components MUST NOT call
  IndexedDB or the `idb` library directly", the plan says exactly that.
- **Code read**: claims about the code rest on this section. Name the test setup and its layout, the
  validation commands, and every place that reads or writes data the feature changes.
- **Constitution check**: a table with one row per principle, all of them: principles always apply.
  Decisions are not part of it.
- **Decisions**: the decisions that apply to the code this plan touches, not the whole ledger.
- **Complexity tracking**: every new abstraction, meaning a type, module, layer, wrapper, or helper
  shared by several parts, tests included, even when the spec's design introduced it; and every
  constitution exception the human accepted. Each row says why it is needed, and the simpler
  alternative rejected. "None." when there is none.

Add `data-model.md` when the feature adds or changes entities beyond a few fields: fields,
relationships, validation rules, state transitions. Smaller changes stay in the spec's **Data**
section. Add `contracts/` when the feature exposes an interface to users or other systems: API
schemas, CLI commands, file formats, written in the format the project already uses for them.

## Task structure

Every task follows this structure. The steps are checkboxes: the implementation step checks them in
the task's commit, which is how any agent knows how far the work went.

````markdown
## Task N: [Component or deliverable]

**Files:**

- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts` (`functionName`, or lines 123-145)
- Test: `tests/exact/path/to/feature.test.ts`

**Interfaces:**

- Consumes: [what this task uses from earlier tasks, with exact signatures]
- Produces: [what later tasks rely on: exact function names, parameter and return types, and any
  change to the behaviour of an existing function. A task's implementer sees only their own task:
  this block is how they learn the names and types neighbouring tasks use.]

- [ ] **Step 1: Write the failing tests, and the helpers they use**

```ts
// tests/exact/path/to/feature.test.ts
test("a weekly task completed on its due date moves a week later", async () => {
  const { user } = await renderApp({ today: "2026-10-05", tasks: [weeklyTask] });

  await user.click(completeBox("Water the plants"));

  expect(dueDateOf("Water the plants")).toBe("2026-10-12");
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `npx vitest run tests/exact/path/to/feature.test.ts`
- Expected: FAIL, `expected '2026-10-05' to be '2026-10-12'`

- [ ] **Step 3: Implement `completeTask(id: string): Promise<{ previousDueDate: CalendarDay }>` in
      `src/store/tasks.ts`**

[One line on the approach when the signature and the tests leave a choice: which library call, which
data structure. A code block only for an algorithm they do not determine.]

- [ ] **Step 4: Run all tests**

- Run: `npx vitest run`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/tasks.ts tests/exact/path/to/feature.test.ts
git commit -m "feat(001): complete a repeating task"
```
````

Adapt the steps to the task when needed: a first task may record a benchmark baseline before any
change; a task that touches what the constitution says to benchmark runs the benchmark in its last
run step. Keep one action per step.

## What a step contains

A step is done when the implementer can write exactly one reasonable thing from it. That is the
whole requirement: unambiguous, not complete. Each kind of step carries what makes it unambiguous,
and nothing more:

- **A test step**: the tests' names and their assertions, as code, with the spec's exact values in
  them. Integration tests by default, short, Arrange, Act, Assert, on the shared helpers. The step
  also creates the helpers its tests use, so the first failure is about the feature, not a missing
  helper.
- **A run step**: the command to run, and the output that means it worked. For a failing run, the
  first failure the run will actually hit: not "the test fails", but the message.
- **A code step**: the exact signature (name, parameters, return type), the file it lives in, and
  the specific values the spec pins. The implementer writes the body. A body appears only for an
  algorithm the signature and tests do not determine, like date arithmetic, or for exact text the
  spec fixes.
- **A commit step**: the files to add, and the message, following [Commits](../SKILL.md#commits).
- **A reference to another task**: that task's Interfaces block says what to use. The plan does not
  repeat that task's code.

A plan is the set of decisions the implementer cannot make alone. A plan longer than the code it
describes has written the code instead. Lines that decide nothing are the opposite failure: "TBD",
"handle edge cases", "add appropriate validation", "write tests for the above", or a type or
function no task defines. The self-review catches both.

## Self-review

After writing the complete plan, read the spec again with fresh eyes, check the plan against it, and
fix what you find inline. This is a checklist you run yourself.

1. **Spec coverage**: skim each user story, acceptance scenario, edge case, success criterion, line
   of the **Testing** table, and global constraint. Can you point to a task and a test that asserts
   it, exact text and timings included? Add a task for any requirement without one.
2. **Step scan**: every step lets the implementer write exactly one reasonable thing, and no step
   carries more than that. A line that decides nothing is a gap; a function body the signature and
   tests already determine is a transcript. Fix both. An algorithm the tests do not pin down is
   written out.
3. **Expected values**: work out every value a test expects from the plan's own algorithm, by hand.
   Follow each edge case over two consecutive occurrences, not one: a month-end clamp that holds
   once can drift the second time.
4. **Type consistency**: the types, signatures, and names used in later tasks match what earlier
   tasks define. A function called `clearLayers()` in task 3 but `clearFullLayers()` in task 7 is a
   bug. A task that changes the behaviour of an existing function declares it in **Produces**. No
   two functions share a name, test helpers included.
5. **Review focus**: for each input class or failure mode the spec implies, is there a task whose
   tests exercise it? The five uncovered ones most likely to bite a person go in **Review focus**,
   each with its test added to the owning task. An empty section means you checked and found none,
   not that you skipped the check.
6. **Order**: each task can be built and tested with what the earlier tasks made, and each expected
   failure is the first one its run will actually hit.
7. **Proportion**: compare the plan's length to the code it describes. If code blocks are most of
   the document, replace bodies with signatures, test names, and assertions, and check that each
   step is still unambiguous.
8. **The spec itself**: when two of its sections disagree, or an edge case cannot be met with its
   data, do not pick one: stop, as described in
   [Stopping to go back to the human](#stopping-to-go-back-to-the-human).

## Rulings while planning

Planning settles many small technical choices the spec leaves open: a library call, a data
structure, a file's name. Settle them yourself: that is the plan's job. When a later reader would
want one explained, because it was a close call or because it bends a pattern of the codebase, write
it in the feature's `rulings.md`, from
[the template](../assets/templates/specs/000-feature-name/rulings.md): what was decided, why, the
alternatives, and what it costs if wrong. A ruling never binds future work: a choice that would is a
decision, and a reason to stop.

## Stopping to go back to the human

Nobody is in a conversation with you to ask while you plan. You may stop on your own, without
writing a plan, and go back to the human with new questions. Do it rarely: only for a problem of
high severity that only the human can resolve. Everything else, you settle, as a ruling or in the
plan itself.

Stop when the plan would need:

- **A new [decision](spec.md#what-is-a-decision)**, or to go against an active one.
- **A constitution exception** the human has not accepted in the questions.
- **A different behaviour than the spec**: the spec cannot be built as written, because the code, a
  dependency, or a platform does not allow it, and every way around it changes what users get.
- **To pick between two sections of the spec that disagree**, or to meet an edge case its data
  cannot support.
- **A split** of a spec that covers several independent subsystems (see
  [Scope check](#scope-check)).
- **A new limit or rule** the spec does not state, like a maximum, that users would notice.

Do not stop for what you can settle within the spec, the constitution, and the active decisions:
names, files, libraries already in the project, test helpers, the order of tasks, an algorithm the
spec's data already determines.

To stop: do not commit a `plan.md`. Start a new round instead, following
[going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions): a new
`discovery-NN.md` with what you found, the code and sources included, and a new
`clarifications-NN.md` with the questions, each with its options and recommendation, in one commit.
Once the human answers, the spec is amended and approved again, and the plan is written from the new
revision.

Constitution exceptions are exceptional: only one the human accepted in the questions is allowed. It
is spelled out in **Complexity tracking**: which principle, why, and the simpler alternative
rejected. A plan with an exception always waits for the human's review, whatever the risk tier.

## Set the status

| When                                      | Plan status      | Next                                |
| ----------------------------------------- | ---------------- | ----------------------------------- |
| The plan lists a constitution exception   | `awaiting-human` | Human gate                          |
| `risk-tier: low`                          | `auto-approved`  | [Implementation](implementation.md) |
| `risk-tier: medium`, `plan-review: false` | `auto-approved`  | [Implementation](implementation.md) |
| `risk-tier: medium`, `plan-review: true`  | `awaiting-human` | Human gate                          |
| `risk-tier: high`                         | `awaiting-human` | Human gate                          |

When the plan waits for a review, open it with the `> [!IMPORTANT]` block described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human). What most needs attention is where
the plan goes beyond the spec: always the review focus, then any new dependency, even one used only
by tests, and the order of risky tasks. An auto-approved plan has no block. Once the human approves
the plan, the implementation step turns the block into a record, as for the spec.

## Revising

When `plan.md` is `changes-requested`, read its `## Changes requested` section, apply it, and set
the status again from the table. The previous block becomes a record of the request, as described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human). If the feedback needs a new
decision, start a new round of questions, following
[going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).

When the spec's `revision` is higher than the plan's `spec-revision`, update the plan to match the
spec, and set `spec-revision` to the spec's `revision`. Keep the checked steps that still hold,
uncheck or rewrite the others, and set the status again from the table.

## Commit

Commit the plan files and `rulings.md`: `plan(<number>): <feature name>`, or what changed when
revising. When the plan waits for a review, the commit message body is the first line of the block.
