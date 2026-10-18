---
name: uraeda
description:
  Asynchronous, git-driven spec workflow. Humans write proposals, answer questions, and approve
  specs; agents research, ask, and write specs, plans, code, and pull requests, committing every
  step. Use in a repository with a `specs/` folder when the user wants a feature or a change moved
  forward ("continue recurring tasks", "I answered the questions", "the spec is approved", "what is
  next?", "start the keyboard shortcuts draft", "continue the change in specs/changes/", "fix this
  bug"), or to set Uraeda up ("set up specs/"). Finds the next step from the repository alone, and
  stops at human gates.
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

This file tells you which step to run, and how to come back to the human. Each step has its own
instructions in `references/`, and the conventions shared by all steps are in
[Conventions](references/conventions.md): read the [references](#references) each step names.

The `ura` command-line tool performs the mechanical parts of the steps: finding the next step,
checking files, recording answers and reviews, starting features. It is optional: every step below
says what to do by hand, and names the command that does it, to use when `ura` is installed. See
[The `ura` CLI](references/cli.md).

## Rules for agents

1. **Humans make the decisions.** Stay within the approved scope and decisions. Never activate a
   decision unless a human asked for it, for example by approving the spec that lists it.
2. **Work autonomously, in depth.** The workflow is asynchronous so that you have the time to
   research before the human is involved: use it. Read the code, the documentation, and online
   sources, broadly and completely, beyond the project and beyond what you already know. Never ask
   the human for something you could find out or settle yourself. When a human's file links an
   image, open it.
3. **Ask only what only the human can decide**: product direction, tradeoffs between their goals,
   choices that become decisions, and conflicts with the constitution or an active decision. Settle
   everything else within the constitution and active decisions, and record it as an assumption the
   human can object to. Every question comes with a recommended answer and its reason.
4. **Ask everything in one round.** Anticipate follow-up questions, so the human answers once. A new
   round is only for unknowns their answers created.
5. **Write for a human reading top to bottom.** Humans read a document once, in order: never refer
   to something before it is introduced, and give the context each part needs where it is needed,
   with links to the code, documentation, and web pages it relies on. Follow
   [Writing for the human](references/writing.md) in every file the human reads.
6. **Come back with a clear message.** Every file waiting for the human opens with what is asked of
   them, how long it takes, and where their attention matters most: see
   [Coming back to the human](#coming-back-to-the-human).
7. **End every step with a commit.** The next step may be run by a different agent, in a different
   session, days later: everything it needs must be in the repository.
8. **In a chat, offer a change for a code change.** When the human asks a chat on the main checkout
   for a fix or a small change to the code, offer to start it as a
   [change](references/change.md#starting-a-change), with its own branch, session, and pull request,
   rather than committing to the default branch. Start it only on their yes. Typos, formatting, and
   comments stay in the chat.

## The `specs/` folder

```sh
specs/
  README.md                 # layout and conventions, links to this skill
  CONSTITUTION.md           # project principles, by priority: always binding
  PRIORITIES.md             # Now, Next, Later, Blocked
  INBOX.md                  # notes to organize later, by category
  INBOX-TRIAGE.md           # an agent's proposed outcome for each note, answered like questions
  drafts/                   # upcoming features, human-written, free form
  backlog/                  # nice-to-have features, not scheduled
                            # in both, a folder is a postponed feature, or a draft with images:
                            # <slug>/proposal.md, images/, ...
  decisions/                # decision ledger, one file per topic: due-dates.md
  done/YYYY-MM-DD-<slug>.md # the record of a merged feature or change, in place of its folder
  changes/                  # one folder per change, YYYY-MM-DD-<slug>/: proposal.md (human),
                            # clarifications-NN.md, rulings.md, images/, mockups/, screenshots/
  YYYY-MM-DD-feature-slug/  # one folder per feature, dated the day it starts
    proposal.md             # human: what and why, in their own words
    discovery-01.md         # agent: findings and options, never decisions
    clarifications-01.md    # agent questions, human answers and notes
    discovery-02.md         # a later round, when one is needed
    clarifications-02.md
    spec.md                 # agent: what you approve, decisions, stories, architecture; amended
    spec-review.md          # human: comments on the spec, with the verdict, when there are any
    plan.md                 # agent: tasks with files and test-first steps, checked off as built
    plan-review.md          # human: comments on the plan, when it is reviewed with comments
    rulings.md              # agent: low-impact choices made while planning and building
    data-model.md           # agent, with the spec: the stored data or file formats it changes
    contracts/              # agent, when needed
    mockups/                # agent: HTML mockups, or the stories of a mockups Storybook
    images/                 # images a human attached, linked from their files
```

Discovery and questions come in numbered rounds: each round is a new pair of files, and earlier
rounds are never edited. The spec and the plan are single files, amended in place: they are the
source of truth for the implementation.

Before any step, read `specs/CONSTITUTION.md` and the `active` decisions in `specs/decisions/` that
apply to your work: their **Applies to** section says where. The constitution wins over decisions,
and decisions win over specs and plans. Decisions are high-impact choices made by the human, and
they change over time: see [what is a decision](references/spec.md#what-is-a-decision).

A decision changes only on the branch that asks for it, edited in place. It stays `proposed` until
the human approves the spec that lists it, or a change's round. The default branch keeps the active
text until the branch merges. See
[new decision or change](references/spec.md#new-decision-or-change) and
[Change](references/change.md#decisions).

Templates for every file are in `assets/templates/specs/`, at the same paths. A filled-in example,
for a todo app, is in `assets/example/specs/`: `2026-10-06-recurring-tasks/` is the model of every
file, from the proposal to a fully checked plan, with the blocks that waited for the human kept as
records. Other files show work still waiting for the human.

## Finding the next step

With `ura`, `ura next` runs this section's two steps and prints the target, its step, and the
reference to follow, or `ura next <feature>` for one feature; `ura status` shows every feature's
step. By hand:

1. **Pick the target.** Use the feature or change the human named. Otherwise, read
   `specs/PRIORITIES.md` on the default branch, list the feature and change branches
   (`git branch -a`), and take the first branch with work for an agent, in the order of the **Now**
   section. An entry matches the branch whose slug matches its file's name. Starting a feature or a
   change is a human action: see
   [Projects](references/projects.md#starting-postponing-and-dropping-a-feature).
2. **Find the step.** Read the target's branch where it is checked out, or in its worktree (see
   [Branches](references/conventions.md#branches)). In its spec folder, `NN` is the highest
   clarifications round. Go down this table and run the first row that matches.

| State of the spec folder                                                                      | Step                                                         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `proposal.md` is not committed, and the branch has no record in `specs/done/`                 | **Human gate**: the human writes it, then commits it         |
| The record is in `specs/done/`, and no pull request is ready                                  | [Finish](references/finish.md)                               |
| The record, and the pull request has changes requested                                        | [Implementation](references/implementation.md), changes      |
| The record, and the pull request is ready for review                                          | **Human gate**: the review happens on the pull request       |
| A file has `status: awaiting-human`                                                           | **Human gate**: stop                                         |
| No `clarifications-01.md`                                                                     | [Discovery](references/discovery.md), round 01               |
| `clarifications-NN.md` is `answered`, and there is no `spec.md`, or its `clarifications` < NN | [Spec and decisions](references/spec.md)                     |
| `spec.md` is `changes-requested`                                                              | [Spec](references/spec.md), revision                         |
| `spec.md` is `approved`, and a decision an item of its `## Decisions` names is `proposed`     | [Approval](references/approval.md)                           |
| `spec.md` is `approved`, and there is no `plan.md`                                            | [Plan](references/plan.md)                                   |
| `spec.md` is `approved`, and the plan's `spec-revision` < the spec's `revision`               | [Plan](references/plan.md), revision                         |
| `plan.md` is `changes-requested`                                                              | [Plan](references/plan.md), revision                         |
| `plan.md` is `approved` or `auto-approved`, with unchecked steps                              | [Implementation](references/implementation.md), next wave    |
| Every step of `plan.md` is checked, and the pull request is a draft                           | [Finish](references/finish.md)                               |
| Every step of `plan.md` is checked, and the branch has no pull request                        | [Implementation](references/implementation.md), final review |
| The branch's pull request has changes requested                                               | [Implementation](references/implementation.md), changes      |
| The branch has an open pull request                                                           | **Human gate**: the review happens on the pull request       |

For a change branch, see [Change](references/change.md).

3. **Run the step**, following its reference file, and commit.
4. **Continue to the next human gate.** A run stops only at a human gate, or for a reason to stop
   that the step's reference names, such as a new round of questions. If the step did not end at
   one, find and run the next step in the same session: an auto-approved plan goes straight on to
   the implementation. Do not stop between steps to report or to check in. If you cannot go on, say
   why in your last message: the next run finds the step with this same table.

**A file in an old format.** When a workflow file of the target fails `ura check`, or the rules of
[Conventions](references/conventions.md#markdown), because the skill changed its format, rewrite it
in the new format first, from its template. Keep its content, and the human's answers, notes, and
comments, word for word. Commit it on its own, `chore(<slug>): rewrite <file> in the new format`,
then run the step. An answered round stays answered: only its form changes.

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
the first ones, and the spec is amended once they are answered. A change's round differs: it has no
discovery file, and a new decision there is an offer to upgrade: see
[Change](references/change.md#asking).

### Coming back to the human

A step that ends at a human gate stops there: do not start the next step early, even partly. It
comes back to the human the same way every time, so they see at once what is asked of them.

1. **The file waiting for them opens with a `> [!IMPORTANT]` block**, right after the title:
   - First line: what is asked, and an honest estimate of the time it takes to think it through. "12
     questions, about 30 minutes."
   - Then what most needs their attention, most important first, one line each, named by subject,
     not by a number the reader has not seen yet: choices that last beyond the feature, questions
     that work together, points settled without them, a changed decision, a risky assumption,
     outside behaviour not verified yet, a relaxed security guard said as what an attacker could do,
     a cost. The block orients the human: the details stay in the file.
   - On a revision: what changed since their last review.

   A round of questions adds a count in digits and a verdict first, as
   [the block](references/writing.md#the-block) describes. A spec's first item starts "You approve",
   as [a spec](references/writing.md#a-spec) describes.

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
requested on <date>" and their feedback in one line, the review's summary. A plan keeps it under the
new `> [!IMPORTANT]` block of the revision. A spec moves it to the top of its `## History` section,
and answers each comment of the review file in `## Your review`:
`- **C2** (undo too short): done. The undo stays 5 seconds.` See
[Revising](references/spec.md#revising).

Documents never explain how to use the workflow ("set `status: approved` and commit"): tools and
this skill do. Never bury something the human must decide in prose: it is a question in a
clarifications file, or an item in the block.

The workflow only moves on when every question is answered. A follow-up `Q2.B` needs an answer only
when its parent's answer starts with its letter: "B", "B and C: ...", "A, B". A parent answered
without a letter, in the human's own words, closes its follow-ups: they need no answer. If a
clarifications file is `answered` with questions left blank, set its status back to
`awaiting-human`, name the blank questions in the first line of its block, and commit.

The human may also write under **Notes:**, at the end of the questions, about the points settled
without them: the spec step reads the notes like answers. A comment on one settled point is a bullet
at the end of the notes, starting with that point's bold subject:
`- **Undoing a completion**: Keep the undo, but say what it restored.` Its further lines are
indented by two spaces. The web UI writes comments on settled points this way, and a human can write
them by hand.

## References

Read a step's reference before running it, and the others when the step needs them:

- [Discovery](references/discovery.md): a round of findings and questions, the first or a new one.
- [Spec](references/spec.md): writing or revising a spec and its decisions, once the answers are in.
- [Approval](references/approval.md): applying the decisions of an approved spec.
- [Plan](references/plan.md): writing or revising the plan of an approved spec.
- [Implementation](references/implementation.md): the plan's tasks, the final review, the pull
  request, and the changes it requests.
- [Finish](references/finish.md): replacing a folder with its record, and cleaning up after merge.
- [Change](references/change.md): the light flow, for a bug fix or a small change, from its proposal
  to its pull request.
- [Code quality](references/code-quality.md): the six code-quality concepts each step links to, and
  how a project sets up its checks.
- [Writing for the human](references/writing.md): the writing rules of every file the human reads,
  and the shape of a round of questions; read it before writing one.
- [Conventions](references/conventions.md): markdown, the status table, review files, branches and
  worktrees, and commits; read it before writing or committing a workflow file.
- [Inbox](references/inbox.md): the inbox's format, writing notes, organizing them by hand or with a
  triage, and noting a problem found outside your task.
- [Projects](references/projects.md): setting up a project, starting, postponing, or dropping a
  feature, and finishing one; read it when the human asks for one of these.
- [The `ura` CLI](references/cli.md): every command and what it refuses; read it before running
  `ura`.
