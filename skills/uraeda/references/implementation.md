# Implementation

Builds the plan one task at a time, one commit per task, then delivers the branch as a pull request
for the human to review.

- **Runs when**: `plan.md` is `approved` or `auto-approved`, with unchecked steps; or every step is
  checked and the branch has no pull request; or its pull request has changes requested
- **Writes**: code and tests, the step checkboxes of `plan.md`, `rulings.md`, and the draft pull
  request
- **Ends at**: the [finish](finish.md) step; a human gate, the pull request, after changes requested
  on it; or a new [discovery](discovery.md) round, when blocked

The plan already did the thinking: execute it exactly, prove each task with tests you watched fail
then pass, and leave the record in git. Nobody waits in a chat: do not stop to check in between
tasks. Git is the only memory: the checked boxes of `plan.md` and the commits say how far the work
went, so any agent can resume it.

## Before the first task

1. Read `plan.md` in full. Its **Global constraints** apply to every task, and its **Review focus**
   lists the behaviours the plan adds to the spec.
2. Read `spec.md`: the plan argues from it. When they disagree, the spec wins.
3. Read the constitution, and the active decisions that apply to the code you will touch, as they
   are now. A human may have changed one since the plan was written: if it now conflicts with the
   spec or the plan, stop and start a new round of questions, following
   [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).
4. If the human reviewed the plan, turn its `> [!IMPORTANT]` block into a record, in the first
   task's commit: see [Coming back to the human](../SKILL.md#coming-back-to-the-human). When they
   approved it with comments, `plan-review.md` holds them: carry each one out, and say how in the
   pull request's description.
5. Run the project's validation once, before any change: formatter, linter, type checker, tests. A
   failure that is already there is reported in the pull request, not fixed in passing.

**Resuming**: start at the first task with an unchecked step; with `ura`, `ura next` names it.
Commits are the only progress: a task whose boxes are checked is done, even if you do not remember
doing it. Changes left uncommitted by an interrupted session are not trusted: read them, and redo
that task from its first step.

## For each task, in order

One task at a time, in the plan's order: each task is built and tested on what the earlier ones
made. If your harness can run agents, give each task to a fresh implementer agent, with the task's
text, the global constraints, the path of the spec, and what earlier tasks produced, but not your
session's history. Otherwise, implement it yourself.

1. **Read the task**, all of it, even one you remember: its text has the exact values. Check its
   **Consumes** against what the earlier tasks actually produced in the code.
2. **Work its steps in order.** Write the tests first, run them, and watch them fail. A test that
   passes before the implementation exists proves nothing: fix the test. Then implement, and run
   every command the plan gives. Compare each output with the step's **Expected** line:
   - **It matches**: go to the next step.
   - **The code is wrong**: find the root cause before changing anything: reproduce the failure,
     trace the wrong value back to where it first goes wrong, and test one hypothesis at a time, as
     the [bug step](bug.md#assess) describes. Never change a test or an expected value to make a run
     pass.
   - **The plan is wrong**: a name that does not match its producer, a command that cannot run, a
     failure that cannot happen. Make the smallest change that satisfies the spec, edit the plan's
     text to describe what was built, so later tasks read the right names, and write a ruling in
     `rulings.md`.
3. **Run the project's validation**: formatter, linter, type checker, and every test.
4. **Check the task's boxes** in `plan.md`, and commit them with the code and tests, using the
   plan's commit message. Check a box only for a step that ran, with the output the plan expects:
   the next agent trusts it without running it again.
5. **Review the task**, when your harness can run a fresh reviewer agent. Give it the task's text,
   the spec, the global constraints, and the diff of the task's commits. It checks that the code
   does what the task and the spec say, nothing missing and nothing extra, then the code's quality.
   Fix what matters in new commits, each fix with a test that fails first. After five rounds, rule
   on what remains, in `rulings.md`, and go on.

### Rulings

Settle implementation details yourself: the spec is the authority, the plan argues from it, and your
judgement settles what neither answers. Every deviation from the plan, and every choice a later
reader would want explained, is a ruling: write it in the feature's `rulings.md`, from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/rulings.md), in the same commit as
the code it concerns. It is the feature's small ledger of low-impact decisions, in a fixed format:
what was decided, why, the alternatives considered, and what it costs if it is wrong.

A ruling is never a [decision](spec.md#what-is-a-decision): it applies inside this feature only. A
choice that would bind future work, or that only the human can make, is a reason to stop, below.

### When you must stop

Stop, and start a new round of questions, following
[going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions), when a task
needs:

- Something the spec, the active decisions, or the constitution do not allow, or a choice that would
  become a [decision](spec.md#what-is-a-decision)
- A plan so broken that every way forward is a guess
- An irreversible or destructive operation, a security-sensitive action, or a side effect outside
  the branch: deleting real data, pushing to another branch, publishing

Never work around it. The tasks already committed stay checked. Once the human answers, the spec is
amended and approved, and the plan revised: the unchecked tasks follow the new plan.

## Final review

Once every step is checked, review the whole branch, even when each task was reviewed. Give a fresh
reviewer agent, on the most capable model available, the diff since the branch started, the spec,
the plan, its **Review focus** to check one item at a time, and `rulings.md`. Without a reviewer
agent, review the branch yourself as a separate pass, and say so in the pull request: a review by
the author is weaker.

Grade each finding by what a user gets if the branch ships, not by whether the spec names the input
that triggers it:

- **Critical and important**: fix them in one pass, each with a test that fails first, then run the
  full validation. Commit with the feature's scope:
  `fix(recurring-tasks): keep the undo after a reload`.
- **Minor**: do not fix them. List them in the pull request, for the human to decide.

A finding you decide not to fix is a ruling, written in `rulings.md` with the others.

Then push the branch, open its pull request as a draft, and run the [finish](finish.md) step: it
replaces the folder with its record, and marks the pull request ready.

## Pull request

The pull request is opened as a draft after the final review, and marked ready by the
[finish](finish.md) step, whose last commit also removes the feature's entry from `PRIORITIES.md`.
It is the feature's last human gate: it merges the record, the decisions, and the code at once. Its
description, written when it is marked ready, reads like a file waiting for the human, following
[Coming back to the human](../SKILL.md#coming-back-to-the-human):

- **First line**: what is asked, and an honest time: "Pull request to review, about 20 minutes."
- **What most needs attention**, one line each: the rulings that change behaviour, the plan's text
  edited during the work, a new dependency, a failure that was already there, a final review done
  without a fresh reviewer.
- **Links** to the record, and to `spec.md` and `plan.md` at the commit before finishing.
- **Tests**: each acceptance scenario and review-focus item, with the test that covers it.
- **Rulings**: a link to `rulings.md`, and the ones that change behaviour, one line each.
- **Review comments**: when the plan was approved with comments, how each was carried out.
- **Deferred minors**: the minor findings of the final review.
- **Last line**: "Once merged, run `ura clean` to remove the worktree and the branch."

If you cannot open a pull request, push the branch, and put the description in the body of the last
commit. In a chat session, say the same in one or two sentences, with the pull request's link.

## Changes requested on the pull request

Read every comment. Apply each requested change in a new commit, a change of behaviour with a test
that fails first. The folder is already replaced by its record: when a change goes against what it
says, update its **Behaviour** or **Design** in place in the same commit, and add a line under
**Changes after approval**, so the merged record describes the merged code. When a change needs a
new decision, or the comment leaves a choice open, bring the folder back and start a new round of
questions instead, as [finish](finish.md#changes-asked-on-the-pull-request) describes. Then the pull
request waits for the human again.

A pull request opened before the finish step existed still has its folder: amend the spec in place
in the same commit, increase its `revision`, and update the plan and its `spec-revision`. The spec
stays `approved`: the human asked for the change.

## Commit

One commit per task, with the plan's message, following [Commits](../SKILL.md#commits): its code,
its tests, and its checked boxes in `plan.md`. Fixes from reviews are separate commits with the same
scope.
