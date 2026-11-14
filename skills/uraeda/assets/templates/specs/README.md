# Specs

This folder holds the project's specifications and decisions, as plain text in git. It follows the
[Uraeda](https://github.com/mrtolkien/uraeda) workflow: humans write proposals, answer questions,
and approve specs; agents investigate, ask, and write specs, plans, and code.

The workflow is in the [Uraeda skill](https://github.com/mrtolkien/uraeda/tree/main/skills/uraeda).
Without it, the file names and their `status` fields still tell where each feature stands.

## Outside git

Ideas, the inbox of things noticed, priorities, proposals not started yet, and the long research
behind each round of questions live in the human's notes, outside this repository. Nothing here
depends on them: a file may link a note as further reading, never as something it needs. A feature
enters git when it starts, as a branch whose first commit is its proposal, and reaches the default
branch as a record, with its pull request.

## Layout

- `CONSTITUTION.md`: the project's principles, by priority. Binding for all work.
- `decisions/`: one file per topic, named after the question it answers: the boundaries the human
  set, in their words, binding for all work. The one on the default branch is in force
- `ui/`: for a project with a UI, its guides, free form: how its views read and behave, which every
  view follows
- `guides/`: the guides of other areas, free form
- `done/YYYY-MM-DD-<slug>.md`: the record of a merged feature or change, written in place of its
  folder in the last commit of its branch: what it does and why, each question with its answer, and
  the changes made after approval. The folder's files stay in git: `git log -- specs/<folder>/`
- `changes/YYYY-MM-DD-<slug>/`: a change, the light flow for a bug fix or a small change, on the
  branch `change/YYYY-MM-DD-<slug>` until it is finished into its record: its `proposal.md`, its
  rounds of `clarifications-NN.md` when it needs a decision, and `rulings.md`. There is no spec or
  plan: the agent's investigation is in its commits, and the human reviews the pull request
- `images/`, in a feature's or a change's folder: the images the human attached, as WebP or animated
  GIF, deleted with the folder when it is finished
- `YYYY-MM-DD-feature-slug/`: one folder per feature, dated the day it started, on the branch of the
  same name until it is finished into its record, with these files, in workflow order:
  - `proposal.md`: what and why, written by a human, the branch's first commit
  - `discovery-NN.md`: what the round's questions rely on, with sources, and the map of the code
  - `clarifications-NN.md`: the questions only a human can decide, with their answers
  - `spec.md`: what the human approves, amended in place: what you approve, your last review
    answered, the decisions, the user stories, then how it is built and its limits
  - `spec-review.md`, `plan-review.md`: a human's review comments, when the latest review has any
  - `plan.md`: the implementation tasks, with the files and tests of each, amended in place
  - `rulings.md`: what the build settled that users will notice, or a test it removed
  - `data-model.md`: the stored data and file formats the spec adds or changes, written with it
  - `contracts/`: the interfaces the plan builds on, when needed
  - `mockups/`: what users will see, for any UI work. A round's throwaway prototypes also sit there,
    until the plan deletes them.

Discovery and clarifications come in numbered rounds, `01`, `02`, ...: a later round is a new pair
of files, and earlier rounds stay as they were.

## Status

Workflow files have a `status` field in their frontmatter:

- `awaiting-human`: waiting for a human to answer or review
- `answered`, `approved`, `changes-requested`: set by a human, an agent can continue
- `auto-approved`: a plan that skips human review, since its spec's `plan-review` is `false`

The human answers and reviews by editing the files, and commits nothing: the next agent step commits
their work first, unchanged, as a commit of its own.

A proposal's `discovery`, `low`, `medium`, or `high` by default, tells how far the agent researches
before asking its questions. A spec's `risk-tier`, `low`, `medium`, or `high`, tells how much the
feature can break. Its `plan-review`, `false` by default whatever the tier, says whether its plan
waits for a human, who decides it when approving the spec.

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
reviews, and `ura serve` draws pages to do both. It never commits. Everything it does can be done by
hand.

## Links

Files link to what they rely on with markdown links, relative or from the repository root
(`/src/...`). Wikilinks (`[[file-name]]`) are accepted too.
