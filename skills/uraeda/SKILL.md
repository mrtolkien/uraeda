---
name: uraeda
description:
  Git-driven spec workflow where humans write proposals and make decisions, and agents research, ask
  questions, and write specs, plans, and code. Use in a repository with a `specs/` folder that
  follows Uraeda conventions, to find and run the next workflow step of a feature or bug, or to set
  up `specs/` in a new project. Stops at human gates.
metadata:
  version: "0.1.0"
---

# Uraeda

Uraeda is an asynchronous design and development workflow, where every step is checkpointed as plain
text in git. Humans write proposals, answer questions, and approve specs. Agents do everything in
between: the investigation, the options, the design, the plan, and the code.

The hard work happens upfront, without the human: a capable agent investigates in depth and comes
back with the questions only the human can answer, then with a complete design to approve. The human
never has to stay in a chat session: they answer when they have time, in files built so their time
goes into thinking, not searching. Assume the human is a technical user, who reads code and designs.

This file holds the conventions shared by all steps, and tells you which step to run. Each step has
its own instructions in `references/`.

## Rules for agents

1. **Humans make the decisions.** Stay within the approved scope and decisions. Never activate a
   decision unless a human asked for it, for example by approving the spec that lists it. Conflicts
   with the constitution or active decisions go to the human as questions.
2. **Work autonomously, in depth.** Decide yourself how deep each topic goes, and go as deep as it
   deserves: read the code, the documentation, and online sources before asking anything. Never ask
   the human for something you could find out or settle yourself.
3. **Ask only what only the human can decide**: product direction, tradeoffs between their goals,
   and choices that become decisions. Settle everything else within the constitution and active
   decisions, and record it as an assumption the human can object to. Every question comes with a
   recommended answer and its reason.
4. **Ask everything in one round.** Anticipate follow-up questions, so the human answers once. A new
   round is only for unknowns their answers created.
5. **Write for a human reading top to bottom.** Humans read a document once, in order: never refer
   to something before it is introduced, and give the context each part needs where it is needed,
   with links to the code, documentation, and web pages it relies on.
6. **Come back with a clear message.** Every file waiting for the human opens with what is asked of
   them, how long it takes, and where their attention matters most: see
   [Coming back to the human](#coming-back-to-the-human).
7. **End every step with a commit.** The next step may be run by a different agent, in a different
   session, days later: everything it needs must be in the repository.

## The `specs/` folder

```sh
specs/
  README.md                 # layout and conventions, links to this skill
  CONSTITUTION.md           # project principles, by priority: always binding
  PRIORITIES.md             # Now, Next, Later, Blocked
  drafts/                   # upcoming features, human-written, free form
  backlog/                  # nice-to-have features, not scheduled
  decisions/                # decision ledger, one file per topic: due-dates.md
  bugs/<slug>/              # report.md (human), assessment.md (agent)
  NNN-feature-slug/         # one numbered folder per feature
    proposal.md             # human: what and why
    discovery-01.md         # agent: findings and options, never decisions
    clarifications-01.md    # agent questions, human answers
    discovery-02.md         # a later round, when one is needed
    clarifications-02.md
    spec.md                 # agent: behaviour and design, approved by a human, amended in place
    plan.md                 # agent: files and implementation steps, amended in place
    data-model.md           # agent, when needed
    contracts/              # agent, when needed
```

Discovery and questions come in numbered rounds: each round is a new pair of files, and earlier
rounds are never edited. The spec and the plan are single files, amended in place: they are the
source of truth for the implementation.

Before any step, read `specs/CONSTITUTION.md` and the `active` decisions in `specs/decisions/` that
apply to your work: their **Applies to** section says where. The constitution wins over decisions,
and decisions win over specs and plans. Decisions are high-impact choices made by the human, and
they change over time: see [what is a decision](references/spec.md#what-is-a-decision).

Templates for every file are in `assets/templates/specs/`, at the same paths. A filled-in example,
for a todo app, is in `assets/example/specs/`.

### Links

Write markdown links, with a relative path (`[spec](spec.md)`) or a path from the repository root
(`[auth](/src/auth.ts)`). Humans may write wikilinks (`[[due-dates]]`): read them, but do not write
them. Link to what a file relies on: decisions, discovery, code.

### Branches

Each feature lives on its own branch, named after its folder (`001-recurring-tasks`), from the
proposal to the code: discovery, questions, spec, decisions, plan, and implementation. Its pull
request merges all of it at once. Decisions become active on the branch when its spec is approved,
and bind the rest of the project once the branch is merged. A bug lives on `fix/<slug>`.

Run every step on the feature's branch. The human answers and approves on that branch too.

### Workflow status

Workflow files track their state in frontmatter fields.

| File                   | Field            | Set by the agent                      | Set by the human                  |
| ---------------------- | ---------------- | ------------------------------------- | --------------------------------- |
| `clarifications-NN.md` | `status`         | `awaiting-human`                      | `answered`                        |
| `spec.md`              | `status`         | `awaiting-human`                      | `approved` or `changes-requested` |
| `spec.md`              | `revision`       | `1`, then `+1` at every change        | `+1` when editing it              |
| `spec.md`              | `clarifications` | the last round it includes: `2`       |                                   |
| `plan.md`              | `status`         | `awaiting-human` or `auto-approved`   | `approved` or `changes-requested` |
| `plan.md`              | `spec-revision`  | the spec `revision` it implements     |                                   |
| `decisions/*.md`       | `status`         | `proposed`, then `active` on approval | `active`                          |
| `bugs/*/assessment.md` | `status`         | `awaiting-human`                      | `approved` or `changes-requested` |

The `assessment.md` statuses are an agent-authored draft that needs human review: see
[Bug](references/bug.md).

Only set a human status when the human expressly asks you to in the session, for example "the spec
is approved". Say so in the commit message: `spec(001): approved by the human in chat`. With
`changes-requested`, the human's feedback is in a `## Review` section at the end of the file.

An active decision is never edited before approval: changes are proposed in a `## Proposed change`
section at the end of the file, and applied when the spec that links to them is approved.

## Finding the next step

1. **Pick the target.** Use the feature or bug the human named. Otherwise, list the feature and bug
   branches (`git branch -a`), and take the first one with work for an agent, in the order of the
   **Now** section of `specs/PRIORITIES.md`. Starting a feature is a human action: see
   [below](#starting-postponing-and-dropping-a-feature).
2. **Find the step.** Check out the target's branch. In its spec folder, `NN` is the highest
   clarifications round. Go down this table and run the first row that matches.

| State of the spec folder                                                                        | Step                                                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A file has `status: awaiting-human`                                                             | **Human gate**: stop                                         |
| No `clarifications-01.md`                                                                       | [Discovery](references/discovery.md), round 01               |
| `clarifications-NN.md` is `answered`, and there is no `spec.md`, or its `clarifications` < NN   | [Spec and decisions](references/spec.md)                     |
| `spec.md` is `changes-requested`                                                                | [Spec](references/spec.md), revision                         |
| `spec.md` is `approved`, and a decision it links is `proposed`, or has a proposed change for it | [Approval](references/approval.md)                           |
| `spec.md` is `approved`, and there is no `plan.md`                                              | [Plan](references/plan.md)                                   |
| `spec.md` is `approved`, and the plan's `spec-revision` < the spec's `revision`                 | [Plan](references/plan.md), revision                         |
| `plan.md` is `changes-requested`                                                                | [Plan](references/plan.md), revision                         |
| `plan.md` is `approved` or `auto-approved`, with unchecked steps                                | [Implementation](references/implementation.md)               |
| Every step of `plan.md` is checked, and the branch has no pull request                          | [Implementation](references/implementation.md), pull request |
| The branch has an open pull request                                                             | **Human gate**: the review happens on the pull request       |

For a bug branch, see [Bug](references/bug.md).

3. **Run the step**, following its reference file, and commit.
4. **Continue or stop.** If the step did not end at a human gate, run the next step in the same
   session when you can. Otherwise stop: the next run finds it with this same table.

### Going back to the human with new questions

Any step can find something only the human can decide: an answer that raised a new unknown, spec
feedback asking for options, a plan or implementation blocked by something the spec and decisions do
not allow. Never work around it, and never leave it as a note only: start a new round. Write
`discovery-NN.md` and `clarifications-NN.md` with the next number, following
[Discovery](references/discovery.md), in the same commit. The new questions wait for the human like
the first ones, and the spec is amended once they are answered.

### Coming back to the human

A step that ends at a human gate stops there: do not start the next step early, even partly. It
comes back to the human the same way every time, so they know at once what is asked of them and
where to put their attention.

1. **The file waiting for them opens with a `> [!IMPORTANT]` block**, right after the title:
   - First line: what is asked, and an honest estimate of the time it takes to think it through. "12
     questions, about 30 minutes."
   - Then what most needs their attention, most important first, one line each, named by subject
     rather than by number or section the reader has not seen yet: the choices that last beyond the
     feature, the questions that work together, a decision that changes, a risky assumption, a cost.
     The block orients the human: the details stay in the file.
   - On a revision: what changed since their last review.
   - Last line: how to answer. "Answer, set `status: answered`, and commit."
2. **The commit message body repeats the block's first line**, so `git log` and any git listener
   show what is waiting, and for how long.
3. **In a chat session**, say the same in one or two sentences, with the file's path. If you were
   triggered without a chat session, the commit is the message: say nothing else.

Never bury something the human must decide in prose: it is a question in a clarifications file, or
an item in the block.

The workflow only moves on when every question is answered. If a clarifications file is `answered`
with questions left blank, set its status back to `awaiting-human`, name the blank questions in the
first line of its block, and commit.

## Starting, postponing, and dropping a feature

Do these only when a human asks.

- **Start**: take the next number: the highest ever used, in folders and branches, including deleted
  ones (`git log --all --name-only --format= -- specs/`, `git branch -a`), plus one. Create the
  branch `NNN-feature-slug` from the default branch. On it, create `specs/NNN-feature-slug/`, move
  the draft or backlog file into it as `proposal.md`, and point the `PRIORITIES.md` entry to the
  folder. Commit with `chore(<number>): start <feature name>`.
- **Postpone or block**: on the feature's branch, move `proposal.md` back to
  `specs/drafts/<slug>.md` or `specs/backlog/<slug>.md`, as the human prefers, and delete the rest
  of the folder. Move the `PRIORITIES.md` entry to the right section, with the reason when it is
  blocked. Merge only this change, or let the human close the branch: git history keeps the
  discovery and questions.
- **Drop**: delete the branch, after the human confirms.

When postponing, delete the feature's decisions that are still `proposed`, and the
`## Proposed change` sections it added. Commit with `chore(<number>): postpone <feature name>`.

## Commits

One commit per step, containing only that step's files. Messages follow
[Conventional Commits](https://www.conventionalcommits.org/), with one extra type per workflow step.
The scope is the spec folder's number, or the bug's slug. The description is the feature name for a
first version, and what changed for later commits.

| Type          | Step                                     | Example                                                     |
| ------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `discovery:`  | A discovery and questions round          | `discovery(001): recurring tasks`                           |
| `decision:`   | Apply approved decisions                 | `decision(001): apply due dates`                            |
| `spec:`       | Write or revise a spec and its decisions | `spec(001): recurring tasks`                                |
| `plan:`       | Write or revise a plan                   | `plan(001): split the store migration`                      |
| `assessment:` | Assess a bug                             | `assessment(completed-tasks-reappear): race between writes` |

Code commits during the implementation use the standard types, with the same scope:
`feat(001): repeat dropdown`, `fix(completed-tasks-reappear): queue writes per task`. The commit
type is only a label: the `status` fields stay the source of truth for the workflow.

## Setting up a project

When asked to set up Uraeda in a project, copy `assets/templates/specs/README.md`,
`CONSTITUTION.md`, and `PRIORITIES.md` into the project's `specs/` folder. The constitution is the
human's: help them write it by asking about the project's goals and constraints, and propose
principles with recommended wording. Do not copy the feature, decision, or bug templates: they stay
in this skill.
