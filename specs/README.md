# Specs

Uraeda's own specifications and decisions, as plain text in git. Uraeda is built with its own
workflow: humans write proposals and make decisions, agents research, ask questions, and write
specs, plans, and code.

To run the workflow, use the [Uraeda skill](../skills/uraeda/SKILL.md). Without it, the file names
and their `status` fields tell you where each feature stands.

## Layout

- `CONSTITUTION.md`: the project's principles, by priority. Binding for all work.
- `PRIORITIES.md`: what is worked on now, next, and later
- `drafts/`: upcoming features, written by humans, free form
- `backlog/`: nice-to-have features, not scheduled
- `decisions/`: the decision ledger, one numbered file per decision. `active` decisions are binding.
- `bugs/<slug>/`: a bug `report.md` from a human, and its `assessment.md` from an agent
- `NNN-feature-slug/`: one numbered folder per feature: `proposal.md`, `research.md`,
  `clarifications.md`, `spec.md`, `plan.md`, and when needed `data-model.md` and `contracts/`

Folders are created when they get their first file.

## Status

Workflow files have a `status` field in their frontmatter:

- `awaiting-human`: waiting for a human to answer or review
- `answered`, `approved`, `changes-requested`: set by a human, an agent can continue
- `auto-approved`: a plan that the feature's risk tier lets skip human review

Decisions are `proposed`, `active`, or `overridden`.
