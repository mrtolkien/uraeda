---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Feature state pass

> [!IMPORTANT]
>
> Spec to review, about 20 minutes.
>
> - You approve one status for each feature, the same in every view: working while any of its
>   sessions runs, a warning until you dismiss it, and a step that moves as soon as you act.
> - A new decision, Feature status, takes the step's reading over from the git decision, which
>   changes with it.
> - The workflow changes: an open pull request lacking the branch's latest commits gives the agent a
>   new step, Push. The skill, `ura next`, and the cards gain it.
> - A run the server stopped asks for you until you dismiss it: no Continue button. Resuming stays
>   in Worker lifecycle.
> - Settled while writing: while an agent works, a gate's label drops "ready": "PR", not "PR ready".
> - Unverified: the approval that stayed "Needs you" was not reproduced. The plan's first task
>   reproduces it, and adds a story if neither known cause explains it.
> - Risk tier `medium`: a column added to the runner's cache, and a step added to the workflow. The
>   plan does not wait for your review.

A feature's state is right everywhere, at once: in the sidebar, home, the feature page, the
notifications, and the tab's title. Any running agent shows. A failure stays until you dismiss it.
Your approvals move the step at once. A plan's progress counts tasks built in parallel. A pull
request is ready for you only once it holds the branch's work. A line of **Now** started as a change
leaves **Now**. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

- **New: [Feature status](../decisions/feature-status.md)**. A feature's status is decided in one
  place: working while any session runs, else its latest session's, a failure until dismissed, and a
  pull request ready only when it holds the branch's latest commit.
- **Changed: [Git](../decisions/git.md)**. How a step is read moves to Feature status, with your
  queued writes added. The rule, its rejected alternative, and its consequence leave this decision.

Relied on:

| Decision                                       | What it means for this spec                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| [UI behaviour](../decisions/ui-behaviour.md)   | an error stays next to what it concerns until dismissed; a write shows at once |
| [Notifications](../decisions/notifications.md) | a feature notifies when its status comes to need you, from the one status      |
| [Agents](../decisions/agents.md)               | a dismissal is kept in the runner's cache, never in the repository             |
| [Performance](../decisions/performance.md)     | the step after your write draws within 100 ms; the cache's invalidation holds  |
| [Preview](../decisions/preview.md)             | the mockups are stories of the real card and banner                            |
| [Testing](../decisions/testing.md)             | each symptom gets a test reproducing it; the UI is checked in the sandbox      |

## User stories

### US1: A running agent always shows, the same everywhere (P1)

A feature reads "Working" in the In progress pane while any of its sessions runs, whatever its step.
Otherwise it follows its latest session, then its step. The sidebar, home, the feature page,
notifications, and the tab's title all read this one status.

[An agent at work on an open pull request](/packages/web/src/sidebar/FeatureState.stories.tsx#WorkingOnAPullRequest)

[Back for your review](/packages/web/src/sidebar/FeatureState.stories.tsx#ReadyForReview)

Key scenarios:

1. **Given** "Leader key" with an older session stopped by a server restart and a newer session
   running, **When** the human looks at the sidebar, home, and its page, **Then** each reads
   "Working". The stopped session's "Needs attention" shows only on its own row, in the feature's
   Sessions.
2. **Given** "Panes size", whose pull request #75 holds the branch's latest commit, **When** the
   human sends its session a message, **Then** its card moves to In progress, reading "PR" and
   "Working", and no notification fires.
3. **Given** that run, **When** it ends without a new commit, **Then** the card goes back to Needs
   you as "PR ready", and one notification says the pull request is ready for review.

More scenarios:

1. **Given** "Leader key" whose older session failed and whose latest session is idle, **When** the
   sidebar shows it, **Then** it follows the latest session and its step, never the older failure.
2. **Given** a running session that is not the feature's latest, **When** the human opens the
   feature's page, **Then** its "Next" names that session at work, not the human's review.
3. **Given** a round of questions waiting for the human and a session asked about one of them,
   **When** the agent works, **Then** the card reads "Questions" and "Working", in In progress.

### US2: Dismiss a failed or stopped run (P1)

A run that failed, that the human stopped, or that the server stopped asks for the human until they
dismiss it. Dismiss is on the card and on the session's banner. The banner says who stopped the run.

[A run that needs attention, with Dismiss](/packages/web/src/sidebar/FeatureState.stories.tsx#NeedsAttention)

[The banners, each with Dismiss](/packages/web/src/sidebar/FeatureState.stories.tsx#SessionBanners)

Key scenarios:

1. **Given** the server restarted while "Feature state" ran its discovery, **When** the human opens
   its session, **Then** the banner reads "The server stopped the agent.", and the card "Needs
   attention".
2. **Given** that card, **When** the human presses Dismiss on the card or the banner, **Then** the
   card follows its step, "Needs you" if the step waits on the human, otherwise "Idle", in every
   tab.
3. **Given** a run that failed on a usage limit, **When** the human opens its session and leaves it
   without dismissing, **Then** the card still reads "Needs attention".

More scenarios:

1. **Given** a dismissed run, **When** the server restarts, **Then** the run stays dismissed.
2. **Given** a dismissed run, **When** the human sends the session a message, **Then** a new run
   starts, as before.
3. **Given** a run the human stopped, **When** the human opens its session, **Then** the banner
   reads "You stopped the agent.", with Dismiss.

### US3: The step moves as soon as you act (P1)

An approval or an answer moves the feature's step at once, while its commit lands behind the others
and the pre-commit hook. A refused commit moves it back.

Key scenarios:

1. **Given** "Leader key"'s spec waiting for review and two commits queued, **When** the human
   approves it, **Then** within 100 ms its card leaves Needs you and reads "Approving", while the
   toast shows the commit landing.
2. **Given** that approval queued, **When** the pre-commit hook refuses its commit, **Then** the
   card goes back to "Spec ready", in Needs you, with the hook's error next to it.
3. **Given** a worktree deleted and re-created at the same path, **When** a commit lands in it,
   **Then** the card shows the new step within 1 second.

More scenarios:

1. **Given** a status edited by hand in an editor, uncommitted, **When** the sidebar shows the
   feature, **Then** the step is unchanged until the edit is committed.
2. **Given** an agent's commands writing the index every 100 ms for a minute, **When** a commit
   lands, **Then** the card shows the new step within 1 second.

### US4: Progress counts tasks built in parallel (P2)

A plan's progress is the number of tasks done, counting a task whose boxes are all checked on its
task branch before it is merged.

[Progress during a wave](/packages/web/src/sidebar/FeatureState.stories.tsx#ProgressInAWave)

Key scenarios:

1. **Given** a plan of 20 tasks, 12 merged, tasks 13 to 16 built at once, 14 and 15 with every box
   checked on their task branches, **When** the card shows it, **Then** it reads "14/20", named "14
   of 20 tasks done".
2. **Given** that wave, **When** task 13 is merged, **Then** it reads "15/20".

More scenarios:

1. **Given** task 16's branch with half its boxes checked, **When** progress is counted, **Then**
   task 16 does not count.
2. **Given** task 14 merged and its task branch deleted, **When** progress is counted, **Then** it
   counts once.

### US5: A pull request is ready only with the branch's work (P2)

An open pull request waits for the human's review only when its head is the branch's latest commit.
When the branch holds commits it lacks, the step is the agent's, Push.

[Commits to push](/packages/web/src/sidebar/FeatureState.stories.tsx#CommitsToPush)

Key scenarios:

1. **Given** "Panes size" with two commits made after pull request #75's head, and no session
   running, **When** the card shows it, **Then** it reads "Push", in In progress, and `ura next`
   names the push.
2. **Given** those commits, **When** the agent pushes them, **Then** the card reads "PR ready", in
   Needs you, within 60 seconds.

More scenarios:

1. **Given** pull request #75 merged on GitHub, and no fetch, **When** the next check of pull
   requests runs, **Then** the feature reads merged, and leaves the sidebar.
2. **Given** a local branch behind its pull request's head, **When** the card shows it, **Then** it
   reads "PR ready": nothing is left to push.

### US6: A line of Now started as a change leaves Now (P2)

Starting a change from a line of **Now** replaces the line by the change's link, in the start's
commit. The link's title is cut at a whole word.

Key scenarios:

1. **Given** **Now** holding "Amend the latest commit if the commit touches only workflow files
   (proposals/notes)", with a nested line, **When** the human starts it as a change, **Then** the
   line becomes the change's link at the top of **Now**, its nested line goes into the proposal, and
   the Priorities page shows it only under Ongoing.
2. **Given** the line "Add ? in status, after leader. It should show all shortcuts of the page and
   be searchable", **When** it is started, **Then** its title reads "Add ? in status, after leader.
   It should show all shortcuts of the page and be…".

More scenarios:

1. **Given** the line edited in another tab before the start, **When** the start runs, **Then** the
   link is added at the top of **Now**, and the edited line stays.

## Replaced behaviour

- **A feature's card follows its most urgent session, "Needs attention" before "Working".** No test
  guards it.
- **The notifier's status is the latest session's, raised only by an older blocked or working one
  ranked more urgent.** Guarded by `packages/server/src/__tests__/sessions.test.ts`: "a feature's
  status is its latest session's, raised by an older one blocked", "an older session's failed run
  does not hold its feature".
- **A failed or stopped run asks for attention until a new run.** Guarded by
  `packages/server/src/runner/__tests__/status.test.ts`, the rows of a failed and a stopped latest
  turn.
- **Home sorts features by their step alone.** No test guards it.
- **The step waits for the approval's commit.** Guarded by
  `packages/server/src/__tests__/queued-commits.test.ts`: "an approval still landing has the
  composer read the step it gives".
- **Progress is the first task unchecked on the feature branch.** Guarded by
  `crates/core/tests/steps.rs`: `implementation_progress`.
- **An open pull request is ready for review whatever the branch holds.** Guarded by
  `crates/core/tests/steps.rs`: `pull_request_rows`.
- **A typed start's title is cut at 80 characters, mid-word, and a start from a line adds a link.**
  Guarded by `crates/core/tests/actions.rs`:
  `a_long_first_line_is_cut_for_the_title_and_kept_whole`, `a_typed_text_starts_a_change`.

## Architecture

The core keeps deciding the step, now from the branch's commits and Uraeda's queued writes, its task
branches, and its pull request's head. The server alone combines the step and the sessions into the
feature's status, and sends it with each feature. Every view and the notifier read it instead of
combining their own. See [rolling up sessions](discovery-01.md#rolling-up-sessions) and
[after the human's write](discovery-01.md#after-the-humans-write).

- **The feature's status**, a new server module, decides each feature's status from its step and its
  sessions. It owns the rules of the [Feature status](../decisions/feature-status.md) decision. The
  sidebar, home, the feature page, the notifier, and the tab's title read it; the browser's copy of
  the status ranks goes.
- **A session's status**, in the runner, owns when one session asks for attention: a failed or
  stopped latest turn not dismissed. It tells a stop by the server from one by the human.
- **The runner's cache** keeps each turn's dismissal, and refuses one for a turn still running.
- **The step**, in the core, owns progress, counting task branches, and the pull request's
  readiness: ready when its head is the branch's latest commit, Push when the branch is ahead.
- **The queued step**, in the core, applies Uraeda's writes still landing to their folder's step.
  The composer's disk-side copy of the step goes: one owner.
- **Pull requests**, in the core, ask `gh` for each pull request's head, and for merged ones.
- **The watcher**, in the core, watches a re-created folder again, and ends a burst of events at
  most 1 second after its first.
- **The start from a line**, in the core and the server, replaces the line by its link in the
  start's commit, as a feature's start does. The browser's separate removal goes. A title is cut at
  its last whole word, with "…".
- **The skill**: the step table and `ura next` gain the Push row, the implementation's reference
  says how to push, and [projects](/skills/uraeda/references/projects.md) says a line started as a
  change leaves **Now**. The templates and the example change with them.

Tradeoffs:

- A run the server stopped waits for a dismiss or a message, until Worker lifecycle resumes runs.
- Uraeda's queued writes move the step, so the step can differ from the commit for a few seconds.
- Reading task branches adds a branch read per task in flight, kept in the core's cache.

## Edge cases

| Importance | Situation                                                      | What happens                                                                             |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| High       | The server stops before a queued approval lands                | the approval stays written, uncommitted; the card reads "Needs you" and Commit offers it |
| High       | Two sessions of a feature both report running, after a crash   | the feature reads "Working"; the dead one's turn is stopped at the next start            |
| High       | Dismiss on a run that a new run replaced meanwhile             | nothing changes: the new run's status stands                                             |
| Normal     | `gh` fails while a pull request is open                        | the last answer holds for 10 minutes, then the step reads "PR unknown"                   |
| Normal     | A task branch exists for a task the plan no longer has         | it does not count                                                                        |
| Niche      | A title whose first 80 characters hold no space                | it is cut at 79 characters, with "…"                                                     |
| Niche      | A feature's step is done, while one of its sessions still runs | the session stays in the sidebar's Sessions until its run ends                           |

## Success criteria

- **SC-001** (one status): For each case of the scenarios above, the sidebar, home, the feature
  page, and the notifier give the same status.
- **SC-002** (100 ms): An approval moves its feature's card within 100 ms, on the benchmark.
- **SC-003** (1 second): A commit in a watched worktree, even re-created, shows within 1 second,
  under steady index writes.
- **SC-004** (never hidden): No running session is missing from the sidebar, in any sandbox project.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, but one.
With a Dismiss instead of runs reading "Interrupted", no Continue button comes: a message to the
session continues it, as today. Settled while writing this spec:

- While an agent works on a feature at a gate, the gate's label drops "ready": "Spec", "Plan", "PR".
  A feature that is working is not ready for the human.
- A dismissal belongs to its run: a new run that fails asks again. Only the latest run of the latest
  session can ask, so older dismissals never matter.
- The Push step waits on the agent, its card in In progress, its icon a pull request's.
- A line of **Now** is found by its text at the start. A line changed meanwhile is left, and the
  link added, as for typed text.
- The card's name reads "N of M tasks done", and the task title it carries is the first task not
  done anywhere.

## Constitution check

| I. Humans in control | II. Git and plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | ---------------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅                     | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: a column added to the runner's cache, and a step added to the workflow's table, over
many views.
