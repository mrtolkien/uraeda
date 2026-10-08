# Specs

This folder holds the project's specifications and decisions, as plain text in git. It follows the
[Uraeda](https://github.com/mrtolkien/uraeda) workflow: humans write proposals and make decisions,
agents research, ask questions, and write specs, plans, and code.

To run the workflow, use the
[Uraeda skill](https://github.com/mrtolkien/uraeda/tree/main/skills/uraeda). Without it, the file
names and their `status` fields tell you where each feature stands.

## Layout

- `CONSTITUTION.md`: the project's principles, by priority. Binding for all work.
- `PRIORITIES.md`: what is worked on now, next, and later
- `drafts/`: upcoming features, written by humans, free form
- `backlog/`: nice-to-have features, not scheduled
- `decisions/`: the decision ledger, one numbered file per decision. `active` decisions are binding.
- `bugs/<slug>/`: a bug `report.md` from a human, and its `assessment.md` from an agent
- `NNN-feature-slug/`: one numbered folder per feature, with these files, in workflow order:
  - `proposal.md`: what and why, written by a human
  - `research.md`: findings and options
  - `clarifications.md`: questions for the human, with their answers
  - `spec.md`: the feature's behaviour, approved by a human
  - `plan.md`: the technical approach and implementation steps
  - `data-model.md` and `contracts/`: entities and interfaces, when needed

## Status

Workflow files have a `status` field in their frontmatter:

- `awaiting-human`: waiting for a human to answer or review
- `answered`, `approved`, `changes-requested`: set by a human, an agent can continue
- `auto-approved`: a plan that the feature's risk tier lets skip human review

Decisions are `proposed`, `active`, or `overridden`.

## Links

Files link to what they rely on with markdown links, relative or from the repository root
(`/src/...`). Wikilinks (`[[file-name]]`) are accepted too.
