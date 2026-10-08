# Spec

Describes what the feature does, for the human to approve.

- **Runs when**: the [decisions](decisions.md) step found the scope clear, or `spec.md` is
  `changes-requested`
- **Writes**: `spec.md`
- **Ends at**: a human gate, `spec.md` with `status: awaiting-human`

## Write `spec.md`

Use [the template](../assets/templates/specs/000-feature-name/spec.md). The spec describes
behaviour, not code: what users can do, and what must be true. Keep it as short as the feature
allows.

- **User stories**, ranked by priority (P1, P2, ...). Each one can be shipped and tested on its own,
  and has acceptance scenarios written as Given / When / Then. The implementation must test each
  scenario.
- **Edge cases**
- **Functional requirements** (FR-001, ...) and measurable **success criteria** (SC-001, ...)
- **Assumptions**: what you settled yourself, so the human can object
- **Decisions**: links to every proposed and active decision the spec relies on. Approving the spec
  activates the proposed ones.
- **Constitution check**: how the spec complies with each principle and each relevant active
  decision. A conflict cannot be approved: it goes back to [research](research.md) as a question.
- **Risk tier**: see below

The spec must not contain `[NEEDS CLARIFICATION]` markers: open questions go back to
[research](research.md). When a visual direction matters, add a mockup next to the spec and link it.

## Risk tier

The tier decides whether the human reviews the plan. Propose it in the frontmatter, with a one-line
reason in the spec.

| Tier     | Plan review                          | Typical features                                          |
| -------- | ------------------------------------ | --------------------------------------------------------- |
| `low`    | none, the plan is auto-approved      | No data format change, no new table, no new interface     |
| `medium` | chosen by the human, none by default | Small data format changes, minimal UI, low impact         |
| `high`   | required                             | Security changes, new complex data structures or services |

- For `medium`, add `plan-review: false`. The human sets it to `true` to review the plan.
- When unsure between two tiers, propose the higher one.
- Never propose a tier below the minimum set by the constitution, if it sets one.

## Revising

When `spec.md` is `changes-requested`, read its `## Review` section.

- If the feedback asks for more options or raises a new question, go to [research](research.md).
- If a newer clarification session was answered since the review, run [decisions](decisions.md)
  first.
- Otherwise, apply the feedback, update the proposed decisions it affects, and remove the
  `## Review` section: git keeps it.

Set `status: awaiting-human` again.

## Commit

Commit the spec: `spec(<number>): <feature name>`, or what changed when revising. Then stop at the
gate.
