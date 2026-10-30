---
kind: feature
finished: 2026-10-31
pull-request: https://github.com/mrtolkien/uraeda/pull/80
supersedes: [2026-10-15-add-bugfixing, 2026-10-29-performance-pass]
---

# Record: Feature state pass

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-31, in [its pull request](https://github.com/mrtolkien/uraeda/pull/80). Its full files are
> in git: `git log -- specs/2026-10-30-feature-state/`.

## What and why

A feature's state was often wrong in the web UI: a stopped session marked a feature as needing
attention while another session ran, an approval stayed "Needs you" until a reload, a pull request
read as done after a new session started, an agent on task 16 showed task 13, a crash's warning
could never be cleared, and a change started from a line of **Now** left the line there. The human
asked for one state, right everywhere, at once, through manual edits, crashes, and restarted
sessions.

## Behaviour

- **One status per feature**, the same in the sidebar, home, the feature page, the notifications,
  and the tab's title. A feature reads "Working" while any of its sessions runs, whatever its step;
  otherwise it follows its latest session, never an older session's outcome; without a session, its
  step. While an agent works on a gate, its label drops "ready": "Spec", "Plan", "PR"; the card sits
  in In progress, and Next says the agent works, with a link to that session. A run that ends at a
  gate notifies once, under a key carrying the run's turn. A running session of a feature that left
  the sidebar, such as a merged one, shows as a session card until its run ends.
- **A failed or stopped run asks until dismissed.** A run that failed, that the human stopped, or
  that the server stopped reads "Needs attention" until the human presses Dismiss, on the feature's
  card or the session's banner; opening the session does not clear it. The banner says who stopped
  it: "The server stopped the agent." or "You stopped the agent."; a failed run's banner starts with
  its reason. The dismissal is kept in the runner's cache, across restarts, and belongs to its run:
  a new run that fails asks again. A running or queued run, and a message taken back, cannot be
  dismissed. A run halted before a gate still clears when the step moves. Dismiss draws its result
  at once, and a refusal shows next to the card or the banner.
- **The step moves as soon as the human acts.** An approval or an answer moves the feature's step at
  once, read from the commit with Uraeda's own writes still landing laid on top, behind the queue
  and the pre-commit hook; a refused commit moves it back. A file edited by hand still moves the
  step only once committed. Measured at 38 ms on a release build (SC-002's 100 ms).
- **The watcher** watches a worktree deleted and re-created at the same path again, and reports a
  burst of events at most 1 second after its first. A push of a feature's branch is reported too.
- **Progress counts tasks built in parallel**: the card reads "14/20", named "14 of 20 tasks done",
  counting a task whose boxes are all checked at the tip or on its own task branch,
  `<branch>-task-N`, matched by number and title. Its title is the first task done nowhere; once
  every task is done somewhere, no task is named current.
- **A pull request is ready only with the branch's work.** An open pull request, not a draft and
  without changes requested, waits for the human only when its head holds the branch's latest
  commit. When the branch is ahead, the step is the agent's, Push, in In progress; `ura next` names
  it, and the skill's step table and the implementation's reference say how to push, never forcing.
  A head the repository never fetched counts as holding the branch. A pull request merged on GitHub
  makes its feature done without a fetch, when its head holds the branch's tip, or, unfetched, when
  the branch has nothing unpushed. `gh` failing keeps the last answer 10 minutes, then "PR unknown".
- **A line of Now started as a change leaves Now**: the start commit replaces it by the change's
  link at the top of **Now**, its nested lines going into the proposal unless the text holds them. A
  line changed meanwhile stays, and the link is added. A line of **Next** or **Later** is taken out
  as before, found by its text. A typed title is cut at its last whole word, with "…", within 80
  characters; a first 80 characters with no space are cut at 79.

## Design

The core keeps deciding the step, now from the branch's commits with Uraeda's queued writes, its
task branches, and its pull request's head. The runner owns one session's status, and its cache a
turn's dismissal. The server alone combines the step and the sessions into the feature's status, and
sends it with each feature; every view and the notifier read it.

- **The feature's status**: [`fate/feature-status.ts`](/packages/server/src/fate/feature-status.ts),
  read by the `Workspace` and `Feature` records
  ([`fate/sources.ts`](/packages/server/src/fate/sources.ts)) and the notifier
  ([`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts)), over the reads of
  [`fate/session-reads.ts`](/packages/server/src/fate/session-reads.ts). Each source's read gets its
  own copy of the request's context ([`fate/source.ts`](/packages/server/src/fate/source.ts)), so a
  live connection's updates read anew.
- **A session's status**: [`runner/status.ts`](/packages/server/src/runner/status.ts), whose ranks
  the web imports through `uraeda-server/status`. The dismissal: `turns.dismissed_at` in the
  runner's cache ([`runner/migrations.ts`](/packages/server/src/runner/migrations.ts)),
  `Sessions.dismiss`, and the `session.dismiss` mutation.
- **The queued step**: the deferred commits' pending writes, one snapshot per read, in
  [`actions/deferred.rs`](/crates/core/src/actions/deferred.rs), laid on the tip's texts by
  [`workspace/read.rs`](/crates/core/src/workspace/read.rs).
- **The step**: [`steps.rs`](/crates/core/src/steps.rs) (`Push`, `PullRequest::Unpushed`,
  `TaskProgress { done, total, title }`), with the task branches read by
  [`workspace/tasks.rs`](/crates/core/src/workspace/tasks.rs), and the pull requests' heads and
  merges from `gh` in [`pulls.rs`](/crates/core/src/pulls.rs), compared through gix in
  [`git/history.rs`](/crates/core/src/git/history.rs).
- **The watcher**: [`watch.rs`](/crates/core/src/watch.rs).
- **The start from a line**: [`actions/start/plan.rs`](/crates/core/src/actions/start/plan.rs) and
  [`typed.rs`](/crates/core/src/actions/start/typed.rs), `change.start`'s `line`, and the New change
  page.
- **The views**: [`sidebar/cards.ts`](/packages/web/src/sidebar/cards.ts),
  [`sidebar/entries.ts`](/packages/web/src/sidebar/entries.ts),
  [`home/features.ts`](/packages/web/src/home/features.ts),
  [`feature/next.ts`](/packages/web/src/feature/next.ts),
  [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx), and
  [`useDismiss.ts`](/packages/web/src/useDismiss.ts); their stories are in
  [`FeatureState.stories.tsx`](/packages/web/src/sidebar/FeatureState.stories.tsx).
- **The skill**: the Push rows of [`SKILL.md`](/skills/uraeda/SKILL.md) and
  [`change.md`](/skills/uraeda/references/change.md), the Push section of
  [`implementation.md`](/skills/uraeda/references/implementation.md#push), and a change's start from
  a line in [`projects.md`](/skills/uraeda/references/projects.md).

## Replaced behaviour

- **A feature's card follows its most urgent session, "Needs attention" before "Working".** No test
  guarded it; `cards.test.ts`'s `featureStatus` table went with the browser's rule.
- **The notifier's status is the latest session's, raised by an older blocked or working one.**
  `sessions.test.ts`: "a feature's status is its latest session's, raised by an older one blocked"
  and "an older session's failed run does not hold its feature", rewritten.
- **A failed or stopped run asks for attention until a new run.** `runner/__tests__/status.test.ts`,
  the rows of a failed and a stopped latest turn, rewritten.
- **Home sorts features by their step alone.** No test guarded it.
- **The step waits for the approval's commit; the composer alone reads the step from the disk.**
  `queued-commits.test.ts`: "an approval still landing has the composer read the step it gives",
  rewritten; `runs.rs`: `the_expected_step_reads_the_uncommitted_files`, removed with
  `expectedStep`.
- **Progress is the first task unchecked on the feature branch.** `steps.rs`:
  `implementation_progress`, rewritten.
- **An open pull request is ready for review whatever the branch holds.** `steps.rs`:
  `pull_request_rows`, rewritten.
- **A typed start's title is cut at 80 characters, mid-word, and a start from a line adds a link.**
  `actions.rs`: `a_long_first_line_is_cut_for_the_title_and_kept_whole` and
  `a_typed_text_starts_a_change`, rewritten.

## Gotchas

- **Each source reads with its own context**: fate's live connection keeps one request context for
  its life, so a cache keyed by the context kept the first answer, and live updates repeated it
  ([`fate/source.ts`](/packages/server/src/fate/source.ts)). The workspace's cache had done so since
  2026-10-14, one cause of the approval that stayed "Needs you" until a reload.
- **A commit whose hooks run is still pending**: `land` keeps it in a `landing` map until git is
  done, cleared by a guard, so a read during the hook still sees the write
  ([`actions/deferred.rs`](/crates/core/src/actions/deferred.rs)).
- **A read takes the pending writes before any tip**, so a commit landing during the read never
  shows the gate again ([`workspace/reader.rs`](/crates/core/src/workspace/reader.rs)).
- **SC-002's 100 ms holds on a release binding**: the dev binding takes about 120 ms, 80 of them in
  the core's approve call ([`live.bench.ts`](/packages/server/src/__tests__/live.bench.ts)).
- **The watcher's re-watch keys a folder by its device, inode, and creation time**: inotify drops
  the watch of a deleted folder, and an inode can be reused
  ([`watch.rs`](/crates/core/src/watch.rs)).

## Questions

### Round 01

#### Q1: Which session does a feature's card follow, when it has several?

**Answer:** A: its running session when one runs, otherwise its latest; older sessions' outcomes
never show on the feature.

#### Q2: While an agent works on a feature that waits on you, what does its card say?

**Answer:** A: "Working", in In progress, then back to the gate with a notification. "Any agent
working on a feature means it's in progress. It can't be waiting for me if something's running."

#### Q3: How does a failed or interrupted run stop asking for you?

**Answer:** B: every failed or stopped run needs attention until Dismiss, on its card or its
session's banner.

#### Q4: When should the step move after you approve a spec or answer a round?

**Answer:** A: at once, from Uraeda's own write waiting to be committed, back if the commit is
refused; edits outside Uraeda move it only once committed.

#### Q5: How should a plan's progress read while its tasks are built in parallel?

**Answer:** A: the tasks done, counting those done on their task branches.

#### Q6: Should an open pull request count as ready for your review once the branch has newer commits?

**Answer:** A: only when its head is the branch's latest commit, otherwise the agent's push. "Also
if there's a session running, it's not ready for review."

#### Q7: Where should the rule of a feature's status be written down?

**Answer:** B: in a new decision, Feature status, which "can also take some of the lines from the
git decision, if they are about the status of a feature".

## Decisions

- [Feature status](../decisions/feature-status.md): new, the rules of a feature's status, decided in
  one place.
- [Git](../decisions/git.md): changed, how a step is read moved to Feature status, with the human's
  queued writes added.

## Changes after approval

- With a Dismiss rather than runs reading "Interrupted", no Continue button came: a message to the
  session continues it.
- A run halted before a gate has no Dismiss: it still clears when the step moves.
- A chat session's card has no Dismiss: its banner has.
- Progress's readers name the count of tasks done, not a task's place, and the card no longer names
  the task.
- A pull request merged on GitHub and never fetched reads as merged when the branch has nothing
  unpushed, and a change's Push step follows the change's reference.
- A Dismiss of a message taken back is refused, and the banner dismisses the run its status follows.
- A feature with problems reads "Needs you" and never notifies, as before.
- Two rows of the skill's step table were shortened, to keep `SKILL.md` under its length test.
- The ledger's word budget rose to 12,100 words for the new decision.

## Follow-ups

- Inbox, deferred fixes: a push to an open pull request can read "Needs attention" until `gh` is
  checked again; a failed or stopped run at a step waiting on the human reads "Needs you", without
  Dismiss; a pull request merged and not fetched loses its number on the feature page; the workspace
  record's `running` has no reader left.
- Resuming runs after a restart, and continuing every stopped agent at once, stay in
  [Worker lifecycle](../proposals/worker-lifecycle.md).
