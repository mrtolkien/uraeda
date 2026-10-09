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
    discovery.md             # agent: findings and options, never decisions
    clarifications.md       # agent questions, human answers
    spec.md                 # agent: behaviour, reviewed by a human
    plan.md                 # agent: technical approach and implementation steps
    data-model.md           # agent, when needed
    contracts/              # agent, when needed
```

Before any step, read `specs/CONSTITUTION.md` and the `active` decisions in `specs/decisions/` that
apply to your work: their **Applies to** section says where. The constitution wins over decisions,
and decisions win over specs and plans. Decisions are high-impact choices made by the human, and
they change over time: see [what is a decision](references/spec.md#what-is-a-decision).

Templates for every file are in `assets/templates/specs/`, at the same paths. A filled-in example,
for a todo app, is in `assets/example/specs/`.

### Links

Write markdown links, with a relative path (`[discovery](discovery.md)`) or a path from the
repository root (`[auth](/src/auth.ts)`). Humans may write wikilinks (`[[due-dates]]`): read them,
but do not write them. Link to what a file relies on: decisions, discovery, code. Links replace
metadata fields.

### Workflow status

Workflow files track their step in a `status` frontmatter field.

| File                   | Set by the agent                      | Set by the human                  |
| ---------------------- | ------------------------------------- | --------------------------------- |
| `clarifications.md`    | `awaiting-human`                      | `answered`                        |
| `spec.md`              | `awaiting-human`                      | `approved` or `changes-requested` |
| `plan.md`              | `awaiting-human` or `auto-approved`   | `approved` or `changes-requested` |
| `decisions/*.md`       | `proposed`, then `active` on approval | `active`                          |
| `bugs/*/assessment.md` | `awaiting-human`                      | `approved` or `changes-requested` |

The `assessment.md` statuses are an agent-authored draft that needs human review: see
[Bug](references/bug.md).

Only set a human status when the human expressly asks you to in the session, for example "the spec
is approved". Say so in the commit message: `spec(001): approved by the human in chat`. With
`changes-requested`, the human's feedback is in a `## Review` section at the end of the file.

An active decision is never edited before approval: changes are proposed in a `## Proposed change`
section at the end of the file, and applied when the spec that links to them is approved.

## Finding the next step

1. **Pick the target.** Use the spec folder or bug the human named. Otherwise, take the first entry
   of the **Now** section of `specs/PRIORITIES.md` that links to a spec folder or bug with work for
   an agent. Starting a feature is a human action: see
   [below](#starting-postponing-and-dropping-a-feature).
2. **Find the step.** For a spec folder, go down this table and run the first row that matches.
   "Newer" compares the last commit that touched each file (`git log -1 --format=%ct -- <file>`);
   uncommitted changes are the newest.

| State of the spec folder                                                                            | Step                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A file has `status: awaiting-human`                                                                 | **Human gate**: stop                           |
| No `clarifications.md`                                                                              | [Discovery](references/discovery.md)           |
| `clarifications.md` is `answered`, and newer than `spec.md` (or no spec)                            | [Spec and decisions](references/spec.md)       |
| `spec.md` is `changes-requested`                                                                    | [Spec](references/spec.md), revision           |
| `spec.md` is `approved`, and a decision it links is `proposed` or has a `## Proposed change` for it | [Approval](references/approval.md)             |
| `spec.md` is `approved`, no `plan.md`                                                               | [Plan](references/plan.md)                     |
| `spec.md` is `approved`, and newer than `plan.md`                                                   | [Plan](references/plan.md), revision           |
| `plan.md` is `changes-requested`                                                                    | [Plan](references/plan.md), revision           |
| `plan.md` is `approved` or `auto-approved`, with unchecked steps                                    | [Implementation](references/implementation.md) |
| Every step of `plan.md` is checked                                                                  | Done: nothing to do                            |

For a bug folder, see [Bug](references/bug.md).

3. **Run the step**, following its reference file, and commit.
4. **Continue or stop.** If the step did not end at a human gate, run the next step in the same
   session when you can. Otherwise stop: the next run finds it with this same table.

### Coming back to the human

A step that ends at a human gate stops there: do not start the next step early, even partly. It
comes back to the human the same way every time, so they know at once what is asked of them and
where to put their attention.

1. **The file waiting for them opens with a `> [!IMPORTANT]` block**, right after the title or the
   new session's heading:
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

Never bury something the human must decide in prose: it is a question in `clarifications.md`, or an
item in the block.

If a status looks wrong, for example `answered` with questions left blank, do not fix it: treat
blank answers as open questions, and carry them to the next clarification session.

## Starting, postponing, and dropping a feature

Do these only when a human asks.

- **Start**: create `specs/NNN-feature-slug/`, and move the draft or backlog file into it as
  `proposal.md`. Numbers are never reused: take the highest number ever used, including folders
  deleted since (`git log --name-only --format= -- specs/`), plus one.
- **Postpone or block**: move `proposal.md` back to `specs/drafts/<slug>.md` or
  `specs/backlog/<slug>.md`, as the human prefers, and delete the rest of the folder. Git history
  keeps the discovery and questions. Move the `PRIORITIES.md` entry to the right section, with the
  reason when it is blocked.
- **Drop**: delete the folder, and remove the `PRIORITIES.md` entry.

When postponing or dropping, delete the feature's decisions that are still `proposed`, and the
`## Proposed change` sections it added. Keep the changes already applied: a human approved them, and
only a human can change them again. Commit with `chore(<number>): postpone <feature name>` or
`chore(<number>): drop <feature name>`.

## Commits

One commit per step, containing only that step's files. Messages follow
[Conventional Commits](https://www.conventionalcommits.org/), with one extra type per workflow step.
The scope is the spec folder's number, or the bug's slug. The description is the feature name for a
first version, and what changed for later commits.

| Type          | Step                                     | Example                                                     |
| ------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `discovery:`  | Discovery and questions                  | `discovery(001): recurring tasks`                           |
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
