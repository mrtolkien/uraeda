# Implementation

Builds the plan one task at a time, one commit per task, then delivers the branch as a pull request
for the human to review.

- **Runs when**: `plan.md` is `approved` or `auto-approved`, with unchecked steps; or every step is
  checked and the branch has no pull request; or its pull request has changes requested
- **Writes**: code and tests, the step checkboxes of `plan.md`, `rulings.md`, and the draft pull
  request
- **Ends at**: the [finish](finish.md) step; a human gate, the pull request, after changes requested
  on it; or a new [discovery](discovery.md) round, when blocked

Build the plan's tasks within the approved behaviour and required contracts, prove the change and
preserved guarantees, and leave the record in git. Private implementation choices can improve as the
code reveals a simpler design: amend the plan and record the reason in `rulings.md`. Nobody waits in
a chat: do not stop to check in between tasks. Git is the only memory: the checked boxes of
`plan.md` and the commits say how far the work went, so any agent can resume it.

## Before the first task

1. Read `plan.md` in full. Its **Global constraints** apply to every task, and its **Review focus**
   lists the behaviours the plan adds to the spec.
2. Read `spec.md` and, when present, `spec-review.md`: a human's approval comment supersedes the
   clause it explicitly changes. Check the plan's **Review comments** against them. This approved
   behaviour wins when the plan disagrees; conflicts with the constitution or active decisions still
   need the human's explicit resolution.
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
made. If your harness can run agents, give each task to a fresh implementer agent, with
[its brief](#the-implementers-brief), but not your session's history. Otherwise, implement it
yourself. You coordinate: when an implementer stops or is interrupted, give the task to a fresh one,
told to resume from the commits and the checked boxes, rather than building it in your own session.

### The implementer's brief

The plan, the spec, and the rulings grow to tens of thousands of words, and an implementer told to
read them in full reloads all of them for every task. Give it what its task needs instead, and let
it open the rest at the sections it needs:

- the task's text, all of it, and the plan's **Global constraints**;
- the **Review focus** items the task owns;
- links to the spec's sections the task implements, by heading;
- the rulings that touch the task's files;
- the discovery's map of the code the task touches: its
  [important reads](discovery.md#the-discovery-file) and likely changes;
- what earlier tasks produced that it consumes: names, interfaces, files;
- the findings left from the last review of the tasks, to fix first, when there are any: see
  [review the tasks](#review-the-tasks).

Write the parts every task shares once, in a file outside the repository, and give each implementer
its path with its task's own parts. The brief is not workflow state: a resumed session writes it
again from the repository.

1. **Read the task**, all of it, even one you remember: its text has the exact values. Check its
   **Consumes** against what the earlier tasks actually produced in the code, and trace the affected
   callers and owners of changed rules and state.
2. **Work its steps in order.** A structural step comes first, and is committed on its own, with its
   box checked. Write the tests first. Tests of new behaviour must fail for the intended reason
   before implementation; checks of preserved behaviour may already pass and must keep passing. Then
   implement, and run every command the plan gives. Once a new test passes, make the break its step
   names, see the test fail, revert it, and report the failure seen in the task's commit body: see
   [tests that can fail](code-quality.md#tests-that-can-fail). Unit tests never sleep for a fixed
   time. A problem found outside the task is not fixed in passing: note it in the inbox, as
   [agents' notes](inbox.md#agents-notes) says. Compare each output with the step's **Expected**
   line:
   - **It matches**: go to the next step.
   - **The code is wrong**: find the root cause before changing anything: reproduce the failure,
     trace the wrong value back to where it first goes wrong, and test one hypothesis at a time, as
     a [change](change.md#investigating) does for a bug. Never change a test or an expected value to
     make a run pass. Changing or deleting an existing test for any other reason takes a ruling.
   - **The plan is wrong**: a name that does not match its producer, a command that cannot run, a
     failure that cannot happen. Make the smallest change that satisfies the spec, edit the plan's
     text to describe what was built, so later tasks read the right names, and write a ruling in
     `rulings.md`.
   - **A private design can be simpler**: improve it within the approved behaviour, required
     contracts, and active decisions. Update the plan, its affected task interfaces, and a ruling in
     the same commit, so later tasks follow what was built. Remove paths made obsolete by the
     change; keep unrelated refactoring out. Do not weaken tests or change user-visible behaviour to
     accommodate the new design.
3. **Run the validation the step needs**, the smallest first:
   - **While working**: the tests the task adds or touches, by file or project, and the fast checks
     (formatter, linter, type checker).
   - **Before each commit**: the project's validation once. When it is one cached command, such as
     `vp run ready`, run it whole: its cache skips what the task did not change. Otherwise, run its
     slow suites, such as browser tests and screenshots, only when the task changes what they cover:
     a UI behaviour, a layout, a route.
   - **At the final review**: every check the project runs locally, slow suites included.

   A failure unrelated to the task that passes when run again is not hunted in rerun loops: rerun it
   at most twice. A test that fails intermittently follows the project's rule for flaky tests, when
   an active decision has one; otherwise note it in the inbox, as
   [agents' notes](inbox.md#agents-notes) says, and go on.

4. **Check the task's boxes** in `plan.md`, and commit them with the code and tests, using the
   plan's commit message. Check a box only for a step that ran, with the output the plan expects:
   the next agent trusts it without running it again.
5. **Review**, after every second or third task, or after a risky one: see
   [review the tasks](#review-the-tasks).

In the messages that report your work, link each story you wrote or changed, alone in its paragraph,
with a blank line before and after, as a [story link](conventions.md#markdown): Uraeda shows it live
in the session, where the human can try it and comment on it.

### Review the tasks

When your harness can run a fresh reviewer agent, review the tasks as they are built, so their
problems are fixed while their context is fresh, not all at the final review. Review every two or
three tasks, on the diff of their commits, and a risky task on its own: one that changes security,
the format of stored data or its migration, concurrency, or a rule several callers share. Give the
reviewer the tasks' text, the spec's sections they implement and its approval comments, the global
constraints, and the diff. It derives expected behaviour from the approved requirements before
checking the implementation and tests, then reviews the changed responsibilities and their callers.
It gives two verdicts, spec compliance first, then quality, with the criteria of
[Review the branch](#review-the-branch) scaled to the tasks, and flags what the tasks grew, not
sizes that were already there ([extract, don't grow](code-quality.md#extract-dont-grow)).

Its findings are [graded](#grade-the-findings) like the final review's: only the critical and
important ones are fixed. Give them to the next task's implementer, to fix first, each behaviour fix
with a test that fails first, in its own commit; after the last task, to a fresh implementer.
Structural fixes must keep behavioural tests passing and satisfy explicit architectural constraints.
A finding still open after two reviews of the tasks is ruled on, in `rulings.md`.

### Rulings

Settle implementation details yourself: the spec with the human's approval comments is the
authority, the plan argues from it, and your judgement settles what neither answers. Every deviation
from the plan, and every choice a later reader would want explained, is a ruling: write it in the
feature's `rulings.md`, from
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
- A failed check of outside behaviour the spec marked unverified: the stories that rely on it need
  the human's choice
- An irreversible or destructive operation, a security-sensitive action, or a side effect outside
  the branch: deleting real data, pushing to another branch, publishing

Never work around it. The tasks already committed stay checked. Once the human answers, the spec is
amended and approved, and the plan revised: the unchecked tasks follow the new plan.

## Final review

### Catch up with the default branch

Once every step is checked, and before the review, bring in what the default branch gained since the
branch started: features merged meanwhile, their code, and their decisions. The review and the pull
request then judge the code as it will be merged. When the branch already contains the default
branch, there is nothing to do.

1. **Fetch**, with `git fetch`, and note where the branch started:
   `git merge-base HEAD origin/<default>`. Without a remote, use the local default branch.
2. **Read the new rules**:
   `git diff <merge-base> origin/<default> -- specs/decisions/ specs/CONSTITUTION.md`. For each
   decision added or changed, and each amendment:
   - **It conflicts** with the spec, the plan, or the code built: stop, and start a new round of
     questions, as [when you must stop](#when-you-must-stop) says. Principle I leaves that conflict
     to the human.
   - **It applies** to the code the branch touches, as its **Applies to** says, without conflict:
     follow it. Write a ruling saying how the branch meets it, with the fix commits it needs.
   - **It does not apply**: nothing to do.
3. **Rebase the branch** on the default branch, so its history stays linear. When the branch is on
   the remote, someone may have pushed to it: first `git pull --rebase origin <branch>`, so no
   commit is lost. Then `git rebase origin/<default>`. The next push replaces the remote branch:
   `git push --force-with-lease`, never `--force`, so a push made meanwhile is refused, not
   overwritten. Resolve conflicts:
   - **In code**: keep what both sides need, within the spec and the default branch's decisions. A
     resolution that needs a choice the spec does not settle is a reason to stop.
   - **In `PRIORITIES.md`**: take the default branch's version, with this feature's entry kept in
     it.
   - **In a decision or the constitution**: stop, and start a new round of questions.
4. **Run the project's validation.** A failure the default branch brings in is fixed like a final
   review finding, with a test that fails first, in a commit with the feature's scope.

### Review the branch

Once the branch is caught up, review the whole branch, even when each task was reviewed. Give a
fresh reviewer agent, on the most capable model available, the diff since the branch started, the
spec and its approval comments, the plan, its **Review focus** to check one item at a time, and
`rulings.md`. Without a reviewer agent, review the branch yourself as a separate pass, and say so in
the pull request: a review by the author is weaker.

Review the changed subsystem and affected callers, including relevant code outside the diff:

- **Behaviour**: establish expectations from the approved requirements before reading the proposed
  solution. Check what changed and what must remain true, including validation, error handling, and
  compatibility. Trace shared guarantees across every relevant entry point.
- **Ownership**: check that state transitions and business rules have a clear owner, and callers
  reach the same enforcement. Where work is asynchronous or shared between processes, verify that
  local views cannot override authoritative state. Check resource release on failure and
  cancellation, in tests as well as production code.
- **Evidence**: ask which plausible incorrect implementation each important test would reject. For
  risky guarantees, verify this in isolated tests with a focused fault injection or temporary
  removal of the protection, then restore it. Exercise relevant sequences, failures, retries, and
  changes made elsewhere; use property-based tests when they provide useful coverage. Check explicit
  architectural constraints separately from functional outcomes, through existing checks where
  practical. Report what was actually exercised and any unverified assumptions.
- **Change cost**: identify duplicated decisions, unnecessary indirection, and obsolete paths. Trace
  where a likely follow-up change would belong without implementing that feature. Would it need the
  same rule edited in several places, or unrelated internals understood together? Judge the
  boundaries by that cost, rather than a preferred style, and against the project's limits.
- **Size**: list each function and file the branch grew, with its length before and after, for the
  pull request's description ([extract, don't grow](code-quality.md#extract-dont-grow)).

### Grade the findings

Grade each finding by what a user gets if the branch ships, not by whether the spec names the input
that triggers it:

- **Critical and important**: fix them in one pass, behaviour fixes with tests that fail first,
  structural fixes with behavioural regression checks and any explicit architectural checks. Do not
  manufacture a failing test that only pins a private implementation shape. Run the full validation.
  Commit with the feature's scope: `fix(recurring-tasks): keep the undo after a reload`.
- **Minor**: do not fix them, and do not let an implementer fix them in passing. Add each to the
  inbox under **Deferred fixes**, as an [agent's note](inbox.md#agents-notes) about the feature, for
  the human to decide, and list them in the pull request.

A maintenance defect can be important before it causes a user-visible failure. Name the likely
change or failure it makes harder, and the duplicated edits, coupling, or missing ownership behind
that cost. A preference for different names or formatting alone is minor; a unit the branch grew
past a limit, or a copy of a rule ([one home per rule](code-quality.md#one-home-per-rule)), is not.

A finding you decide not to fix is a ruling, written in `rulings.md` with the others.

A second reviewer, such as another tool's review skill, can review the branch too, after the first.
Its findings are graded and fixed the same way, and the pull request names it. It reviews the branch
once; after its fixes, a second pass reviews only the fix commits. Its critical and important
findings are fixed once more, without another review, and the rest is listed in the pull request.

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
- **Size**: each function and file the branch grew, with its length before and after.
- **Rulings**: a link to `rulings.md`, and the ones that change behaviour, one line each.
- **Review comments**: when the plan was approved with comments, how each was carried out.
- **Deferred fixes**: the minor findings of the reviews, as noted in the inbox.
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

One commit per task, with the plan's message, following [Commits](conventions.md#commits): its code,
its tests, and its checked boxes in `plan.md`. A structural step is a commit of its own, before.
Fixes from reviews are separate commits with the same scope.
