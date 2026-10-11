# Specs

This folder holds the project's specifications and decisions, as plain text in git. It follows the
[Uraeda](https://github.com/mrtolkien/uraeda) workflow: humans write proposals, answer questions,
and approve specs; agents investigate, ask, and write specs, plans, and code.

The workflow is in the [Uraeda skill](https://github.com/mrtolkien/uraeda/tree/main/skills/uraeda).
Without it, the file names and their `status` fields still tell where each feature stands.

## Layout

- `CONSTITUTION.md`: the project's principles, by priority. Binding for all work.
- `PRIORITIES.md`: what is worked on now, next, and later, and what is blocked
- `drafts/`: upcoming features, written by humans, free form
- `backlog/`: nice-to-have features, not scheduled
- In `drafts/` and `backlog/`, a folder is a postponed feature: its proposal, with the discovery
  rounds and questions it had, kept for when it starts again
- `decisions/`: the decision ledger, one file per topic, named after the question it answers:
  high-impact choices made by humans, binding for all work once `active`
- `bugs/YYYY-MM-DD-<slug>/`: a bug `report.md` from a human, and its `assessment.md` from an agent,
  on the branch `fix/YYYY-MM-DD-<slug>`
- `YYYY-MM-DD-feature-slug/`: one folder per feature, dated the day it started, on the branch of the
  same name until its pull request is merged, with these files, in workflow order:
  - `proposal.md`: what and why, written by a human
  - `discovery-NN.md`: the agent's investigation of the code and outside sources, with the options
    found, never decisions
  - `clarifications-NN.md`: the questions only a human can decide, with their answers
  - `spec.md`: the feature's behaviour and technical design, approved by a human, amended in place
  - `spec-review.md`, `plan-review.md`: a human's review comments, when the latest review has any
  - `plan.md`: the implementation tasks, with the files and tests of each, amended in place
  - `data-model.md` and `contracts/`: entities and interfaces, when needed
  - `mockups/`: what users will see, for any UI work

Discovery and clarifications come in numbered rounds, `01`, `02`, ...: a later round is a new pair
of files, and earlier rounds stay as they were.

## Status

Workflow files have a `status` field in their frontmatter:

- `awaiting-human`: waiting for a human to answer or review
- `answered`, `approved`, `changes-requested`: set by a human, an agent can continue
- `auto-approved`: a plan that the feature's risk tier lets skip human review

A spec's `risk-tier`, `low`, `medium`, or `high`, decides whether its plan waits for a human.

Decisions are `proposed` or `active`. A change to an active decision is proposed in a
`## Proposed change (YYYY-MM-DD-feature-slug)` section at the end of its file, and applied when that
feature's spec is approved.

## Review blocks

A file waiting for a human opens with a `> [!IMPORTANT]` block: what is asked, how long it takes,
and what needs attention. Once the human has acted, it becomes a `> [!NOTE]` block that records the
outcome and its date, like "Approved on 2026-10-09".

A review's comments are in a review file next to the reviewed one, `spec-review.md` for `spec.md`:
each comment quotes the lines it is about, with their numbers and the heading above them. Questions
end with **Notes:**, for the human's notes on the points settled without them.

## The `ura` CLI

The optional `ura` command-line tool reads and writes these files: `ura status` shows where each
feature stands, `ura check` validates the files, `ura answer` and `ura review` record answers and
reviews, and `ura draft` and `ura start` begin features. Everything it does can be done by hand.

## Links

Files link to what they rely on with markdown links, relative or from the repository root
(`/src/...`). Wikilinks (`[[file-name]]`) are accepted too.
