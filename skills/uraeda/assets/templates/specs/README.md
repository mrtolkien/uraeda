# Specs

This folder holds the project's specifications and decisions, as plain text in git. It follows the
[Uraeda](https://github.com/mrtolkien/uraeda) workflow: humans write proposals, answer questions,
and approve specs; agents investigate, ask, and write specs, plans, and code.

The workflow is in the [Uraeda skill](https://github.com/mrtolkien/uraeda/tree/main/skills/uraeda).
Without it, the file names and their `status` fields still tell where each feature stands.

## Layout

- `CONSTITUTION.md`: the project's principles, by priority. Binding for all work.
- `PRIORITIES.md`: what is worked on now, next, and later, and what is blocked
- `INBOX.md`: notes about the software, by category, waiting to become priorities, drafts, changes,
  or nothing; and `INBOX-TRIAGE.md`, an agent's proposal for them, answered like questions
- `DECISIONS-CHECK.md`: an agent's questions about how the decisions fit together, answered like
  questions; and `decisions-check/`, holding each option's edited decision until it is applied
- `drafts/`: upcoming features, written by humans, free form
- `backlog/`: nice-to-have features, not scheduled
- In `drafts/` and `backlog/`, a folder is a postponed feature: its proposal, with the discovery
  rounds and questions it had, kept for when it starts again; or a draft with images, its
  `proposal.md` next to its `images/`
- `decisions/`: the decision ledger, one file per topic, named after the question it answers:
  high-impact choices made by humans, binding for all work once `active`
- `done/YYYY-MM-DD-<slug>.md`: the record of a merged feature or change, written in place of its
  folder in the last commit of its branch: what it does and why, each question with its answer, and
  the changes made after approval. The folder's files stay in git: `git log -- specs/<folder>/`
- `changes/YYYY-MM-DD-<slug>/`: a change, the light flow for a bug fix or a small change, on the
  branch `change/YYYY-MM-DD-<slug>` until it is finished into its record: its `proposal.md` from a
  human, its rounds of `clarifications-NN.md` when it needs a decision, and `rulings.md`. There is
  no spec or plan: the agent's investigation is in its commits, and the human reviews the pull
  request
- `images/`, in a feature's, a change's, or a draft's folder: the images a human attached, as WebP
  or animated GIF, linked from the folder's files with `![alt](images/name.webp)`, and deleted with
  a feature's or a change's folder when it is finished
- `YYYY-MM-DD-feature-slug/`: one folder per feature, dated the day it started, on the branch of the
  same name until it is finished into its record, with these files, in workflow order:
  - `proposal.md`: what and why, written by a human
  - `discovery-NN.md`: the agent's investigation of the code and outside sources, with the options
    found, never decisions
  - `clarifications-NN.md`: the questions only a human can decide, with their answers
  - `spec.md`: what the human approves, amended in place: what you approve, your last review
    answered, the decisions, the user stories, then how it is built and its limits
  - `spec-review.md`, `plan-review.md`: a human's review comments, when the latest review has any
  - `plan.md`: the implementation tasks, with the files and tests of each, amended in place
  - `data-model.md`: the stored data and file formats the spec adds or changes, written with it
  - `contracts/`: the interfaces the plan builds on, when needed
  - `mockups/`: what users will see, for any UI work: HTML mockups, or the stories of a mockups
    Storybook. With the project's own Storybook, mockups are stories in the code instead.

Discovery and clarifications come in numbered rounds, `01`, `02`, ...: a later round is a new pair
of files, and earlier rounds stay as they were.

## Status

Workflow files have a `status` field in their frontmatter:

- `awaiting-human`: waiting for a human to answer or review
- `answered`, `approved`, `changes-requested`: set by a human, an agent can continue
- `auto-approved`: a plan that skips human review, since its spec's `plan-review` is `false`

A proposal's `discovery`, `low`, `medium`, or `high` by default, tells how far the agent researches
before asking its questions.

A spec's `risk-tier`, `low`, `medium`, or `high`, tells how much the feature can break. Its
`plan-review`, `false` by default whatever the tier, says whether its plan waits for a human, who
decides it when approving the spec.

Decisions are `proposed` or `active`. A feature creates or changes a decision in place, on its
branch, where it is `proposed` until the feature's spec is approved: `git diff` against the default
branch shows the change.

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
reviews, `ura draft` and `ura start` begin features, and `ura clean` removes what merged features
leave behind. Everything it does can be done by hand.

## Links

Files link to what they rely on with markdown links, relative or from the repository root
(`/src/...`). Wikilinks (`[[file-name]]`) are accepted too.
