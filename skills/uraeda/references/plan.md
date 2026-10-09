# Plan

Turns the approved spec into tasks small enough for an agent who has seen neither the codebase nor
the spec, with every decision they could not make alone.

- **Runs when**: `spec.md` is `approved` and its decisions are active, and there is no `plan.md`, or
  its `spec-revision` is lower than the spec's `revision`; or `plan.md` is `changes-requested`
- **Writes**: `plan.md`, and `data-model.md` or `contracts/` when needed
- **Ends at**: a human gate (`awaiting-human`), or the [implementation](implementation.md) step
  (`auto-approved`)

The implementing agent writes idiomatic code once it knows the exact interface and the exact test,
and makes a reasonable choice wherever the plan leaves one open. What it cannot know is what was
decided: which files, which names and signatures, which values from the spec, which tests prove each
task. The plan records exactly that, as bite-sized tasks, each with its tests first and its own
commit. It follows superpowers'
[writing plans](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md).

## Read

1. `spec.md`, especially its **Design** and **Testing**, and the decisions it lists
2. The constitution, and the active decisions that apply to the code you will touch, as they are
   now: a human may have changed one since the spec was approved. If one now conflicts with the
   spec, start a new round of questions, following
   [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).
3. The discovery files of every round
4. The code: its structure and patterns, the test setup and its helpers, every place that reads or
   writes data the feature changes, and the validation commands

## Write `plan.md`

Use [the template](../assets/templates/specs/000-feature-name/plan.md), and set `spec-revision` to
the spec's `revision`. In this order:

- **Goal**: one sentence on what the feature builds.
- **Architecture**: two or three sentences on the approach, linking to the spec's design.
- **Review focus**: up to five inputs or failure modes the spec implies but does not mention, most
  likely to bite a user first, each with the behaviour a reasonable person would expect, and the
  task whose tests cover it. The spec says what the feature must do, not everything it will meet:
  its silence on an input is not permission to break on it. These are the only behaviours the plan
  adds, so they come first. A review-focus item never narrows a rule of the spec: a new limit, like
  a maximum, is a question for the human.
- **Global constraints**: the rules every task must follow, copied word for word from the decisions
  and the spec: formats, exact user-facing text, limits, names. Every task's requirements include
  them.
- **Code read**: the code the plan relies on, with links and what each showed. Claims about the code
  rest on this section.
- **Constitution check**: the plan against every principle of the constitution.
- **Decisions**: only the decisions the plan relies on, each with where the plan follows it.
- **Complexity tracking**: every new abstraction (a type, module, layer, wrapper, or helper shared
  by several parts, tests included, even when the spec's design introduced it), and every
  constitution exception the human accepted, each with why it is needed and the simpler alternative
  rejected. "None." otherwise.
- **Tasks**: see below.

Add `data-model.md` when the feature adds or changes entities beyond a few fields: fields,
relationships, validation rules, state transitions. Smaller changes stay in the spec's **Data**
section. Add `contracts/` when the feature exposes an interface to users or other systems: API
schemas, CLI commands, file formats, in the format that fits the project.

## Files and tasks

Map the files before writing the tasks: this is where the decomposition is decided.

- Each file has one clear responsibility. Prefer small, focused files over large ones; files that
  change together live together. Follow the codebase's existing patterns: split a file that grew
  unwieldy only when the feature works in it.
- Tests are code: they follow the project's test layout, and share helpers, fixtures, and fakes so
  each test stays a few lines long. Create the ones the spec's tests and error cases need, in the
  first task that needs them.

A task is the smallest unit with its own test cycle that a reviewer could accept while rejecting its
neighbour. Fold setup, configuration, and helpers into the task whose deliverable needs them. Order
tasks so each one is built and tested on what the earlier ones made: data changes before the code
that relies on them. Every task ends with working, tested software.

Each task has:

- **Files**: `Create:`, `Modify:` (with the function or line range when it helps), and `Test:`.
- **Interfaces**: `Consumes:` what it uses from earlier tasks, and `Produces:` what later tasks rely
  on, with exact names, parameters, and return types. The implementer of a task only sees that task:
  this is how it learns the names its neighbours use.
- **Steps**, as checkboxes, each one action with a checkable result:
  1. **Write the failing tests**: as code, with the spec's exact values. Integration tests by
     default, following the spec step's [Tests](spec.md#tests) rules: Arrange, Act, Assert, on the
     shared helpers.
  2. **Run them to check they fail**: the command, and the first failure the run will actually hit.
  3. **Implement**: the exact signatures and files, the values the spec pins, and one line on the
     approach when the signature and tests leave a choice. A body only for an algorithm they do not
     determine, or for exact text the spec fixes.
  4. **Run all tests**: the command, the expected result, and the benchmark when the task touches
     what the constitution says to benchmark, compared to one baseline recorded before the first
     task, with the tolerance the spec sets.
  5. **Commit**: the message, following [Commits](../SKILL.md#commits).

A step is done when the implementer can write exactly one reasonable thing from it: unambiguous, not
complete. A plan longer than the code it describes has written the code instead. Lines that decide
nothing ("handle edge cases", "add validation", "write tests for the above", a function no task
defines) are the opposite failure.

## Self-review

Before committing, read the spec again, check the plan against it, and fix what you find:

1. **Coverage**: every requirement, component, line of the spec's **Testing** table, and global
   constraint has a task and a test asserting it, exact text and timings included.
2. **Step scan**: every step lets the implementer write exactly one reasonable thing. No line that
   decides nothing, no body that the signature and tests already determine. An algorithm the tests
   do not pin down, like date arithmetic, is written out.
3. **Expected values**: work out every value a test expects from the plan's own algorithm, and
   follow each edge case over two consecutive occurrences, not one.
4. **Consistency**: names, types, and signatures match between `Produces` and `Consumes`. A task
   that changes the behaviour of an existing function declares it in `Produces`. No two functions
   share a name, helpers included.
5. **Review focus**: every failure mode the spec implies is covered by a task's tests. The five most
   likely to bite a user are listed, each with its test in the owning task.
6. **Order**: each task can be built and tested with what the earlier tasks made, and its expected
   failure is the first one the run will hit.
7. **Proportion**: the plan is shorter than the code it describes. When code blocks are most of the
   document, replace bodies with signatures, test names, and assertions.
8. **The spec itself**: when two of its sections disagree, or an edge case cannot be met with its
   data, do not pick: start a new round of questions, following
   [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).

## No new decisions, no exceptions

The plan must not need a new [decision](spec.md#what-is-a-decision), or go against an active
decision. If it does, do not commit a plan: start a new round of questions, following
[going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions), so the human
decides. The spec is then amended and approved again.

Constitution exceptions are exceptional: only one the human accepted in the questions is allowed. It
is spelled out in **Complexity tracking**: which principle, why, and the simpler alternative
rejected. A plan with an exception always waits for the human's review, whatever the risk tier.

## Set the status

| Spec frontmatter                          | Plan status      | Next                                |
| ----------------------------------------- | ---------------- | ----------------------------------- |
| The plan lists a constitution exception   | `awaiting-human` | Human gate                          |
| `risk-tier: low`                          | `auto-approved`  | [Implementation](implementation.md) |
| `risk-tier: medium`, `plan-review: false` | `auto-approved`  | [Implementation](implementation.md) |
| `risk-tier: medium`, `plan-review: true`  | `awaiting-human` | Human gate                          |
| `risk-tier: high`                         | `awaiting-human` | Human gate                          |

When the plan waits for a review, open it with the `> [!IMPORTANT]` block described in
[Coming back to the human](../SKILL.md#coming-back-to-the-human): what most needs attention is where
the plan goes beyond the spec. That is always the review focus, then any new dependency, even one
used only by tests, and the order of risky tasks. An auto-approved plan has no block. Once the human
approves the plan, the implementation step turns the block into a record, as for the spec.

## Revising

When `plan.md` is `changes-requested`, read its `## Review` section, apply it, remove the section,
and set the status again from the table. If the feedback needs a new decision, start a new round of
questions, following
[going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).

When the spec's `revision` is higher than the plan's `spec-revision`, update the plan to match the
spec, and set `spec-revision` to the spec's `revision`. Keep the checked steps that still hold,
uncheck or rewrite the others, and set the status again from the table.

## Commit

Commit the plan files: `plan(<number>): <feature name>`, or what changed when revising. When the
plan waits for a review, the commit message body is the first line of the block.
