# Implementation

Builds the plan wave by wave, one commit per task, reviews it, uses what was built, and delivers the
branch as a pull request.

- **Runs when**: `plan.md` is `approved` or `auto-approved`, with unchecked steps; or every step is
  checked and the branch has no pull request; or its open pull request has changes requested, is
  behind the default branch, or lacks the branch's latest commits; or the human's message asks to
  address its comments
- **Writes**: code and tests, the step checkboxes of `plan.md`, `rulings.md`, the reviews'
  `findings-NN.md`, and the draft pull request
- **Ends at**: the [finish](finish.md) step; a human gate, the pull request; or a new round of
  questions, when blocked

Build the plan's tasks within the approved behaviour, prove them, and use them. Nobody waits in the
session: do not stop between tasks, waves, or reviews. Git is the only memory: the checked boxes of
`plan.md` and the commits say how far the work went, so any agent can resume it.

## Before the first task

1. Read `plan.md` in full: its **Global constraints** apply to every task.
2. Read `spec.md` and, when present, `spec-review.md`: an approval comment wins over the clause it
   changes, and the approved behaviour wins when the plan disagrees with it.
3. Read the constitution, and the decisions and guides that apply to the code you will touch, as
   they are now. If one now conflicts with the spec or the plan, [stop](#when-you-must-stop).
4. If the human reviewed the plan, turn its block into a note, in the first task's commit. Comments
   of `plan-review.md` are carried out, and the pull request says how.
5. Run the project's complete validation once, before any change, without the suites the plan leaves
   out of validation. A failure that is already there is reported in the pull request, not fixed in
   passing.

**Resuming**: start at the first unchecked step; with `ura`, `ura next` names its task. A task whose
boxes are checked on the feature branch is done. A task branch whose commits check all its task's
boxes is merged as if just finished. Any other task branch, and uncommitted changes, are not
trusted: read them, delete them, and redo that task. A wave merged without its review is reviewed
now.

## Implementers and reviewers

Build the tasks of a wave at the same time when you can hand them out, and have reviews done by a
fresh agent: a review by the author is weaker.

- **With a harness's own tools for the workflow**, `run_agent` and `review`: `run_agent` runs one
  task as an implementer, in the task's worktree, given the task's name as the plan has it, the
  worktree's path, and [the brief](#the-implementers-brief). Call it for every task of a wave in the
  same turn. Asked again for the same task, it answers the first call, or resumes a stopped task:
  each round of fixes takes a new task name, like `Fixes of wave 2`. `review` runs every reviewer
  the human set, on the commits `base..head`, and commits their findings as the folder's next
  `findings-NN.md`. When the human set reviews on the branch only, a wave's call answers that no
  review runs.
- **Otherwise**, use your harness's sub-agents, and write each review's findings yourself in the
  folder's next `findings-NN.md`, from
  [the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/findings-01.md), a section per
  reviewer. Commit it alone, `review(<slug>): findings 02`, before fixing any of them: a run that
  stops then loses none.
- **Without sub-agents**, build the tasks yourself, in the plan's order, and review the branch as a
  separate pass, saying so in the pull request.

## For each wave

1. **Build its tasks at the same time**, each by a fresh implementer with
   [its brief](#the-implementers-brief), in its own worktree, on a task branch made from the feature
   branch as it is now, `<feature-branch>-task-N`. Task branches stay local.
2. **Merge them, in the plan's order**: rebase each task branch on the feature branch, fast-forward
   the feature branch to it, then remove its worktree and branch. The history stays linear, one
   commit per task. A conflict outside the shared files the plan's **Waves** names means the tasks
   were not independent. A conflict in `plan.md`'s checkboxes is not one: keep both sides' checked
   boxes. For a real one: give the later task to a fresh implementer, to rebuild on the merged code.
3. **Check the merged wave**, in the background: that the project builds, and the tests of the code
   the wave touched. This is not the complete validation.
4. **Start the wave's review** in the background, and **start the next wave** without waiting for
   the check or the review.

A failed check or a finding does not stop the next wave: it is fixed beside it, on a branch made
from the feature branch, and merged like a task between two waves. Only what the next wave cannot be
built on is fixed first: merged code that does not build, or a wrong name it consumes. What is still
open when the last wave is merged is fixed in one pass, before the final review.

When an implementer stops or is interrupted, give its task to a fresh one, in the same worktree,
told to resume from its commits and checked boxes.

### The implementer's brief

An implementer told to read the whole plan, spec, and rulings reloads them for every task. Give it
what its task needs:

- the task's text, all of it, and the plan's **Global constraints**;
- the **Review focus** items the task owns;
- links to the spec's sections and mockups the task implements;
- the guides that apply to what it builds, and the rulings that touch its files;
- the discovery's map of the code it touches;
- what earlier tasks produced that it consumes;
- its worktree and task branch: it commits there, and never touches the feature branch.

Write the parts every task shares once, in a file outside the repository.

### Each task

1. **Read the task**, all of it: its text has the exact values. Check its **Consumes** against what
   the earlier tasks actually produced.
2. **Work its steps in order.** A structural step comes first, committed on its own. Write the
   task's tests first, as [writing one](code-quality.md#writing-one) says: a test of new behaviour
   fails for the intended reason before the code exists, and a check of behaviour that must stay may
   already pass. Then implement, and run what the plan gives. When an output differs from what the
   plan expects:
   - **The code is wrong**: find the root cause before changing anything, as a
     [change](change.md#investigating) does for a bug. For a failing existing test, see
     [when a test goes](code-quality.md#when-a-test-goes).
   - **The plan is wrong**: a name that does not match its producer, a command that cannot run. Make
     the smallest change that satisfies the spec. Edit the plan only where a later task reads it: an
     **Interfaces** block, a file's path, a constraint. The plan is not kept as a mirror of the
     code.
   - **A simpler private design exists**: take it, within the approved behaviour and the contracts
     other tasks rely on. Never weaken a test or change what users get to fit it.
3. **Use what the task built**, when a user acts on it and the product can run at this point: start
   it as the project says, do the act, and see its effect. The whole journeys, at every width, wait
   for the [final review](#use-it). A key that the tests press and no hand has pressed is not done.
4. **Run the validation the step needs**, the smallest first:
   - **While working**: the tests the task adds or touches, and the fast checks: formatter, linter,
     type checker.
   - **Before each commit**: the project's fast check when a decision defines one. Otherwise its
     validation, with the slow suites only when the task changes what they cover.
   - **At the final review, and before each push**: the project's complete validation, slow suites
     included. A green fast check never stands for it.
   - **Never**: a suite the plan leaves out of validation.

   A failure unrelated to the task that passes when run again is not hunted: rerun it once the
   machine is quiet, and go on. Never load the machine, or run a test in a loop, to reproduce a
   failure of timing. A flaky test that guards nothing important is removed, with a ruling, never
   asked about. One that guards something follows the project's rule for flaky tests, or is named in
   the pull request.

   Start long work, a test suite, a build, a sub-agent, as background work your harness tracks, then
   wait for its notice. Never poll it in a loop: a run blocked in a loop cannot read the human's
   messages.

5. **Check the task's boxes** in `plan.md`, and commit them with the code and tests, with the plan's
   message. Check a box only for a step that ran: the next agent trusts it.

A problem found outside the task is fixed on the branch when the feature needs it, and dropped
otherwise, unless it passes the two tests of [agents' notes](inbox.md#agents-notes).

### Review the waves

Each merged wave is reviewed once, by `review` or a fresh reviewer, while the next wave is built.
The reviewer gets the tasks' text, the spec's sections they implement with its approval comments,
the global constraints, and the diff. A risky task gets a reviewer of its own. It works out the
expected behaviour from the approved requirements before reading the code, and gives two verdicts:
does it do what the spec says, and is it well built. It grades each finding, and says "none" when
there is none.

Its findings are [graded](#grade-the-findings) and fixed beside the next wave, each behaviour fix
with a test that fails first. A wave's fixes are not reviewed again as a wave: the review of the
branch covers them.

### Rulings

Settle implementation details yourself: the spec with the human's approval comments is the
authority, the plan argues from it, and your judgement settles the rest. Most of what you settle
needs no record: a name, a type, a module's boundary, or a helper is read in the code, and its
reason in the commit's body.

A ruling, in the feature's `rulings.md`, from
[the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/rulings.md), is for a reason that
would otherwise be lost, in the same commit as the code it concerns:

- a departure from the spec, the plan, or a mockup, or from a decision when the human allowed it;
- a behaviour users will notice that the spec does not state, in one line, said as what happens to
  them: the pull request's "Decided without you" is made from these;
- a test removed or rewritten outside the spec's list;
- a tempting alternative ruled out, with the evidence;
- what the human asked in a session that changes the work, in their words, when no other file holds
  it.

Four things a ruling is not:

- **Not a decision.** It binds nothing outside this feature. When another file would have to cite
  it, what it says belongs in a decision, a guide, or a comment in the code.
- **Not a spec change.** When the human redirects the build in a way that changes what users get,
  amend the spec, and say so in the pull request.
- **Not a question.** Never write "left to the human" in a ruling: nobody reads it there. It is a
  question in a round, or a line at the top of the pull request.
- **Not a diary.** A bug found and fixed, a measurement, or a step done is in the commits.

**Behaviour the spec did not state is shown to the human.** While building, you settle things users
will see that no spec line covers: a default, a text, what a key does at the edge. Settle them from
the proposal's intent, the product it names, and the guides, and list each in the pull request's
"Decided without you", one line each. A new limit, a refusal, a removal, or a change of security
posture among them is not yours: [stop](#when-you-must-stop).

**A request to go faster removes paperwork, never adds it.** "No gates tonight" or "the implementers
have freedom" means fewer stops and fewer records, with the same care for what users get. What the
human waived is still written down once, so another session can resume.

### When you must stop

Stop, and start a new round of questions, when a task needs:

- something the spec, the decisions, or the constitution do not allow, or a new decision;
- a limit, a refusal, or a removal users would notice, that the spec does not state;
- a plan so broken that every way forward is a guess;
- a failed check of outside behaviour the spec marked unverified, or a measured target missed by the
  first task;
- an irreversible or destructive operation, a security-sensitive action, or a side effect outside
  the branch: deleting real data, pushing to another branch, publishing.

Never work around it. Let the wave's other implementers finish, and merge their tasks. Once the
human answers, the spec is amended and approved, and the plan revised.

The human may answer such a round to continue, which adds `resumes: implementation` to it. Then the
spec and the plan stay as approved: carry the answers out in the unchecked tasks, each as a ruling.
An answer that turns out to change the spec's behaviour, a decision, or a task already built is not
small: stop, and start a new round.

## Final review

Once every step is checked: catch up, use the feature, review the branch, and fix what both found.

### Catch up with the default branch

Bring in what the default branch gained since the branch started, so the review judges the code as
it will merge.

1. **Fetch**, and note where the branch started: `git merge-base HEAD origin/<default>`. Without a
   remote, use the local default branch.
2. **Read the new rules**:
   `git diff <merge-base> origin/<default> -- specs/decisions/ specs/CONSTITUTION.md`, and the
   project's guides the same way. One that applies to what the branch touches is followed, with the
   fix commits it needs. One that conflicts with the spec or the code built is a reason to
   [stop](#when-you-must-stop).
3. **Rebase the branch** on the default branch. When it is on the remote, first
   `git pull --rebase origin <branch>`, and push later with `--force-with-lease`, never `--force`.
   Resolve conflicts within the spec and the default branch's decisions:
   - in code: keep what both sides need;
   - in a generated file: take either side, then regenerate it;
   - in a record of `specs/done/`, or in `PRIORITIES.md` and `INBOX.md`: take the default branch's;
   - in a decision: when both sides' rules stand together, keep both; when they disagree in meaning,
     stop.
4. **Repair the moved links**: the default branch may have moved or deleted a file the branch links.
   With `ura`, `ura check --fix`; by hand, see
   [where a moved link points](by-hand.md#where-a-moved-link-points). Commit the repairs alone,
   `fix(<slug>): repair the links to moved files`.
5. **Run the project's complete validation.** A failure the default branch brings in is fixed like a
   finding. A complete validation holds for the commit it ran on: do not run it again on the same
   tree.

### Use it

Before reading the diff, use the feature as its user will. This is your own pass, not a review by
the human: you drive the product yourself, as each of the project's personas when it has them, and
as a first-time user otherwise. It replaces the review the human would otherwise do after the merge,
one small request at a time.

- **Start the product** as the project's instructions say, on its own data, never the human's.
- **Do each user story**, from where its user starts to where they end. Do every act the feature
  adds, each key, press, drag, and swipe, and look at what it changes, not at its label.
- **At each width and input the project serves**: the narrowest screen, the keyboard alone, touch.
- **With content as it really is**: none, a lot, and too long for its place. Once from a fresh
  start.
- **Beside its neighbours**: walk through a page next to the new one. The same thing is drawn,
  named, and keyed the same way on both.
- **Against the project's guides and personas**, when it has them, and against the mockups the human
  approved.
- **Measure each success criterion** the spec states, on real data, and keep the number.

Write what you did and what you saw in the review's `findings-NN.md`, as findings like the others.
Anything the human would have to come back and ask for is a finding. "The product" is whatever its
user touches: an app, a command, an API, a document. Say in the findings what you ran, on which
runtime, at which widths and with which input, what you did, and what you saw: a defect often lives
in one browser or one backend. When a path cannot be exercised, fix what blocks it. When you cannot,
the feature is not ready: stop, and say what could not be used and what it risks, unless the human
already accepted that for this feature. Never report as reviewed a feature nobody used.

### Review the branch

Then review the whole branch, even when each wave was reviewed: with `review` on the commits since
the branch started, or a fresh reviewer on the most capable model available, given the diff, the
spec and its approval comments, the plan with its **Review focus**, and `rulings.md`. A second
reviewer from another model family finds different things on a large branch: run one when the
project has it.

The review covers the changed code and its callers, outside the diff too:

- **Behaviour**: expectations come from the approved requirements, before reading the solution. What
  changed, and what must remain true: validation, error handling, compatibility.
- **Ownership**: each state transition and rule has one owner, and callers reach the same
  enforcement. Local views cannot override authoritative state. Resources are released on failure
  and cancellation.
- **Evidence**: which plausible wrong implementation would each important test reject? A test that
  asserts nothing, or nothing the spec asks, is an important finding. For a risky guarantee, remove
  the protection for a moment and see its test fail. Say what was exercised, and what stays
  unverified. The tests removed by the spec's list or by ruling are listed.
- **Change cost**: duplicated decisions, needless indirection, obsolete paths. Where would a likely
  follow-up change go?
- **Size**: each function and file the branch grew past a limit
  ([extract, don't grow](code-quality.md#extract-dont-grow)).

### Grade the findings

Read every reviewer's findings, and your own from using the feature. Grade each by what a user gets
if the branch ships, whatever grade its reviewer gave:

- **Critical and important**: fix them in one pass, behaviour fixes with tests that fail first.
  Commit with the feature's scope: `fix(recurring-tasks): keep the undo after a reload`. One you
  decide not to fix is never dropped: it is a ruling, and a line of the pull request's "Look at".
- **Minor**: fix the ones worth fixing in the same pass, and drop the rest. A finding is fixed on
  the branch or dropped: it is never an [agent's note](inbox.md#agents-notes), and never a list of
  leftovers in the pull request.

A maintenance defect can be important before any user sees it: a unit grown past a limit, or a copy
of a rule. A preference for other names is minor.

**The review ends.** A finding is a claim until you confirm it: reproduce it, or read the code it
names, before spending work on it, and decline a wrong one with its reason. After the fixes, one
further review covers the fix commits only. Its confirmed critical and important findings are fixed
and checked with focused tests, and the review is over. Never ask a reviewer for a number of
findings: ask for evidence, and allow none.

Then run the complete validation, push the branch, open its pull request as a draft, and run the
[finish](finish.md) step.

## Pull request

The pull request is opened as a draft after the final review, and marked ready by the
[finish](finish.md) step, which writes its body. It is the feature's last human gate: it merges the
record, the decisions, and the code at once. If you cannot open one, push the branch, and put the
body in the last commit's message.

**Nothing is written on the forge but the pull request and its body**: no reply to a comment, no
thread resolved. The one exception is the comment of a [catch-up](#catch-up-an-open-pull-request)
that stopped.

## Push

Runs when the pull request is open, not a draft, with no changes requested, and the branch holds
commits it lacks. The human reviews the pull request's head: until it holds the branch's latest
commit, nothing waits for them.

1. **Run the project's complete validation**, after the branch's last commit. A failure is fixed in
   a commit of its own.
2. **Push** with `git push`, never `--force`; after a rebase, `--force-with-lease`. A refused push
   means the remote has commits the local branch lacks: `git pull --rebase origin <branch>`,
   validate, and push again.
3. **Leave the pull request as it is**: it waits for the human again.

## Catch up an open pull request

Runs when the pull request is open, not a draft, with no changes requested, and its branch is behind
the default branch, by more than the default branch's own files: `PRIORITIES.md`, the inbox, the
proposals, and the notes. It wins over the push, since it pushes too. With `ura`, `ura next` names
it; by hand, see
[whether a pull request is behind](by-hand.md#whether-a-pull-request-is-behind-or-lacks-commits).

1. **Sync with the remote branch**, `git pull --rebase origin <branch>`, and note the tip.
2. **Catch up** as [the final review](#catch-up-with-the-default-branch) does.
3. **Push**, with `--force-with-lease`, and leave the pull request as it is.

The folder is most likely a record by now. What the catch-up changes in behaviour updates the
record's **Behaviour** or **Design** in place, with a line under **Changes after approval**, and the
pull request's body is written again from it.

**When the catch-up needs a choice** the spec and the decisions do not settle, a conflicting
decision, a conflict in code, or a validation that fails for the two branches together: leave the
branch as it was (`git rebase --abort`, then `git reset --keep <tip>`), push nothing, and comment on
the pull request with what conflicts, the choice it needs, and your recommendation. The human
answers by requesting changes.

## Comments on the pull request

Runs when the pull request has changes requested, or when the human's message asks to address its
comments. Read every unresolved review thread that is not outdated, and every review or comment
posted after the branch's last push: see
[read a pull request's comments](by-hand.md#read-a-pull-requests-comments). A reviewer bot's comment
counts like a person's: the human chose when to send you.

A branch behind the default branch is caught up first. When that catch-up needs a choice, it stops
as a catch-up does: the branch is left as it was, the question goes to the pull request, and the
other comments wait for the next pass. The catch-up's own comment is context, never a comment to
handle, and the human's comment settling its choice is followed as its resolution. Then, for each
comment:

- **A change**: apply it in a commit of its own, a change of behaviour with a test that fails first.
  Once the folder is a record, update its **Behaviour** or **Design** in place in the same commit,
  with a line under **Changes after approval**.
- **A choice the spec does not settle**, or a new decision: bring the folder back and start a new
  round, as [finish](finish.md#changes-asked-on-the-pull-request) describes.
- **Nothing to do**: a comment already handled, or one the code answers. Your last message says why.

The pass ends when the pull request is ready again: the complete validation run after the last
commit, the branch pushed, and the pull request marked ready. A round of questions, or any file
waiting for the human, ends it earlier, at that gate: the pull request stays a draft, and nothing is
finished before they answer. A pull request still in draft with nothing waiting ends the pass with
the [finish](finish.md) step, which writes the record when it is not there. Your last message lists
each comment with what you did, one line each.

## Commit

One commit per task, with the plan's message, following [Commits](conventions.md#commits): its code,
its tests, and its checked boxes. A structural step is a commit of its own, before. Fixes from
reviews are separate commits with the same scope.
