# Plan

Describes how the approved spec will be built, as ordered implementation steps.

- **Runs when**: `spec.md` is `approved` and its decisions are active, with no `plan.md` or a
  `plan.md` older than the spec, or `plan.md` is `changes-requested`
- **Writes**: `plan.md`, and `data-model.md` or `contracts/` when needed
- **Ends at**: a human gate (`awaiting-human`), or the [implementation](implementation.md) step
  (`auto-approved`)

## Read

1. `spec.md`, and the decisions it lists
2. The constitution and the active decisions that apply to the code you will touch, as they are now:
   a human may have changed one since the spec was approved. If one now conflicts with the spec, go
   back to [research](research.md).
3. `research.md`
4. The code: its structure, conventions, test setup, and validation commands

## Write `plan.md`

Use [the template](../assets/templates/specs/000-feature-name/plan.md):

- **Summary**: the main requirement and the technical approach, in a few sentences
- **Technical context**: languages, dependencies, storage, testing, constraints
- **Constitution check**: the plan against each principle and each relevant active decision
- **Project structure**: the files and folders the feature adds or changes
- **Complexity tracking**: only when the plan adds an abstraction or breaks a principle, with the
  reason and the simpler alternative you rejected
- **Steps**: an ordered checklist. Each step is one commit with its tests, and leaves the project
  working. Keep steps coarse: the implementing agent breaks them down. Name the acceptance scenarios
  each step tests: together, the steps must test them all.

Add `data-model.md` when the feature adds or changes entities beyond a few fields: fields,
relationships, validation rules, state transitions. Smaller changes stay in a section of the plan.

Add `contracts/` when the feature exposes an interface to users or other systems: API schemas, CLI
commands, file formats, in the format that fits the project.

## No new decisions

The plan must not need a new important decision or a constitution exception. If it does, do not
commit a plan: write the reason in a new `research.md` session and go back to
[research](research.md), so the human decides. The spec is then revised and approved again.

## Set the status

| Spec frontmatter                          | Plan status      | Next                                |
| ----------------------------------------- | ---------------- | ----------------------------------- |
| `risk-tier: low`                          | `auto-approved`  | [Implementation](implementation.md) |
| `risk-tier: medium`, `plan-review: false` | `auto-approved`  | [Implementation](implementation.md) |
| `risk-tier: medium`, `plan-review: true`  | `awaiting-human` | Human gate                          |
| `risk-tier: high`                         | `awaiting-human` | Human gate                          |

## Revising

When `plan.md` is `changes-requested`, read its `## Review` section, apply it, remove the section,
and set the status again from the table. If the feedback needs a new decision, go to
[research](research.md).

When the spec was approved again after the plan was written, update the plan to match it. Keep the
checked steps that still hold, uncheck or rewrite the others, and set the status again from the
table.

## Commit

Commit the plan files: `plan(<number>): <feature name>`, or what changed when revising.
