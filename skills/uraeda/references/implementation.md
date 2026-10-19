# Implementation

Builds the plan wave by wave, the tasks of a wave at the same time, one commit per task, then
delivers the branch as a pull request for the human to review.

- **Runs when**: `plan.md` is `approved` or `auto-approved`, with unchecked steps; or every step is
  checked and the branch has no pull request; or its pull request has changes requested, or the
  human's message asks to address its comments
- **Writes**: code and tests, the step checkboxes of `plan.md`, `rulings.md`, and the draft pull
  request
- **Ends at**: the [finish](finish.md) step; a human gate, the pull request, after its comments are
  addressed; or a new [discovery](discovery.md) round, when blocked

Build the plan's tasks within the approved behaviour and required contracts, prove the change and
preserved guarantees, and leave the record in git. Private implementation choices can improve as the
code reveals a simpler design: amend the plan and record the reason in `rulings.md`. Nobody waits in
a chat: do not stop to check in between tasks. Git is the only memory: the checked boxes of
`plan.md` and the commits say how far the work went, so any agent can resume it.

## Before the first task

1. Read `plan.md` in full. Its **Global constraints** apply to every task, its **Review focus**
   lists the behaviours the plan adds to the spec, and its **Waves** say which tasks are built at
   the same time.
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

**Resuming**: start at the first wave with an unchecked step; with `ura`, `ura next` names its first
unchecked task. The feature branch is the only progress: a task whose boxes are checked on it is
done, even if you do not remember doing it. A task branch left by an interrupted session, whose
commits check all its task's boxes, is merged as if its implementer had just finished; any other
task branch, and changes left uncommitted, are not trusted: read them, delete them, and redo that
task from its first step. A wave merged without its review, because the session ended, is reviewed
now.

## For each wave

The plan's **Waves** group the tasks that can be built without seeing each other's code. Each wave
is built on what the earlier waves made, so it starts once the previous wave is merged, not once it
is reviewed: the review of a wave runs while the next one is built.

1. **Build its tasks at the same time.** If your harness can run agents, give each task of the wave
   to a fresh implementer agent, with [its brief](#the-implementers-brief) but not your session's
   history, all at once. Each works in its own worktree, on a task branch made from the feature
   branch as it is now, `<feature-branch>-task-N`, and follows [each task](#each-task). Task
   branches stay local: they are never pushed. Otherwise, build the wave's tasks yourself, one after
   the other, in the plan's order, on the feature branch.
2. **Merge them, in the plan's order**, a task that finishes early waiting for those before it:
   rebase its task branch on the feature branch, fast-forward the feature branch to it, then remove
   its worktree and branch. The history stays linear, one commit per task, as if the tasks had been
   built one after the other. A conflict outside the shared files the plan's **Waves** names means
   the tasks were not independent: give the later task to a fresh implementer, to rebuild on the
   merged code, and write a ruling. In `plan.md`, keep both sides' checked boxes.
3. **Run the project's validation** on the merged wave. A failure its tasks passed alone is a
   problem of their combination: give it to a fresh implementer, as [the code is wrong](#each-task)
   says, before the next wave starts.
4. **Start the review of the wave** in the background, as [review the waves](#review-the-waves)
   says, and **start the next wave** without waiting for it.

You coordinate: you merge, validate, and hand out the work. When an implementer stops or is
interrupted, give its task to a fresh one, in the same worktree, told to resume from its commits and
checked boxes, rather than building it in your own session.

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
- the worktree and task branch it works in, when the wave has several tasks: it commits there, and
  never merges, rebases, or touches the feature branch.

Write the parts every task shares once, in a file outside the repository, and give each implementer
its path with its task's own parts. The brief is not workflow state: a resumed session writes it
again from the repository.

### Each task

1. **Read the task**, all of it, even one you remember: its text has the exact values. Check its
   **Consumes** against what the earlier tasks actually produced in the code, and trace the affected
   callers and owners of changed rules and state.
2. **Work its steps in order.** A structural step comes first, and is committed on its own, with its
   box checked. Write the tests first. Tests of new behaviour must fail for the intended reason
   before implementation; checks of preserved behaviour may already pass and must keep passing. Then
   implement, and run every command the plan gives. When the step names a break, make it once the
   new test passes, see the test fail, revert it, and report the failure seen in the task's commit
   body: see [tests that can fail](code-quality.md#tests-that-can-fail). Tests never sleep for a
   fixed time. A problem found outside the task is not fixed in passing: note it in the inbox, as
   [agents' notes](inbox.md#agents-notes) says. Compare each output with the step's **Expected**
   line:
   - **It matches**: go to the next step.
   - **The code is wrong**: find the root cause before changing anything: reproduce the failure,
     trace the wrong value back to where it first goes wrong, and test one hypothesis at a time, as
     a [change](change.md#investigating) does for a bug. Never change a test or an expected value to
     make a run pass, and never skip or loosen one. When the code cannot be fixed within the spec,
     and no request from the human changes the test, stop and report. Changing or deleting an
     existing test for any other reason takes a ruling: see
     [tests that can fail](code-quality.md#tests-that-can-fail).
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
   - **While working**: the tests the task adds or touches, by file or project.
   - **Before each commit**: the project's fast check, the command its setup names for after each
     task, `vp run fast` in this repository. It runs the formatter, the linter, the type checker,
     and the tests the task's changes reach. Run the slow suites, such as browser tests and
     screenshots, only when the task changes what they cover: a UI behaviour, a layout, a route.
   - **Before every push**, and at the final review: the project's full command, `vp run ready` in
     this repository, slow suites included. A red run is fixed before the push.

   A failure unrelated to the task that passes when run again is not hunted in rerun loops: rerun it
   at most twice. A test that fails intermittently follows the project's rule for flaky tests, when
   an active decision has one; otherwise note it in the inbox, as
   [agents' notes](inbox.md#agents-notes) says, and go on.

4. **Check the task's boxes** in `plan.md`, and commit them with the code and tests, using the
   plan's commit message. Check a box only for a step that ran, with the output the plan expects:
   the next agent trusts it without running it again.

In the messages that report your work, link each story you wrote or changed, alone in its paragraph,
with a blank line before and after, as a [story link](conventions.md#markdown): Uraeda shows it live
in the session, where the human can try it and comment on it.

### Review the waves

When your harness can run a fresh reviewer agent, review each wave once it is merged, so its
problems are fixed while their context is fresh, not all at the final review. The review covers
every task the wave merged, on the diff of their commits, with the fix commits merged since the last
review; a risky task, one that changes security, the format of stored data or its migration,
concurrency, or a rule several callers share, gets a reviewer of its own, at the same time. The
review runs in the background while the next wave is built. Give the reviewer the tasks' text, the
spec's sections they implement and its approval comments, the global constraints, and the diff. It
derives expected behaviour from the approved requirements before checking the implementation and
tests, then reviews the changed responsibilities and their callers. It gives two verdicts, spec
compliance first, then quality, with the criteria of [Review the branch](#review-the-branch) scaled
to the tasks, and flags what the tasks grew, not sizes that were already there
([extract, don't grow](code-quality.md#extract-dont-grow)).

Its findings are [graded](#grade-the-findings) like the final review's: only the critical and
important ones are fixed. Once the review ends, fix them at the next point between two waves, after
a wave is merged and before the next one starts: give them to a fresh implementer on the feature
branch, each behaviour fix with a test that fails first, in its own commit. After the last wave, fix
them as soon as the review ends. The next review checks those fix commits with its wave. Structural
fixes must keep behavioural tests passing and satisfy explicit architectural constraints. A finding
still open after two reviews is ruled on, in `rulings.md`.

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

Never work around it. Let the other implementers of the wave finish, and merge their tasks: the
tasks already committed stay checked. Once the human answers, the spec is amended and approved, and
the plan revised: the unchecked tasks follow the new plan.

**An answer that continues the implementation.** The human may answer a round asked here to
continue, which adds `resumes: implementation` to its front matter. Then the spec and the plan stay
as approved: carry out the answers in the unchecked tasks, and write each choice they made as a
[ruling](#rulings). An answer that turns out to change the spec's behaviour, a decision, or a task
already built is not small: stop, and start a new round.

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
4. **Run the project's full validation.** A failure the default branch brings in is fixed like a
   final review finding, with a test that fails first, in a commit with the feature's scope.

### Review the branch

Once the branch is caught up, review the whole branch, even when each wave was reviewed. Give a
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
- **Test changes**: list, apart from the product's diff, every test the branch removed, skipped, or
  changed in what it expects, each with the ruling that explains it and, for a changed value, the
  old and new values: a timeout raised from 20,000 to 40,000 ms is listed with both. A test with no
  ruling, and none that the human asked for, is a critical finding. A branch that only adds tests
  lists "no test was removed, skipped, or loosened". The list goes in the pull request's
  description.

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
- **Tests**: each acceptance scenario and review-focus item, with the test that covers it, from the
  plan's test map.
- **Test changes**: the final review's list of tests removed, skipped, or changed in what they
  expect, or the line saying none was.
- **Size**: each function and file the branch grew, with its length before and after.
- **Rulings**: a link to `rulings.md`, and the ones that change behaviour, one line each.
- **Review comments**: when the plan was approved with comments, how each was carried out.
- **Deferred fixes**: the minor findings of the reviews, as noted in the inbox.
- **Last line**: "Once merged, run `ura clean` to remove the worktree and the branch."

If you cannot open a pull request, push the branch, and put the description in the body of the last
commit. In a chat session, say the same in one or two sentences, with the pull request's link.

## Comments on the pull request

The comments pass runs when the human's message asks to address the pull request's comments,
whatever the step table says, and when the pull request has changes requested. Uraeda records such a
run with the trigger `comments`. The human chose when to send the agent: the pass handles the
comments there at that moment.

**What to read**: every unresolved review thread, and every review or comment posted after the
branch's last push. Resolved threads are settled, and outdated ones are about code that changed
since: both are left out.

- **Review threads** come from `gh api graphql`, on the pull request's `reviewThreads`: each
  thread's `isResolved` and `isOutdated`, and each comment's `author`, `path`, `line`, `body`, and
  `createdAt`.
- **Reviews and comments** come from `gh pr view <number> --json reviews,comments`, and count when
  posted after the last push. Fetch first, then take the remote branch's last commit date as the
  last push's: `git log -1 --format=%cI origin/<branch>`. A commit pushed later than it was made
  only counts more comments, never fewer.

```bash
gh api graphql -f owner=<owner> -f repo=<repo> -F number=<number> -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
            isOutdated
            comments(first: 100) { nodes { author { login } path line body createdAt } }
          }
        }
      }
    }
  }'
```

A pull request with more than 100 threads, or a thread with more than 100 comments, is read page by
page, with `pageInfo { hasNextPage endCursor }` and `after:`.

A reviewer bot's comment is handled like a person's: the human chose when to send the agent, so what
the bot wrote is part of what they asked.

**What to do with each comment**:

- **A change**: apply it in a commit of its own, with the feature's scope, a change of behaviour
  with a test that fails first. Once the folder is replaced by its record, when a change goes
  against what it says, update its **Behaviour** or **Design** in place in the same commit, and add
  a line under **Changes after approval**, so the merged record describes the merged code.
- **A choice the spec does not settle**, or a new decision: bring the folder back and start a new
  round of questions instead of a guess, as [finish](finish.md#changes-asked-on-the-pull-request)
  describes.
- **Nothing to do**: a comment already handled, or one the code answers, gets no commit. The last
  message says why.

**Nothing is written on GitHub**: the agent does not reply to a comment or resolve a thread. Its
last message lists each comment with what it did, one line each, and the commits say the rest.

**The pass ends** when the pull request is ready for review again: the branch pushed, and the pull
request not a draft, with `gh pr ready`. A new round of questions ends it earlier, at that round's
gate. A file waiting for the human, `status: awaiting-human`, ends it at that gate too, once the
comments are handled: the pull request stays a draft, and nothing is finished before the human
answers. Otherwise, a pull request still in draft ends the pass by running the [finish](finish.md)
step, which writes the record when it is not there yet and marks the pull request ready: a draft
opened before finishing, or one whose folder came back for a round now answered and built.

A pull request opened before the finish step existed still has its folder: amend the spec in place
in the same commit, increase its `revision`, and update the plan and its `spec-revision`. The spec
stays `approved`: the human asked for the change.

## Commit

One commit per task, with the plan's message, following [Commits](conventions.md#commits): its code,
its tests, and its checked boxes in `plan.md`. A structural step is a commit of its own, before. The
tasks of a wave are rebased onto the feature branch in the plan's order, so its history reads as if
they were built one after the other. Fixes from reviews are separate commits with the same scope.
