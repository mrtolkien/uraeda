# Plan

Turns the approved spec's design into file-by-file changes and ordered implementation steps.

- **Runs when**: `spec.md` is `approved` and its decisions are active, and there is no `plan.md`, or
  its `spec-revision` is lower than the spec's `revision`; or `plan.md` is `changes-requested`
- **Writes**: `plan.md`, and `data-model.md` or `contracts/` when needed
- **Ends at**: a human gate (`awaiting-human`), or the [implementation](implementation.md) step
  (`auto-approved`)

## Read

1. `spec.md`, especially its **Design**, and the decisions it lists
2. The constitution and the active decisions that apply to the code you will touch, as they are now:
   a human may have changed one since the spec was approved. If one now conflicts with the spec,
   start a new round of questions, following
   [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).
3. The discovery files of every round
4. The code: its structure, conventions, test setup, and validation commands

## Write `plan.md`

Use [the template](../assets/templates/specs/000-feature-name/plan.md), and set `spec-revision` to
the spec's `revision`:

- **Files**: every file the feature adds or changes, with what changes in it. The spec's design says
  what the components are: the plan says where each change goes.
- **Constitution check**: the plan against each principle and each relevant active decision, for
  what the spec's design did not settle
- **Complexity tracking**: every new abstraction, and every constitution exception the human
  accepted, each with the reason and the simpler alternative you rejected. Write "None." otherwise.
- **Steps**: an ordered checklist. Each step is one commit with its tests, and leaves the project
  working. Keep steps coarse: the implementing agent breaks them down. Name the acceptance scenarios
  each step tests: together, the steps must test them all.

Add `data-model.md` when the feature adds or changes entities beyond a few fields: fields,
relationships, validation rules, state transitions. Smaller changes stay in the spec's **Data**
section.

Add `contracts/` when the feature exposes an interface to users or other systems: API schemas, CLI
commands, file formats, in the format that fits the project.

Do not repeat the spec: the summary, approach, and testing strategy are already there. The project's
stack and commands belong in `AGENTS.md` or the project's README, not in every plan.

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
the plan goes beyond the spec's design. An auto-approved plan has no block.

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
