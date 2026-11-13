---
name: uraeda
description:
  Asynchronous, git-driven spec workflow. Humans write proposals, answer questions, and approve
  specs; agents research, ask, and write specs, plans, code, and pull requests, committing every
  step. Use in a repository with a `specs/` folder when the user wants a feature or a change moved
  forward ("continue recurring tasks", "I answered the questions", "the spec is approved", "what is
  next?", "start the keyboard shortcuts proposal", "continue the change in specs/changes/", "fix
  this bug"), or to set Uraeda up ("set up specs/"). Finds the next step from the repository alone,
  and stops at human gates.
metadata:
  version: "0.1.0"
---

# Uraeda

Uraeda is an asynchronous design and development workflow: every step is checkpointed as plain text
in git. The human writes a proposal, answers questions, and approves a spec. An agent does the rest:
the research, the questions only the human can answer, the design, the plan, the code, and a pull
request. The human never waits in a session. Assume a technical user, who reads code and designs.

This file says what the work is judged on, which step to run, and when to stop. Each step has its
own file in `references/`: read a step's file before running it.

> **A human's request stands above everything.** A direct request from the human stands higher than
> any test, decision, rule of this skill, or the constitution. Never refuse it, and never silently
> overrule it, whether by reverting it, skipping it, or bending it to fit. When it conflicts with a
> test, a decision, or the constitution, tell the human in the same response what conflicts and what
> each way out costs, and let them arbitrate. A test that fails because of a requested change is the
> test to change, after telling them, never the request. A request can also waive a gate, like "no
> review of the plan, build it tonight": follow it, and write it down in the file the gate was on.

## What the work is judged on

The feature lands right, with as little of the human's time as possible. Their time goes to the big
picture: what to build, how it should feel, and what they will not accept. Every small question they
answer, every point they must send back, and every fix they ask for after the merge is a cost this
workflow exists to remove.

Five habits follow, and every step applies them:

1. **Research, then decide.** You have the time the human does not: read the code, the
   documentation, and what others built, and try things. Then settle everything the human's goals
   already settle. Never ask what you could find out, and never offer a list where a recommendation
   is due.
2. **Ask early, ask little, then run.** Ask only what changes what the human will see or live with,
   all of it at once, each question with a recommended answer. Once they have answered, run to the
   next [human gate](#words) without checking in.
3. **Keep their words.** The proposal, every answer and note, every review comment, and what they
   wrote in a session are the human's words, the images they attached included: open them. Nothing
   you write contradicts one, the latest winning over the earlier. Whatever you chose for them that
   changes what they get is said first, where they read, never buried.
4. **Use what you built.** Before handing work over, drive it yourself as its user will: every act,
   at every width the project serves, with real content. A feature the human must send back for
   something one use would have shown is not done.
5. **Write for one read.** The human reads a file once, top to bottom, days later, with nothing else
   open. Follow [Writing for the human](references/writing.md) in every file they read.

## Words

- **Proposal**: the human's request, in their own words, in `proposal.md`. Never rewritten.
- **Round**: one set of questions for the human, in `clarifications-NN.md`. A feature's round comes
  with the research behind it, `discovery-NN.md`. An answered round keeps the human's words as they
  wrote them.
- **Spec**: `spec.md`, what the feature does and how it is built. The human approves it.
- **Plan**: `plan.md`, the tasks that build the spec, checked off as they are built.
- **Decision**: a boundary the human set for the whole project, in their own words, in
  `specs/decisions/`. See [what is a decision](references/spec.md#what-is-a-decision).
- **Guide**: a free-form file that says how an area should feel and behave: `specs/ui/` for a UI,
  `specs/guides/` for any other area.
- **Ruling**: a choice made while planning or building, whose reason would otherwise be lost, in
  `rulings.md`. It binds nothing outside its feature.
- **Finding**: a problem a review reports, in `findings-NN.md`, committed before it is fixed.
- **Change**: the light flow, for a bug fix or a small change: a proposal, then the code, then a
  pull request. See [Change](references/change.md).
- **Record**: the one file that replaces a feature's or a change's folder when it is finished, in
  `specs/done/`.
- **Block**: the `> [!IMPORTANT]` callout that opens a file waiting for the human. It says what is
  asked, how long it takes, and what needs their attention.
- **Human gate**: a point where only the human can move the work on: a proposal to write, a round to
  answer, a spec or a plan to review, a pull request to merge.

## The `specs/` folder

```sh
specs/
  README.md                 # layout and conventions, links to this skill
  CONSTITUTION.md           # project principles, by priority: always binding
  PRIORITIES.md             # Now, Next, Later
  INBOX.md                  # notes to organize later, by category
  INBOX-TRIAGE.md           # an agent's proposed outcome for each note, as questions
  proposals/                # upcoming features: <slug>.md, or <slug>/proposal.md with images/
  notes/                    # note files: inbox notes with images, and agents' notes
  decisions/                # one file per topic: due-dates.md
  ui/                       # the UI's guides, free form: read before designing a view
  guides/                   # the guides of other areas, free form: git, runs, the toolchain
  done/YYYY-MM-DD-<slug>.md # the record of a merged feature or change
  changes/YYYY-MM-DD-<slug>/ # one folder per change: proposal.md, clarifications-NN.md,
                            # rulings.md, findings-NN.md, images/, mockups/
  YYYY-MM-DD-feature-slug/  # one folder per feature, dated the day it starts
    proposal.md             # human: what and why
    discovery-01.md         # agent: findings and options, never decisions
    clarifications-01.md    # agent: questions; human: answers and notes
    spec.md                 # agent: what the human approves; amended in place
    spec-review.md          # human: comments on the spec, with the verdict
    data-model.md           # agent, with the spec: stored data and file formats it changes
    plan.md                 # agent: tasks, checked off as built
    plan-review.md          # human: comments on the plan, when it is reviewed
    rulings.md              # agent: choices whose reason would otherwise be lost
    findings-NN.md          # reviewers: a review's findings, before their fixes
    contracts/              # agent, when the feature exposes an interface
    mockups/                # agent: mockups, and a round's prototypes until the spec's approval
    images/                 # images the human attached
```

Later rounds are new files, `discovery-02.md` and `clarifications-02.md`. The spec and the plan are
single files, amended in place: they are the source of truth for the build.

Before any step, read `specs/CONSTITUTION.md`, the decisions whose **Applies to** covers your work,
and the project's guides for the area you touch. The constitution wins over decisions, and decisions
win over specs and plans. A decision on the default branch is in force. A branch that creates or
changes one edits it in place: the difference is its proposal, which the human approves with the
spec, and the merge brings in. Templates for every file are in `assets/templates/specs/`, at the
same paths, and `assets/example/specs/` holds a filled-in project: `2026-10-06-recurring-tasks/`
shows every file of a feature.

## Finding the next step

With `ura`, `ura next` prints the target, its step, and the file to follow, and `ura status` shows
every feature's step. See [The `ura` CLI](references/cli.md). By hand:

1. **Pick the target.** Use the feature or change the human named. Otherwise read
   `specs/PRIORITIES.md` on the default branch, and take the first started proposal of **Now** whose
   branch has work for an agent. Starting a feature or a change is the human's call: see
   [Projects](references/projects.md#starting-postponing-and-dropping-a-feature).
2. **Find the step.** Read the target's branch where it is checked out, or in its worktree, never by
   switching the human's checkout (see [Branches](references/conventions.md#branches)). `NN` is the
   highest round. Go down the table and run the first row that matches. A change has its own table,
   in [Change](references/change.md#finding-the-step).

| State of the feature's branch                                                        | Step                                                                   |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `proposal.md` is not committed, and there is no record                               | **Human gate**: the human writes it                                    |
| The record is there, and no pull request is ready                                    | [Finish](references/finish.md)                                         |
| The record, and the pull request has changes requested                               | [Comments](references/implementation.md#comments-on-the-pull-request)  |
| The record, and the open pull request is behind the default branch                   | [Catch up](references/implementation.md#catch-up-an-open-pull-request) |
| The record, and the open pull request lacks the branch's latest commits              | [Push](references/implementation.md#push)                              |
| The record, and the pull request is ready                                            | **Human gate**: the review happens on the pull request                 |
| A file has `status: awaiting-human`                                                  | **Human gate**: stop                                                   |
| No `clarifications-01.md`                                                            | [Discovery](references/discovery.md), round 01                         |
| Round NN is `answered`, not resuming, and no `spec.md`, or its `clarifications` < NN | [Spec](references/spec.md)                                             |
| `spec.md` is `changes-requested`                                                     | [Spec](references/spec.md#revising), revision                          |
| `spec.md` is `approved`, and there is no `plan.md`, or its `spec-revision` is behind | [Plan](references/plan.md)                                             |
| `plan.md` is `changes-requested`                                                     | [Plan](references/plan.md#revising), revision                          |
| `plan.md` is `approved` or `auto-approved`, with unchecked steps                     | [Implementation](references/implementation.md)                         |
| Every step is checked, and the branch has no pull request                            | [Final review](references/implementation.md#final-review)              |
| Every step is checked, and the pull request is a draft                               | [Finish](references/finish.md)                                         |

A feature whose pull request was opened before its record follows the same rows without the record.
Without `gh`, `ura next` cannot see the pull request, and says so: check it yourself.

3. **Run the step**, following its file, and commit. A message asking to address a pull request's
   comments runs the [comments pass](references/implementation.md#comments-on-the-pull-request),
   whatever the table says.
4. **Run to the next human gate**, step after step, in the same session, without reporting between
   steps. An auto-approved plan goes straight on to the build, and a finished build to its review,
   its pull request, and its record.

### What is not a gate

Agents stopping early cost the human more than any other habit: they come back to work that waited
for nothing. A step is over when its file says so, and the run is over at a human gate. None of
these is one: a task or a review that just ended, a fix you just made, a failing test, a merge
conflict you can resolve within the spec, a long build, an answer the human gave in the session, or
doubt about a detail the spec lets you settle. Go on.

Stop before a gate only for what a step's file names: a choice only the human can make, or an action
that cannot be undone. Then say why in your last message, in a sentence. When a harness runs each
step as its own session, its message says where that session ends: stop there.

### Going back to the human with new questions

Any step can find something only the human can decide: an answer that raised a new unknown, a review
asking for options, a build blocked by something the spec and the decisions do not allow. Never work
around it, and never leave it as a note: start a new round, with the next number, following
[Discovery](references/discovery.md). Ask everything the rest of the work needs, so it is the last
round. A change's round has no discovery file: see [Change](references/change.md#asking).

### Coming back to the human

A step that ends at a human gate stops there: do not start the next step early, even partly. It
comes back the same way every time:

1. **The file waiting for them opens with [the block](references/writing.md#the-block)**: what is
   asked, the time it takes, and what most needs their attention, most important first.
2. **The commit message's body is the block's first line**, so `git log` shows what waits.
3. **In a session the human follows**, say the same in one or two sentences, with the file's path.
   In a run nobody follows, the commit is the message.

Once the human has answered or reviewed, the block becomes a note of what they were asked: its
callout turns to `> [!NOTE]`, and its first line to the outcome and its date, "Answered on
2026-10-08". If the human or a tool did not do it, the next step does, in its own commit.
[The block](references/writing.md#the-block) has the details.

Never bury something the human must decide in prose: it is a question in a round, or an item of the
block. Never explain how the workflow works in a file for the human: tools and this skill do.

## In a session

When the human talks with you, the same habits hold, in a smaller form:

- **Answer short.** What changed, what they must decide, and the next action. One recommendation,
  backed by the work behind it, never "X or Y" for them to sort out.
- **A code change is offered as a change.** When the human asks a session on the main checkout for a
  fix or a small change to the code, offer to start it as a
  [change](references/change.md#starting-a-change), with its own branch and pull request. Start
  nothing without their yes. Typos, formatting, and comments stay in the session.
- **A file reviewed live is one revision.** When the human works through a round, a spec, or a plan
  with you in the session, edit it in place as they speak, and commit once, when they say it is
  done.
- **Set a human status only when they say so**: "the spec is approved". See
  [Workflow status](references/conventions.md#workflow-status).

## References

- [Discovery](references/discovery.md): the research, and a round of questions.
- [Spec](references/spec.md): the spec and its decisions, and revising them after a review.
- [Plan](references/plan.md): the tasks of an approved spec.
- [Implementation](references/implementation.md): the build, its reviews, the final review, and the
  open pull request: push, catch-up, and comments.
- [Finish](references/finish.md): the record, the pull request's body, and after the merge.
- [Change](references/change.md): the light flow, from its proposal to its pull request.
- [Code quality](references/code-quality.md): one home per rule, structure before behaviour, rules
  that tools check, and testing.
- [Writing for the human](references/writing.md): every file the human reads, and the shape of a
  round. Read it before writing one.
- [Conventions](references/conventions.md): markdown, status fields, review files, branches, and
  commits. Read it before writing or committing a workflow file.
- [Inbox](references/inbox.md): notes, the triage, and when an agent writes a note.
- [Projects](references/projects.md): setting a project up, and starting, postponing, or dropping a
  feature. Read it when the human asks for one of these.
- [The `ura` CLI](references/cli.md): the commands. Without `ura`, every mechanical step is in
  [By hand](references/by-hand.md).
