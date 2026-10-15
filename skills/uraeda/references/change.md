# Change

The light flow, for a bug fix or a small change: investigates the proposal, asks only what the human
must decide, makes the change with tests that fail first, has it reviewed, and opens a pull request,
all in one session.

- **Runs when**: a change branch, `change/YYYY-MM-DD-<slug>`, is at its `change` step, or its pull
  request has changes requested
- **Writes**: the code and its tests, `rulings.md`, a round of questions when one is needed, and the
  draft pull request
- **Ends at**: the [finish](finish.md) step; a human gate, a round of questions; or an offer to
  upgrade the change to a feature

A change has no discovery file, no spec, and no plan. The proposal is its approved scope: the human
wrote it, and nothing else waits for their approval. The investigation lives in the commits: each
code commit's body states the root cause or the approach, and what stays unchanged, so an agent
resuming the change reads it with `git log`. The human reads the pull request's description and the
record. A file waits on the human only when there is something to decide: a round of questions.

## What a change is

A change is a bug, behaviour that differs from what its spec, its record, its documentation, or a
reasonable user expects; or a small change to behaviour or UI, within the active decisions. One
proposal may list several related items, like three tweaks to the same sidebar: they make one
change, with one commit each and one pull request.

A proposal that needs more than this is an [upgrade](#upgrading) to a feature, not a bigger change.
Typos, formatting, and comments need no flow at all.

A change's folder is `specs/changes/YYYY-MM-DD-<slug>/`. It holds `proposal.md`,
`clarifications-NN.md`, `rulings.md`, `images/`, and `screenshots/`, nothing else: with `ura`,
`ura check` reports any other file.

## Starting a change

Only when a human asks. A change starts like a feature, with its own names, from the web UI's "New
change", with `ura start <draft> --slug <slug> --change`, or by hand: see **Start as a change** in
[Projects](projects.md#starting-postponing-and-dropping-a-feature).

**From a chat on the main checkout**, a request for a code change is offered as a change, not
committed to the default branch. Answer with what you would start: the draft's title, its text in
the human's own words, and the slug. Ask whether to start it as a change, and change no file before
the human says yes. On yes, commit the draft on the default branch, `chore: draft <title>`, and
start it as [Projects](projects.md#starting-postponing-and-dropping-a-feature) says. Then say to
open `/f/<folder>` in the web UI, where the change's own session runs: the chat stays a chat. Typos,
formatting, and comments stay in the chat, made there as before.

## Finding the step

With `ura`, `ura next <slug>` names the step. By hand, on the change's branch, go down this table
and run the first row that matches.

| State of the change's branch                                     | Step                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `proposal.md` is not committed, and there is no record           | **Human gate**: the human writes it, then commits it                    |
| The record is in `specs/done/`, and no pull request is ready     | [Finish](finish.md)                                                     |
| The record, and the pull request has changes requested           | [The pull request](#the-pull-request), changes                          |
| The record, and the pull request is ready for review             | **Human gate**: the review happens on the pull request                  |
| A file has `status: awaiting-human`                              | **Human gate**: stop                                                    |
| The branch has no pull request                                   | This file, from [Investigating](#investigating)                         |
| The folder came back, and a round answered since is not made yet | [Making the change](#making-the-change), then [the review](#the-review) |
| The branch's pull request is a draft                             | [Finish](finish.md)                                                     |
| The branch's pull request has changes requested                  | [The pull request](#the-pull-request), changes                          |
| The branch has an open pull request                              | **Human gate**: the review happens on the pull request                  |

Without `gh`, `ura` cannot see the pull request, and names `change` until the record exists: check
the pull request yourself.

The folder comes back when the branch reverts its finishing commit, for a round asked on the pull
request ([below](#the-pull-request)). A round answered after that revert, in `git log`, has its
change to make before finishing, though the pull request is a draft: `ura` cannot tell, and names
`finish`.

**Resuming** works as the implementation step's [resuming](implementation.md#before-the-first-task)
says, an item standing for a task. Read the proposal, the answered rounds, `rulings.md`, and
`git log` on the branch: each item committed is done, and its commit's body says what was found. The
proposal is read as it is now: the human may have edited it between two runs.

## Investigating

Read the proposal, the constitution, the active decisions whose **Applies to** covers the code
involved, and the record or spec of the feature the change touches, if there is one. Then the
investigation depends on what the proposal asks.

**A bug.** No fix without the root cause first, and no fix without a failing test that reproduces
the bug. A fix guessed from the symptom hides the bug and adds new ones.

1. **Reproduce it.** Follow the proposal's steps, then write the smallest test that fails because of
   the bug: an integration test, through the real components, following the spec step's
   [Tests](spec.md#tests) rules. Run it and keep its failure. If it does not fail every time, find
   what makes it fail: timing, order, data.
2. **Trace the root cause.** Follow the wrong value back through the code to where it first goes
   wrong, not where it shows. Check the recent changes to that code (`git log`), and compare with
   similar code that works. Fix the cause at its source.
3. **Confirm it.** State one hypothesis, and test it with the smallest change, one at a time. A
   hypothesis that fails is replaced, not stacked with another change.

A bug report needs what happens, what should happen, and how to see it. When the proposal lacks one
of them, or the bug does not reproduce, ask in a round: say what you tried, and what you need. After
three fixes that each failed the reproduction test, the approach is wrong, not the details: offer
the [upgrade](#upgrading), naming what you tried.

**A change.** Read the code it touches, the decisions, and the documentation of the dependencies
involved, to verify how they behave. Do not compare products online. This is the `low`
[discovery effort](discovery.md#discovery-effort), whatever the proposal's `discovery` field says:
the field matters again if the change is upgraded.

## Asking

Ask only what the human must decide, and settle the rest within the constitution and the active
decisions, as [discovery](discovery.md#what-to-ask-and-what-to-settle) says. A change asks for:

- **Intent the human would notice** in the result, that the proposal leaves open: what the header
  drops on a phone, which of two behaviours a fix keeps.
- **A change to an active decision**, to approve: see [Decisions](#decisions).
- **The upgrade**, when one of its reasons applies: see [Upgrading](#upgrading).

Ask in a round: `clarifications-NN.md` alone, with no discovery file, from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md), with
`status: awaiting-human`. Its questions follow the
[question structure](discovery.md#question-structure), recommended option first. Its Context section
carries what you found, with links to the code, since the human reads this one file: leave out the
template's links to a discovery file. Its block opens as
[Coming back to the human](../SKILL.md#coming-back-to-the-human) says. Then stop at the gate.

Once the round is answered, turn its block into a record, in the next commit, and continue from the
answers.

## Decisions

Decisions hold the human's intent, and they change with it. A change may need one rule of an active
decision changed: that is normal work, approved in a round, not a reason to upgrade. A brand-new
decision is a reason to upgrade.

1. **Propose it.** In the same commit as the round, add a `## Proposed change (<folder>)` section at
   the end of the decision, as the spec step's
   [new decision or change](spec.md#new-decision-or-change) describes, with every rule as it would
   read after the change. A change has no spec and no discovery file: who proposes it links the
   change's proposal, and its why links the round's question. The round asks to approve it, with "A
   (recommended). Approve the change" first, before any pull request.
2. **On "A"**, rewrite the decision with the proposed change and remove the section, as
   [approval](approval.md#apply-the-decisions) does, set `approved-by` to the human, and commit
   `decision(<slug>): apply <topic>`. Then continue.
3. **On another answer**, remove the section, and make the change within the decision as it is.

## Upgrading

Some changes need more than the light flow allows. Offer to make the change a feature when it needs:

- a new decision;
- a change to data users already have;
- a change to a public interface, such as a CLI flag, a file format, or an API;
- approved behaviour changed beyond what the proposal names, as a spec or a record says it;
- a new view;
- a constitution exception, or a new lint marker, since only a plan can carry its approval;
- after three fixes that failed the reproduction test.

The size of the diff is never a reason: it goes in the pull request.

Ask in a round, with the question "Make this change a feature?". Its context names the reason, such
as "It changes the format of `PRIORITIES.md`, which every project has", and option A is the upgrade.
When one item of a batch needs it, the round offers to split that item out instead.

- **On "A"**: the folder is postponed, as a feature's is
  ([Projects](projects.md#starting-postponing-and-dropping-a-feature)).
  1. One commit reverts what the branch committed outside the folder, so the merge brings only the
     folder: the code commits, with their rulings and screenshots, and every
     `decision(<slug>): apply <topic>` commit, since the human approved that change for this change
     only, and the feature proposes it again. Revert them with `git revert --no-commit`, newest
     first, and commit `revert(<slug>): undo the change before its upgrade`, its body listing the
     reverted commits.
  2. The branch's last commit moves the folder to `specs/drafts/<slug>/`, its files unchanged,
     removes the `## Proposed change (<folder>)` sections the change added, the ones the revert
     brought back included, and relinks **Now**'s entry to `drafts/<slug>/proposal.md`:
     `chore(<slug>): upgrade to a feature`.
  3. Merge the branch into the default branch, from the main checkout. The human's "A" asks for the
     cleanup too, and `ura clean` cannot do it, since the merge leaves no record or change folder:
     remove the change's worktree and delete its branch as
     [after the merge](finish.md#after-the-merge) says, never forced, or give the human those
     commands when you cannot. The human starts the draft as a feature.

  The started feature has an answered round and no discovery file, so its first step is the
  [spec](spec.md#is-the-scope-clear): it reads the change's rounds, which settled the change, not
  the feature's scope, and starts a new round, with its discovery file, at the proposal's
  [discovery effort](discovery.md#discovery-effort).

- **On "A", for one item of a batch**: on the default branch, write that item's text as
  `specs/drafts/<item-slug>.md`, add its entry on the line after the change's entry in **Now**, not
  nested under it, and commit `chore: draft <Name>`. Then make the other items. Finish removes the
  change's entry with its nested lines, and the
  [catch-up](implementation.md#catch-up-with-the-default-branch) brings the draft's line into the
  branch before it, so the draft's entry stays.
- **On another answer**: keep the change within that answer, or stop if it leaves nothing to do, and
  say so in the session.

When the merge into the default branch conflicts, stop and say so in the session. Never force it.

## Making the change

Run the project's validation once, before any change, as the implementation step does
[before the first task](implementation.md#before-the-first-task). Then make the change one item at a
time, one commit per item:

- **Tests first.** A test fails first for the bug or the new behaviour, for the intended reason: the
  proposal's expected behaviour stands for a spec's acceptance scenarios. Checks of preserved
  behaviour keep passing. Once the new test passes, make the break it exists for, see it fail, and
  revert it, as [tests that can fail](code-quality.md#tests-that-can-fail) says. A bug's fix commits
  the reproduction test with it.
- **The commit's body** states the root cause, for a bug, or the approach, for a change, and the
  behaviour that stays unchanged, with the test that checks it. A resumed agent and the reviewer
  read it there.
- **Structure first.** A function or file over the project's limit is split in a structural commit
  before the item grows it ([extract, don't grow](code-quality.md#extract-dont-grow)). A new lint
  marker is a reason to upgrade.
- **Benchmarks.** When the change touches what the constitution says to benchmark, record a baseline
  before the change, and compare after it, in the pull request.
- **UI work.** Run the browser tests through the real app, look at screenshots of each changed view,
  and commit them in the change's `screenshots/` when the project's decisions ask for them.
- **Rulings.** The choices a later reader would want explained go in the change's `rulings.md`, from
  [the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/rulings.md), in the same commit,
  as the [implementation step](implementation.md#rulings) describes.
- **Findings outside the proposal.** A problem found outside the proposal's items is not fixed in
  passing, and not dropped: note it in the inbox, as [agents' notes](inbox.md#agents-notes) says,
  with the change's slug, and name it in the pull request's description.

Run the project's validation before each commit. When something only the human can decide comes up
midway, ask in a round: the items already committed stay.

## The review

Once every item is committed, catch up with the default branch, as the implementation step's
[catch-up](implementation.md#catch-up-with-the-default-branch) describes. Then review the branch,
open its draft pull request, and run the finish step, as
[review the branch](implementation.md#review-the-branch) describes, with what differs for a change:
the reviewer is given the proposal and its answered rounds in place of the spec and the plan, and
there were no per-item reviews before it, so this one review is the change's only one. Fixes use the
change's scope.

## The pull request

Run the [finish](finish.md) step: the folder becomes its record, `kind: change`, and the finishing
commit removes the change's entry from `PRIORITIES.md`. The pull request's description is written
when it is marked ready, following [Coming back to the human](../SKILL.md#coming-back-to-the-human),
in this order:

1. **First line**: what is asked, and an honest time: "Pull request to review, about 5 minutes."
2. **The root cause or the approach**, in a few lines.
3. **What stays unchanged**, and the test of each item.
4. **The points you settled** without asking: the human checks your reading of the proposal here.
5. **Size**: each function and file the branch grew, with its length before and after.
6. **Screenshots** of a UI change.
7. **Rulings**: a link to `rulings.md` at the commit before finishing, and the ones that change
   behaviour, one line each.
8. **Minor findings** of the review, and the notes added to the inbox.
9. **Last line**: "Once merged, run `ura clean` to remove the worktree and the branch."

Changes requested on the pull request are handled as for a feature, as
[implementation](implementation.md#changes-requested-on-the-pull-request) and
[finish](finish.md#changes-asked-on-the-pull-request) say, with what differs for a change:

- **The record and `rulings.md` stand for the spec and the plan.** A change applied directly updates
  the record, as for a feature. When the folder is brought back, the record's changes noted before
  the revert go into `rulings.md`, one ruling each, since the proposal stays the human's words: the
  next record lists them under **Changes after approval**.
- **A new question** is a round as in [Asking](#asking): `clarifications-NN.md` alone, with no
  discovery file.
- **A new decision** is the [upgrade](#upgrading) offer, and a change to an active decision is
  proposed as in [Decisions](#decisions).
- **Once the round is answered**, the pull request is still a draft, and `ura` names finish: the
  [table](#finding-the-step)'s row for a folder that came back makes the change from the answers
  first, and reviews it, then finishes.

## Red flags

| Thought                                                   | Reality                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| "The fix is obvious, the test can come after"             | A fix without a failing test hides the bug. Reproduce it first.               |
| "I'll write an assessment so the human can check my plan" | The pull request is the review. Settled points go in its description.         |
| "This decision is in the way, I'll work around it"        | Propose the change to the decision, and ask in a round.                       |
| "It is a new field in the file, but a small one"          | Data users already have is an upgrade, whatever its size.                     |
| "The diff is big, I'll stop and ask"                      | Size is never a stop: list it in the pull request.                            |
| "One more fix and it will pass"                           | After three failed fixes the approach is wrong: offer the upgrade.            |
| "It's a small fix, I'll commit it to main from the chat"  | Offer it as a change: its branch, its tests, and its pull request.            |
| "I'll write a discovery file for this round"              | A change's round is `clarifications-NN.md` alone: findings go in its Context. |

## Commit

- **A round**: `discovery(<slug>): <what it asks>`. The commit message body is the first line of the
  block, "1 question, about 3 minutes."
- **A decision's change, applied**: `decision(<slug>): apply <topic>`.
- **Code**: `fix(<slug>): <what changed>` for a bug, `feat(<slug>): <what changed>` for a change,
  and `refactor(<slug>):` for a structural commit, each with its tests and its body.
- **The upgrade**: `revert(<slug>): undo the change before its upgrade`, when the branch committed
  outside the folder, then `chore(<slug>): upgrade to a feature`.
- **A split-out item**: `chore: draft <Name>`, on the default branch.
- **The record**: `finish(<slug>): <title>`, as the [finish](finish.md) step says.
