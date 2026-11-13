# Plan

Turns the approved spec into the tasks that build it: what each one delivers, the interfaces between
them, the tests that prove them, and the order to build them in.

- **Runs when**: `spec.md` is `approved` and its decisions are active, and there is no `plan.md`, or
  its `spec-revision` is lower than the spec's `revision`; or `plan.md` is `changes-requested`
- **Writes**: `plan.md`, `rulings.md` when there are rulings, and `contracts/` when needed
- **Ends at**: the [implementation](implementation.md) step (`auto-approved`), a human gate
  (`awaiting-human`), or, rarely, a new round of questions

**The plan's reader is the implementer of one task**: an agent that has seen neither the codebase
nor the spec, and that often sees only its own task. It writes idiomatic code once it knows the
required behaviour and interfaces. Write what it cannot infer: the approved constraints, who owns
each responsibility, the contracts between tasks, and the tests that prove the change. Leave what it
can decide from the code: private helpers, function bodies, internal structure.

A plan is the set of decisions the implementer cannot make alone. A plan longer than the code it
describes has written the code instead, and the build will then diverge from it line by line.

## Read first

1. `spec.md` in full, its `data-model.md`, and the decisions it lists, as the branch has them.
2. `spec-review.md`, when the spec was approved with comments. A comment wins over the clause of the
   spec it changes, and the approved spec is not edited for it: the plan carries each comment out,
   and says how in its `## Review comments` section.
3. The constitution, the decisions, and the guides that apply to the code you will touch, as they
   are now. If one now conflicts with the spec, start a new round of questions.
4. The discovery files: their map of the code is your starting point. Read the code they list, and
   look further only for what they lack.
5. The code itself: its structure and patterns, the test setup and helpers, every place that reads
   or writes data the feature changes, and the commands that validate the project.
6. Other features in flight that touch the same views or data: read their specs and mockups, and use
   what they already draw or name for the same thing: a size, a name, a key, an icon.

If `spec.md` still opens with a `> [!IMPORTANT]` block, turn it into a note, as
[the block](writing.md#the-block) says, in the plan's commit. If the feature's `mockups/` still
holds a round's prototypes, delete them as [approval](approval.md#delete-the-prototypes) describes.

## Scope check

If building one part of the spec changes how another is designed, it should have been split before
approval, as [the split rule](writing.md#a-spec) says. Do not write one plan for all of it: stop, as
[below](#stopping-to-go-back-to-the-human), with a question proposing the split.

## File structure

Before defining tasks, map which files will be created or changed, and what each is responsible for:

- Trace the changed rules and data through their readers, writers, and entry points. A shared
  guarantee gets one enforcement point that all its callers use
  ([one home per rule](code-quality.md#one-home-per-rule)).
- Give state transitions and business rules an explicit owner. For asynchronous or multi-process
  work, say which state is authoritative and who may change it. For resources, say who acquires and
  releases them on success, failure, and cancellation.
- Split by responsibility, not by technical layer. Files that change together live together.
- Follow the codebase's patterns, and do not restructure what the feature does not touch. A task
  that touches a unit over the project's limit starts with a structural step that splits it
  ([extract, don't grow](code-quality.md#extract-dont-grow)).
- A view whose mockups are stories of the project's own preview starts from them: the picked
  variant's component is the starting point, not a rewrite.
- Views that share a look share their components: one task builds a shared component, before the
  tasks that use it.

## Tasks

A task is the smallest unit that carries its own tests and is worth reviewing.

- Fold setup, scaffolding, helpers, and documentation into the task whose deliverable needs them.
- Split only where a reviewer could reject one task while approving its neighbour.
- Order the tasks so each is built and tested on what the earlier ones made. Data changes come
  before the code that relies on them.
- Each task ends with a deliverable that can be tested on its own, and leaves the project working.
- When the feature touches what the constitution says to benchmark, the first task records a
  baseline before any change, and each task that touches it runs the benchmark in its last run step.
- Mark the risky tasks with a **Risky** line saying why: those that change security, the format of
  stored data or its migration, concurrency, or a rule several callers share. Each gets a reviewer
  of its own.

**The first task proves what the rest relies on.** Three cases:

- **Outside behaviour the spec marks unverified**: a test through the real library, browser, or
  tool.
- **A success criterion that is a number**: measure it on one real slice before building the rest.
- **A feature that deletes or rewrites most of an area**: prove the approach on one slice, and
  measure what it was meant to improve.

If the check fails or the measure misses, the build stops there and goes back to the human, before
any work relies on it.

## Waves

The implementation builds the tasks of a wave at the same time, each in its own worktree. A wave is
a set of tasks that can be built without seeing each other's code:

- no task consumes another task of its wave;
- they touch different parts of the code: no file in common, but separate additions to a shared
  file, like each task adding its own helper to a helpers module;
- each leaves the project working on its own, on top of the earlier waves.

Draw the tasks first, then group them: never split or merge tasks to make waves. Number the tasks in
wave order. A task the next ones all build on is a wave on its own.

## Plan document

Use [the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/plan.md): its frontmatter and
its sections, in its order.

- **Goal**, **Architecture**, **Spec**: one sentence, the approach with who owns what, and the link.
- **Review focus**: the most consequential conditions the spec implies but no task's tests would
  otherwise exercise, including what existing behaviour the feature meets: the condition, the
  expected behaviour, and the task whose tests cover it. A review-focus item never narrows a rule of
  the spec. A new limit, like a maximum length, is a question for the human.
- **Global constraints**: the rules every task must follow, with their sources. Copy an approved
  rule word for word, and only the rules a task could break: link the rest. When the feature
  replaces code, add **Out of validation**: the suites of the replaced code, which nothing runs from
  the task that freezes that code to the one that removes it.
- **Code read**: the code the plan relies on, with links and what each showed: the test setup, the
  validation commands, the readers and writers of the data that changes.
- **Constitution check**: the one-row table, as in the spec, then one line per tension.
- **Complexity tracking**: a row for each new abstraction shared by several parts, each unit a task
  grows past the project's limits, and each constitution exception. Each says why it is needed and
  the simpler alternative rejected. "None." when there is none.
- **Review comments**: only when the spec was approved with comments: each comment, named by its
  subject, and the task that carries it out.
- **Test map**: each scenario, edge case, and success criterion of the spec, with the task and the
  test that own it. It opens with a sentence on how the tests run. A row may name an existing test,
  or say "none" and why: [how many](code-quality.md#how-many) decides.
- **Waves**: one line per wave: its tasks, and the shared files they each add to.

Add `contracts/` when the feature exposes an interface to users or other systems, in the format the
project already uses.

## Task structure

Every task follows the template's structure. Its steps are checkboxes: the implementation checks
them in the task's commit, which is how any agent knows how far the work went.

- **Files**: what the task creates, changes, and tests, by path.
- **Interfaces**: **Consumes**, what it uses from earlier tasks, and **Produces**, what later tasks
  rely on, with exact names and signatures. This block is how an implementer learns what its
  neighbours use, and the part of the plan the build keeps true.
- **The steps**, one action each, with a result that can be checked:
  - **A structural step**, first in a task that touches a unit over the project's limit: it only
    restructures, the tests pass before and after, and it is committed on its own.
  - **A test step**: the tests [testing](code-quality.md#testing) asks for, their names and
    assertions, with the spec's exact values. Each names the break it catches. It also creates the
    helpers the tests use, so the first failure is about the feature.
  - **A run step**: the command, and the behaviour that must fail or pass. Predict an exact message
    only when the command's contract makes it stable.
  - **A code step**: the responsibility, the files, and the values the spec pins. Exact signatures
    go where other tasks rely on them. Explain an algorithm only when correctness depends on it,
    like date arithmetic.
  - **A use step**, last before the commit in a task that builds something a user acts on: do the
    act in the running product, and see its effect.
  - **A commit step**: the message, following [Commits](conventions.md#commits).

Lines that decide nothing are the opposite failure of a plan that writes the code: "handle edge
cases", "add appropriate validation", a type no task defines.

## Self-review

Read the spec again, check the plan against it, and fix what you find:

1. **Coverage**: each user story, key scenario, high edge case, success criterion, and approval
   comment has a task and a check that owns it, exact text and values included.
2. **Tests**: the test map follows [how many](code-quality.md#how-many), and each test names its
   break.
3. **Interfaces**: the names and types later tasks consume match what earlier tasks produce.
4. **Expected values**: each test's expectation comes from the approved rules, worked out apart from
   the proposed code, over two operations in a row where state is kept.
5. **Order**: each task builds on what exists, no two tasks of a wave touch the same thing, the
   first task proves what the rest relies on, and each risky task has its **Risky** line.
6. **Proportion**: where the plan prescribes private code, replace it with the responsibility and
   the contract.
7. **The spec itself**: when two of its sections disagree, do not pick one: stop, as below.

## Rulings while planning

Planning settles many small choices the spec leaves open: a library call, a data structure, a file's
name. Settle them: that is the plan's job, and the plan's text records them. Write a
[ruling](implementation.md#rulings) only for a choice whose reason would otherwise be lost.

## Stopping to go back to the human

Stop, without committing a plan, when it would need:

- a new [decision](spec.md#what-is-a-decision), or to go against an active one;
- a constitution exception the human has not accepted. A new marker on code over a limit is not one:
  the plan's own review approves it, so the plan lists it under **Complexity tracking** and waits
  for that review;
- a behaviour different from the spec, because the code, a dependency, or a platform does not allow
  it as written;
- a pick between two sections of the spec that disagree;
- a split of the spec ([Scope check](#scope-check));
- **a new limit, refusal, or rule that users would notice**, which the spec does not state.

Then start a new round, following
[going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions). Once the human
answers, the spec is amended and approved again, and the plan is written from the new revision.

Do not stop for what you can settle within the spec, the constitution, and the decisions: names,
files, libraries already in the project, the order of tasks, an algorithm the data determines.

## Set the status

| When                                                          | Plan status      | Next                                |
| ------------------------------------------------------------- | ---------------- | ----------------------------------- |
| The plan lists a constitution exception, or a new lint marker | `awaiting-human` | Human gate                          |
| The spec's `plan-review` is `true`                            | `awaiting-human` | Human gate                          |
| Otherwise                                                     | `auto-approved`  | [Implementation](implementation.md) |

An auto-approved plan is not a stop: commit it, and start the implementation. It has no block. A
plan that waits opens with [the block](writing.md#the-block): what most needs attention is where the
plan goes beyond the spec, so the review focus first, then any new dependency, and the order of the
risky tasks.

## Revising

When `plan.md` is `changes-requested`, read `plan-review.md`, apply its comments, and set the status
again from the table. The previous block becomes a note of the request, and the new block says how
each comment was handled, each named by its subject.

When the spec's `revision` is higher than the plan's `spec-revision`, update the plan to match, and
set `spec-revision`. Keep the checked steps that still hold, and uncheck or rewrite the others.

With `ura`, run `ura check` on the folder before committing.

## Commit

Commit the plan files and `rulings.md`: `plan(<slug>): <feature name>`, or what changed when
revising. When the plan waits for a review, the body is the block's first line.
