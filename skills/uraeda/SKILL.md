---
name: uraeda
description:
  Asynchronous, git-driven spec workflow. Humans write proposals, answer questions, and approve
  specs; agents research, ask, and write specs, plans, code, and pull requests, committing every
  step. Use in a repository with a `specs/` folder when the user wants a feature or bug moved
  forward ("continue recurring tasks", "I answered the questions", "the spec is approved", "what is
  next?", "start the keyboard shortcuts draft", "assess the bug in specs/bugs/"), or to set Uraeda
  up ("set up specs/"). Finds the next step from the repository alone, and stops at human gates.
metadata:
  version: "0.1.0"
---

# Uraeda

Uraeda is an asynchronous design and development workflow: every step is checkpointed as plain text
in git. Humans write proposals, answer questions, and approve specs. Agents do the rest, and the
hard work upfront: an in-depth investigation, the questions only the human can answer, a complete
design to approve, then the plan, the code, and a pull request. The human never stays in a chat:
they answer when they have time, in files built so their time goes into thinking, not searching.
Assume a technical user, who reads code and designs.

This file holds the conventions shared by all steps, and tells you which step to run. Each step has
its own instructions in `references/`.

The `ura` command-line tool performs the mechanical parts of the steps: finding the next step,
checking files, recording answers and reviews, starting features. It is optional: every step below
says what to do by hand, and names the command that does it, to use when `ura` is installed. See
[The `ura` CLI](#the-ura-cli).

## Rules for agents

1. **Humans make the decisions.** Stay within the approved scope and decisions. Never activate a
   decision unless a human asked for it, for example by approving the spec that lists it.
2. **Work autonomously, in depth.** The workflow is asynchronous so that you have the time to
   research before the human is involved: use it. Read the code, the documentation, and online
   sources, broadly and completely, beyond the project and beyond what you already know. Never ask
   the human for something you could find out or settle yourself.
3. **Ask only what only the human can decide**: product direction, tradeoffs between their goals,
   choices that become decisions, and conflicts with the constitution or an active decision. Settle
   everything else within the constitution and active decisions, and record it as an assumption the
   human can object to. Every question comes with a recommended answer and its reason.
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
                            # in both, a folder is a postponed feature: <slug>/proposal.md, ...
  decisions/                # decision ledger, one file per topic: due-dates.md
  done/YYYY-MM-DD-<slug>.md # the record of a merged feature or bug, in place of its folder
  bugs/YYYY-MM-DD-<slug>/   # report.md (human), assessment.md (agent)
  YYYY-MM-DD-feature-slug/  # one folder per feature, dated the day it starts
    proposal.md             # human: what and why, in their own words
    discovery-01.md         # agent: findings and options, never decisions
    clarifications-01.md    # agent questions, human answers and notes
    discovery-02.md         # a later round, when one is needed
    clarifications-02.md
    spec.md                 # agent: behaviour and design, approved by a human, amended in place
    spec-review.md          # human: comments on the spec, with the verdict, when there are any
    plan.md                 # agent: tasks with files and test-first steps, checked off as built
    plan-review.md          # human: comments on the plan, when it is reviewed with comments
    rulings.md              # agent: low-impact choices made while planning and building
    data-model.md           # agent, when needed
    contracts/              # agent, when needed
    mockups/                # agent, for any UI work
```

Discovery and questions come in numbered rounds: each round is a new pair of files, and earlier
rounds are never edited. The spec and the plan are single files, amended in place: they are the
source of truth for the implementation.

Before any step, read `specs/CONSTITUTION.md` and the `active` decisions in `specs/decisions/` that
apply to your work: their **Applies to** section says where. The constitution wins over decisions,
and decisions win over specs and plans. Decisions are high-impact choices made by the human, and
they change over time: see [what is a decision](references/spec.md#what-is-a-decision).

Templates for every file are in `assets/templates/specs/`, at the same paths. A filled-in example,
for a todo app, is in `assets/example/specs/`: `2026-10-06-recurring-tasks/` is the model of every
file, from the proposal to a fully checked plan, with the blocks that waited for the human kept as
records. Other files show work still waiting for the human.

### Markdown

Workflow files must read well as plain text, on GitHub, and in Obsidian, the reference renderer. Use
GitHub Flavored Markdown, plus these extensions, which stay readable where they do not render:

- **Callouts**: `> [!IMPORTANT]`, `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!QUESTION]`.
- **Typed bullets**, with a word or sign that reads on its own: `- [pro]`, `- [con]`, `- [?]`
  question, `- [!]` important.
- **List callouts**, a marker after the dash, to highlight one bullet: `- ! warning`,
  `- ? question`, `- & note`.
- **Links**: markdown links, with a relative path (`[spec](spec.md)`) or a path from the repository
  root (`[auth](/src/auth.ts)`). Humans may write wikilinks (`[[due-dates]]`): read them, but do not
  write them. Link to what a file relies on: decisions, discovery, code.

Templates are strict where tools and agents need to find things, and free elsewhere:

- **Frontmatter**: exactly the fields this skill defines.
- **Headings**: the template's text, level, and order. Leave out an optional section entirely, never
  rename it.
- **Optional sections**: in the templates, their placeholder starts with `[Optional`.
- **Structured items**: fixed patterns, so they can be found and rendered: questions `## Q1: ...`,
  numbered from Q1, each with its `**Answer:**` line, and follow-ups `### Q1.B: ...`, on an option
  of their parent; options `- **A (recommended). ...**` with `[pro]` and `[con]` bullets; user
  stories `### US1: Title (P1)`; acceptance scenarios with **Given**, **When**, **Then**; success
  criteria `SC-001`; plan tasks `## Task 1: ...`; rulings `## R1: ...`; review comments
  `## C1: ...`.
- **Everything else**, inside sections, is free text.

With `ura`, run `ura check` before every commit of workflow files: it verifies the rules of this
file, and reports each problem with its file and line. In short: folder names `YYYY-MM-DD-<slug>`
with a real date, and rounds with two digits; the frontmatter fields of each file, with the values
of the [status table](#workflow-status), `plan-review` `true` or `false`, a spec's `clarifications`
at most its last round, and a plan's `spec-revision` at most the spec's `revision`; the template's
title, sections, and order, and no level-2 section the template does not have; the structured items
above; an answer for every question that applies once a round is `answered`; the `> [!IMPORTANT]`
block of a file waiting for the human; a record's name, `YYYY-MM-DD-<slug>.md`, its `finished` date,
its numbered rounds and questions, and its opening `> [!NOTE]` block; links to markdown files and
into `specs/` that resolve, anchors included; and the [review files](#review-files) rules.

### Branches

Each feature lives on its own branch, named after its folder (`2026-10-06-recurring-tasks`), from
the proposal to the code: discovery, questions, spec, decisions, plan, and implementation, until its
folder is [finished](#finishing-a-feature) into a record. Its pull request merges all of it at once.
Decisions become active on the branch when its spec is approved, and bind the rest of the project
once the branch is merged. A bug lives on `fix/YYYY-MM-DD-<slug>`, named after its folder. Run every
step on the target's branch: the human answers and approves on it too.

Never switch the human's checkout to reach a branch. Write where the branch is checked out, the
checkout itself or a worktree, or else in a worktree at `.worktrees/<branch>/`, at the root of the
main checkout, created with `git worktree add`. Keep `.worktrees/` out of `git status` through the
repository's `.git/info/exclude`, never a tracked file. When `core.hooksPath` is a relative path,
commit in a worktree with it made absolute from the main checkout, so the same hooks run. Worktrees
stay until removed with `git worktree remove`. `ura` does all of this.

### Workflow status

Workflow files track their state in frontmatter fields.

| File                   | Field            | Set by the agent                      | Set by the human                  |
| ---------------------- | ---------------- | ------------------------------------- | --------------------------------- |
| `proposal.md`          | `discovery`      |                                       | `low`, `medium`, or `high`        |
| `clarifications-NN.md` | `status`         | `awaiting-human`                      | `answered`                        |
| `spec.md`              | `status`         | `awaiting-human`                      | `approved` or `changes-requested` |
| `spec.md`              | `revision`       | `1`, then `+1` at every change        | `+1` when editing it              |
| `spec.md`              | `clarifications` | the last round it includes: `2`       |                                   |
| `spec.md`              | `risk-tier`      | `low`, `medium`, or `high`            | may change it on approval         |
| `spec.md`              | `plan-review`    | `true` for `high`, else `false`       | may change it on approval         |
| `plan.md`              | `status`         | `awaiting-human` or `auto-approved`   | `approved` or `changes-requested` |
| `plan.md`              | `spec-revision`  | the spec `revision` it implements     |                                   |
| `decisions/*.md`       | `status`         | `proposed`, then `active` on approval | `active`                          |
| `decisions/*.md`       | `approved-by`    | the approver, on approval, if known   | the approver                      |
| `bugs/*/assessment.md` | `status`         | `awaiting-human`                      | `approved` or `changes-requested` |

The bug flow is an agent-authored draft that needs human review: see [Bug](references/bug.md).

Only set a human status when the human expressly asks you to in the session, for example "the spec
is approved". Say so in the commit message: `spec(recurring-tasks): approved by the human in chat`.
When the human changes a spec's `risk-tier` on approval without naming `plan-review`, set
`plan-review` to the new tier's default. With `ura`, pass `--no-commit` to `ura answer` or
`ura review`, and commit with that message. With `changes-requested`, the human's feedback is in the
file's [review file](#review-files).

### Review files

A review of `spec.md`, `plan.md`, or `assessment.md` writes its comments in `spec-review.md`,
`plan-review.md`, or `assessment-review.md`, next to it, from
[the template](assets/templates/specs/YYYY-MM-DD-feature-slug/spec-review.md). The file exists only
when the latest review has comments: the next review replaces it, and a review without comments
deletes it. Git keeps the earlier ones. The reviewed file keeps its `status`, the source of truth.

- **Frontmatter**: `verdict`, `pending` while the human writes it, then `approved` or
  `changes-requested`; and `commit`, the short hash of the commit holding the version reviewed.
- **Comments**: `## C1: ...`, numbered from C1. A comment points to
  `Lines 50–52, under "<heading>"`, `Line 50, under "<heading>"`, or `General`: the line numbers are
  those of the version at `commit`, and the heading is the nearest one above them. A line comment
  quotes its lines, as a quote block, then says what it has to say.
- **Changes requested** need at least one comment.
- **Approved with comments**: the comments do not change the approved file. The next step carries
  them out, and says how: the plan, in its `## Review comments` section, for a spec; the
  implementation, in the pull request's description, for a plan or an assessment.

With `ura`, `ura review` writes the comments, `--comment 50-52 "<text>"` or
`--comment general "<text>"`, then records the verdict, `--approve` or `--request-changes`, with the
status, the block's record, and the commit.

An active decision is never edited before approval: changes are proposed in a `## Proposed change`
section at the end of the file, and applied when the spec that links to them is approved.

## Finding the next step

With `ura`, `ura next` runs this section's two steps and prints the target, its step, and the
reference to follow, or `ura next <feature>` for one feature; `ura status` shows every feature's
step. By hand:

1. **Pick the target.** Use the feature or bug the human named. Otherwise, read
   `specs/PRIORITIES.md` on the default branch, list the feature and bug branches (`git branch -a`),
   and take the first branch with work for an agent, in the order of the **Now** section. An entry
   matches the branch whose slug matches its file's name. Starting a feature is a human action: see
   [below](#starting-postponing-and-dropping-a-feature).
2. **Find the step.** Read the target's branch where it is checked out, or in its worktree (see
   [Branches](#branches)). In its spec folder, `NN` is the highest clarifications round. Go down
   this table and run the first row that matches.

| State of the spec folder                                                                        | Step                                                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `proposal.md` is not committed, and the branch has no record in `specs/done/`                   | **Human gate**: the human writes it, then commits it         |
| The record is in `specs/done/`, and no pull request is ready                                    | [Finish](references/finish.md)                               |
| The record, and the pull request has changes requested                                          | [Implementation](references/implementation.md), changes      |
| The record, and the pull request is ready for review                                            | **Human gate**: the review happens on the pull request       |
| A file has `status: awaiting-human`                                                             | **Human gate**: stop                                         |
| No `clarifications-01.md`                                                                       | [Discovery](references/discovery.md), round 01               |
| `clarifications-NN.md` is `answered`, and there is no `spec.md`, or its `clarifications` < NN   | [Spec and decisions](references/spec.md)                     |
| `spec.md` is `changes-requested`                                                                | [Spec](references/spec.md), revision                         |
| `spec.md` is `approved`, and a decision it links is `proposed`, or has a proposed change for it | [Approval](references/approval.md)                           |
| `spec.md` is `approved`, and there is no `plan.md`                                              | [Plan](references/plan.md)                                   |
| `spec.md` is `approved`, and the plan's `spec-revision` < the spec's `revision`                 | [Plan](references/plan.md), revision                         |
| `plan.md` is `changes-requested`                                                                | [Plan](references/plan.md), revision                         |
| `plan.md` is `approved` or `auto-approved`, with unchecked steps                                | [Implementation](references/implementation.md), next task    |
| Every step of `plan.md` is checked, and the pull request is a draft                             | [Finish](references/finish.md)                               |
| Every step of `plan.md` is checked, and the branch has no pull request                          | [Implementation](references/implementation.md), final review |
| The branch's pull request has changes requested                                                 | [Implementation](references/implementation.md), changes      |
| The branch has an open pull request                                                             | **Human gate**: the review happens on the pull request       |

For a bug branch, see [Bug](references/bug.md).

3. **Run the step**, following its reference file, and commit.
4. **Continue or stop.** If the step did not end at a human gate, run the next step in the same
   session when you can. Otherwise stop: the next run finds it with this same table.

The last two rows of the table are for pull requests opened before the
[Finish](references/finish.md) step existed. When a merged feature still has a worktree or a local
branch, tell the human to run `ura clean`, or give them the commands of
[Finish](references/finish.md#after-the-merge).

### Going back to the human with new questions

Any step can find something only the human can decide: an answer that raised a new unknown, spec
feedback asking for options, a plan or implementation blocked by something the spec and decisions do
not allow. Never work around it, and never leave it as a note only: start a new round. Write
`discovery-NN.md` and `clarifications-NN.md` with the next number, following
[Discovery](references/discovery.md), in the same commit. The new questions wait for the human like
the first ones, and the spec is amended once they are answered.

### Coming back to the human

A step that ends at a human gate stops there: do not start the next step early, even partly. It
comes back to the human the same way every time, so they see at once what is asked of them.

1. **The file waiting for them opens with a `> [!IMPORTANT]` block**, right after the title:
   - First line: what is asked, and an honest estimate of the time it takes to think it through. "12
     questions, about 30 minutes."
   - Then what most needs their attention, most important first, one line each, named by subject,
     not by a number the reader has not seen yet: choices that last beyond the feature, questions
     that work together, points settled without them, a changed decision, a risky assumption, a
     cost. The block orients the human: the details stay in the file.
   - On a revision: what changed since their last review.
2. **The commit message body repeats the block's first line**, so `git log` and any git listener
   show what is waiting, and for how long.
3. **In a chat session**, say the same in one or two sentences, with the file's path. If you were
   triggered without a chat session, the commit is the message: say nothing else.

A pull request's description opens the same way, as the implementation step describes.

**Once the human has answered or approved, the block becomes a record**, kept for later agents and
readers: it says what the human was asked to weigh. Its callout becomes `> [!NOTE]`, and its first
line becomes the outcome and its date: "Answered on 2026-10-08", "Approved on 2026-10-09". The items
stay as they were. If the human or a tool did not do it, the next step does it, in that step's
commit: it is the only edit allowed in an answered round of questions. `ura answer --submit` and
`ura review` do it.

**When the human requests changes, the block becomes a record too**: `> [!NOTE]`, with "Changes
requested on <date>" and their feedback in one line, the review's summary, under the new
`> [!IMPORTANT]` block of the revision. The new block says how each comment of the review file was
handled: "C1: done", "C2: declined, because ...".

Documents never explain how to use the workflow ("set `status: approved` and commit"): tools and
this skill do. Never bury something the human must decide in prose: it is a question in a
clarifications file, or an item in the block.

The workflow only moves on when every question is answered. A follow-up `Q2.B` needs an answer only
when its parent's answer starts with its letter: "B", "B and C: ...", "A, B". When the parent's
answer names no letter, the follow-up needs one, `-` if it does not apply. If a clarifications file
is `answered` with questions left blank, set its status back to `awaiting-human`, name the blank
questions in the first line of its block, and commit.

The human may also write under **Notes:**, at the end of the questions, about the points settled
without them: the spec step reads the notes like answers.

## Starting, postponing, and dropping a feature

Do these only when a human asks.

- **Draft**: a line of `PRIORITIES.md` becomes a draft in `specs/drafts/<slug>.md`, from the
  proposal template with the line as its title, and the line links to it. With `ura`,
  `ura draft <text>` does it, on the default branch, without committing, and opens the editor.
- **Start**: name the folder with today's date and a short slug of the feature's name,
  `YYYY-MM-DD-feature-slug`, like `2026-10-06-recurring-tasks`. The date never changes, even if the
  feature is renamed. If a folder or branch with that name exists, choose another slug. With `ura`,
  `ura start <draft>` runs these steps for a written draft file or postponed folder.
  1. On the default branch, move the feature's `PRIORITIES.md` entry to the end of **Now**, unless
     the human says otherwise, as a link to the future `proposal.md` from the repository root,
     `[Name](/specs/YYYY-MM-DD-feature-slug/proposal.md)`, and commit with
     `chore(<slug>): start <feature name>`. Entries match branches through that link.
     `PRIORITIES.md` lives on the default branch: feature branches only remove their own entry, in
     their last commit.
  2. Create the branch `YYYY-MM-DD-feature-slug` from there, checked out in its worktree,
     `.worktrees/YYYY-MM-DD-feature-slug/`, unless the human asks to switch their checkout to it. On
     it, create `specs/YYYY-MM-DD-feature-slug/`, and move the draft or backlog file into it as
     `proposal.md`, unchanged: the proposal is the human's words, never rewritten. When the entry is
     a folder, a feature postponed earlier, move all its files into it, unchanged. Commit with
     `chore(<slug>): proposal`. When the entry has no file, write `proposal.md` from the template
     with only what the human said, and do not commit it: the human writes it out, and commits it
     once it is ready. Until then, the feature waits at a gate on `proposal.md`, and no step runs.
  3. Then run the next step in the same session when you can: [Discovery](references/discovery.md),
     round 01, for a proposal alone, or the first matching row of
     [the table](#finding-the-next-step) for a folder. A round left waiting for answers stays at its
     gate. When the human asks for fresh research, start a new round instead, following
     [going back to the human](#going-back-to-the-human-with-new-questions).
- **Postpone or block**: on the feature's branch, move the whole folder to `specs/drafts/<slug>/` or
  `specs/backlog/<slug>/`, as the human prefers, without its date: the proposal, the discovery
  rounds, and the questions, answered or not, stay as they are. Delete the feature's `proposed`
  decisions, and the `## Proposed change` sections it added. In the same commit, move the
  `PRIORITIES.md` entry to the right section, with the reason when it is blocked, and link it to the
  folder's `proposal.md`. Commit with `chore: postpone <feature name>`, merge the branch into the
  default branch, and delete it.
- **Drop**: delete the branch, and the `PRIORITIES.md` entry, after the human confirms.

## Finishing a feature

Once a feature's final review or a bug's fix is done, its folder is replaced by one record,
`specs/done/YYYY-MM-DD-<slug>.md`, in the last commit of its branch, before its pull request is
ready: the default branch keeps what the feature does and why, and git keeps the rest. Links into
the folder are rewritten to the record, whose questions keep their anchors. Records are frozen once
merged. See [Finish](references/finish.md).

After the merge, the branch and its worktree stay until the human runs `ura clean`, which removes
them unless that would lose work.

## Commits

One commit per step, and one per task during the implementation, containing only its files. Messages
follow [Conventional Commits](https://www.conventionalcommits.org/), with one extra type per
workflow step. The scope is the feature's or the bug's slug, its folder's name without the date. The
description is the feature name for a first version, and what changed for later commits.

| Type          | Step                                     | Example                                                  |
| ------------- | ---------------------------------------- | -------------------------------------------------------- |
| `discovery:`  | A discovery and questions round          | `discovery(recurring-tasks): recurring tasks`            |
| `decision:`   | Apply approved decisions                 | `decision(recurring-tasks): apply due dates`             |
| `spec:`       | Write or revise a spec and its decisions | `spec(recurring-tasks): recurring tasks`                 |
| `plan:`       | Write or revise a plan                   | `plan(recurring-tasks): split the store migration`       |
| `assessment:` | Assess a bug                             | `assessment(completed-tasks-reappear): stale copy saved` |
| `finish:`     | Replace the folder with its record       | `finish(recurring-tasks): recurring tasks`               |

Code commits use the plan's messages, with the standard types and the same scope:
`feat(recurring-tasks): repeat menu`, `fix(completed-tasks-reappear): save new tasks as they are`.
The commit type is only a label: the `status` fields and the checkboxes are the source of truth.

## Setting up a project

When asked to set up Uraeda in a project, copy `assets/templates/specs/README.md`,
`CONSTITUTION.md`, and `PRIORITIES.md` into the project's `specs/` folder, and create its `drafts/`,
`backlog/`, `decisions/`, and `bugs/` folders, each with an empty `.gitkeep`, since git keeps no
empty folder. Never overwrite a file that exists. The constitution is the human's: help them write
it by asking about the project's goals and constraints, and propose principles with recommended
wording. Do not copy the feature, decision, or bug templates: they stay in this skill.

With `ura`, `ura init` does it, and installs this skill in `.agents/skills/uraeda/`, linked from
`.claude/skills/uraeda`, with a `.ura-manifest` of its files' hashes: running it again updates the
skill's files nobody edited. `ura init --no-skill` leaves the skill out.

## The `ura` CLI

Every command works without a terminal, with flags, and the read commands print JSON with `--json`.
A command that acts on a feature, a bug, or a draft takes it as a path under `specs/` or a name
matching one item, its folder name or slug; without it, the current branch's feature, or the only
one waiting for that action.

| Command                                                            | What it does                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `ura init`                                                         | [Sets a project up](#setting-up-a-project)                        |
| `ura status`                                                       | Every feature and bug, its step, and who it waits on              |
| `ura next [feature]`                                               | The target and its step, from [the table](#finding-the-next-step) |
| `ura check [path]`                                                 | The rules of [Markdown](#markdown), file by file                  |
| `ura draft <text>`                                                 | [Drafts](#starting-postponing-and-dropping-a-feature) a line      |
| `ura start <draft>`, `--switch`                                    | [Starts](#starting-postponing-and-dropping-a-feature) a feature   |
| `ura answer [feature] <Q2> <answer>`, `--submit`                   | Answers a round of questions, then submits it                     |
| `ura review [feature] --comment`, `--approve`, `--request-changes` | [Reviews](#review-files) a spec, plan, or assessment              |
| `ura clean [feature]`, `--all`, `--dry-run`                        | [Cleans](references/finish.md#after-the-merge) a merged feature   |
| `ura upgrade`                                                      | Installs `ura`'s latest release                                   |

`ura answer --submit` and `ura review` set the human's status, record the block, and commit: a human
runs them, or an agent the human asked, with `--no-commit`. Every command writes on a branch through
its worktree (see [Branches](#branches)); `ura start --switch` switches the checkout instead.

`ura` refuses, before writing anything, what would break these rules by hand too:

- An answer or a note with a line starting with `#`, `**Answer:**`, or `**Notes:**`, and a review
  comment with a line starting with `#`: they would read as a new heading or answer.
- A commit while other files are staged, since it would carry them; with `--switch`, a branch switch
  over uncommitted changes; a worktree whose folder is taken by something else.
- A draft that still holds the proposal template's placeholders, or an empty `## What` or `## Why`
  section: a committed proposal is work for an agent, so it must be the human's.
- A review file that does not parse: it may hold the human's comments, and is never overwritten.
- `ura start` on a bug: the bug flow starts by hand, until it has its spec.
