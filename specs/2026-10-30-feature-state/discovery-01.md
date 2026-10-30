# Discovery, round 01: Feature state pass

## Summary

A feature's state, as the web UI shows it, combines two things. One is its workflow step, read by
the core from the branch's latest commit. The other is the state of its agent sessions, read by the
server from the runner's SQLite cache. Products that run agents keep these two layers apart: a
coarse lifecycle (running, idle, ended) and a separate outcome or reason. They roll a parent's
status up from its active or latest run, never from an older failure. A crashed run always ends in a
named state that clears on new activity, or can be archived.

The proposal reports nine symptoms. Each has a cause in the code, most of them confirmed by reading:

- The feature's status is decided in four places, by two different rules.
- A failed or stopped run asks for attention until a new run starts, with no way to clear it.
- The step moves only when the human's own commit lands, behind the pre-commit hook.
- A plan's progress ignores tasks built in parallel on their task branches.
- An open pull request reads as the human's review whatever happens on the branch after it.
- Starting a change from a line of **Now** adds a link and leaves the line.
- The file watcher misses re-created folders, and its quiet period has no upper bound.

## How other products do it

### GitHub Actions and checks

- A check run has a `status` (`queued`, `in_progress`, `completed`) and a separate `conclusion`
  (`success`, `failure`, `cancelled`, `timed_out`, `action_required`, `stale`, ...). Setting a
  conclusion completes the run ([check runs](https://docs.github.com/en/rest/checks/runs)).
- GitHub marks a run incomplete for over two weeks `stale`, so an orphan run ends in a named state
  instead of blocking forever
  ([stale conclusion](https://developer.github.com/changes/2020-02-03-stale-conclusion/)).
- Re-runs are numbered attempts of the same run. The run page shows the latest attempt, with older
  ones in a dropdown
  ([re-running workflows](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/re-running-workflows-and-jobs)).
- A pull request's required checks count only for its head commit: "Checks from earlier commits
  don't satisfy the requirement"
  ([required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)).

### Linear agent sessions

- Six states: `pending`, `active`, `error`, `awaitingInput`, `complete`, `stale`. "Linear tracks
  session lifecycle automatically based on the last emitted activity": the state is derived, never
  set by hand ([agent interaction](https://linear.app/developers/agent-interaction)).
- An agent that emits nothing within 10 seconds shows as unresponsive. After 30 minutes without
  activity the session is `stale`, and stale clears when the agent sends a new activity.
- The inbox has read, unread, snooze, and delete, but no archive
  ([Linear inbox](https://linear.app/docs/inbox)).

### Cursor cloud agents

- An agent is `ACTIVE`, `IDLE`, or `ARCHIVED`. Its runs have their own statuses: `RUNNING`,
  `FINISHED`, `ERROR`, `CANCELLED`, `EXPIRED`. "Runs that ended in a recoverable error also report
  IDLE": a failed run never leaves the agent in an error state
  ([Cursor API endpoints](https://cursor.com/docs/cloud-agent/api/endpoints)).
- One active run per agent: a second one is refused with `409 agent_busy`. Archive and unarchive are
  reversible, and delete is separate.

### Devin

- API v3 splits a coarse `status` (`running`, `suspended`, `error`, `exit`, ...) from a
  `status_detail`: `working`, `waiting_for_user`, `waiting_for_approval`, and, while suspended, a
  reason such as `inactivity`, `user_request`, or `usage_limit_exceeded`
  ([Devin sessions](https://docs.devin.ai/api-reference/v3/sessions/post-enterprise-sessions-messages.md)).
  Its v1 had one flat list of states
  ([v1](https://docs.devin.ai/api-reference/v1/sessions/retrieve-details-about-an-existing-session)).

### GitHub Copilot coding agent

- **Stop session** "ends the GitHub Actions run and preserves any commits already pushed". "Archive
  stopped sessions to remove them from your sessions list"
  ([track sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/track-copilot-sessions)).
- A stuck session "will time out after an hour"
  ([troubleshooting](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/troubleshoot-coding-agent)).
- Seen only in search snippets: each new session on a pull request shows as its own event in the
  timeline, with a link to its log.

### Claude Code on the web

- Sessions can be archived, then unarchived, or deleted after a confirmation. An inactive session's
  machine is reclaimed. On reopening, Claude is told which commands and subagents stopped, so
  interrupted work is named
  ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)).

### OpenAI Codex and Conductor

- Codex documents no state list ([Codex cloud](https://learn.chatgpt.com/docs/cloud)). A user report
  shows tasks still "open" two days after their pull request merged, a stale derived state
  ([community report](https://community.openai.com/t/codex-cloud-tasks-status-stuck-at-open-but-have-been-merged/1330186)).
- Conductor keeps one worktree and branch per workspace, and advises to "archive the others" once
  one path is chosen ([parallel agents](https://www.conductor.build/docs/core/parallel-agents)).

### What they have in common

1. **Two layers**: a lifecycle (running, idle, ended) and an outcome or reason. "Waiting for you" is
   a detail of a live session, not an error.
2. **Derived, not stored**: the state is computed from the last activity or observation.
3. **The parent follows its active or latest run.** No product lets an older failed run hide a newer
   running one.
4. **Orphans end in a named state**, by a heartbeat or a timeout: stale, expired, timed out.
5. **Errors clear**: by new activity, a re-run, a resume, or an archive.
6. **Interrupted work is named**, and its commits kept.
7. **An observation is tied to a version**: checks to the head commit, Kubernetes' conditions to
   their `observedGeneration`.

## Standards and libraries

### Kubernetes conditions and heartbeats

- A status holds "the most recent observations of actual state". A condition has a machine-readable
  `reason`, a `lastTransitionTime`, and an `observedGeneration` that tells when it is out of date.
  "The pattern of using phase is deprecated"
  ([API conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md)).
- A node that misses its heartbeats for 50 seconds becomes `Unknown`, not failed
  ([node status](https://kubernetes.io/docs/reference/node/node-status/)). Temporal does the same
  with a heartbeat timeout, since the server "can't see a Worker that loses connection or crashes"
  ([Temporal](https://docs.temporal.io/encyclopedia/detecting-activity-failures)).

### VS Code's git extension

- It watches `.git` and the working tree, ignores `index.lock` churn, and never trusts what an event
  says. Any event, debounced by 1 second, triggers a fresh `git status` once no git operation runs
  ([watch.ts](https://github.com/microsoft/vscode/blob/main/extensions/git/src/watch.ts),
  [repository.ts](https://raw.githubusercontent.com/microsoft/vscode/main/extensions/git/src/repository.ts)).
- After each git operation it runs itself, failed or not, it refreshes explicitly instead of waiting
  for the watcher.

### git worktrees and notify

- A linked worktree's `HEAD` and index live in `<main>/.git/worktrees/<id>/`, its refs in the common
  directory ([git worktree](https://git-scm.com/docs/git-worktree)).
- notify, the Rust watcher, sees a folder's deletion only from its parent. Large trees may lose
  events, and inotify has a watch limit ([notify](https://docs.rs/notify/latest/notify/)).
- Seen only in a snippet: deleting a ref that exists only in `packed-refs` rewrites that file alone
  ([vcs-watch guide](https://docs.rs/vcs-watch/latest/vcs_watch/guide/)).

### gh

- `gh pr list --json` offers `headRefOid`, the pull request's head commit, and `state`, `mergedAt`
  (checked with `gh pr list --help` in this session). Uraeda asks only `headRefName`, `number`,
  `url`, `isDraft`, `reviewDecision`, and only for open pull requests
  ([pulls.rs](/crates/core/src/pulls.rs)).

## The code

### Important reads

- [runner/status.ts](/packages/server/src/runner/status.ts): `sessionStatus`, one session's status
  from its latest turn. The order is working, blocked, the step waiting on the human, then a failed
  or stopped latest turn as "Needs attention", whether or not the human has seen it. `STATUS_ORDER`
  ranks needs-you 0, attention 1, unread 2, working 3, idle 4.
- [fate/sessions.ts](/packages/server/src/fate/sessions.ts) `featureStatuses`: the feature's status
  for notifications. It takes the latest session's status, raised by an older session that works or
  is blocked. Its reduce keeps the lower `STATUS_ORDER`, so a working older session (3) never raises
  a latest one that needs attention (1).
- [sidebar/entries.ts](/packages/web/src/sidebar/entries.ts): the sidebar takes "a folder's first
  row" from the rows sorted by `STATUS_ORDER`, over every session of the folder. A stopped session's
  row (attention) sorts before a running one's (working).
  [home/Core.tsx](/packages/web/src/home/Core.tsx) copies the pick.
- [home/features.ts](/packages/web/src/home/features.ts): home's Needs you and In progress columns
  read only the step's `waitsOn`, never the sessions.
- [feature/next.ts](/packages/web/src/feature/next.ts) and
  [FeaturePage.tsx](/packages/web/src/feature/FeaturePage.tsx): the feature page reads only the
  latest session's `working`, and its `pull-request` case and human gates ignore it.
- [SessionAttention.tsx](/packages/web/src/session/SessionAttention.tsx): the banner says "You
  stopped the agent." for every stopped turn, including one the server stopped, and cannot be
  dismissed.
- [runner/sessions.ts](/packages/server/src/runner/sessions.ts) and
  [runner/cache.ts](/packages/server/src/runner/cache.ts): at startup, `interrupted` ends every
  running or queued turn of a dead process as `stopped`, "Stopped: the server stopped while it ran."
  `archive` refuses a feature's session. Nothing clears a failed or stopped turn but a new turn.
- [workspace/read.rs](/crates/core/src/workspace/read.rs): the step comes from the branch's latest
  commit, the files from the disk. Uncommitted edits only set `uncommitted`.
- [steps.rs](/crates/core/src/steps.rs): the rules of the step table. Progress is the first task of
  `plan.md` with unchecked boxes, at the tip. An open, non-draft pull request is `pull-request`,
  waiting on the human, whatever the branch holds.
- [api/expected.rs](/crates/core/src/api/expected.rs): the step computed from the disk. Only the
  composer's message reads it, while the folder's commits are queued.
- [cache.rs](/crates/core/src/cache.rs) and [watch.rs](/crates/core/src/watch.rs): one cached
  workspace per worktree while a watch runs, dropped whole by any file event, any write, or a
  changed pull request snapshot. The watcher adds folders it has not watched yet, and never removes
  one: a worktree deleted and re-created at the same path is no longer watched. A burst of events
  ends after 200 ms without one, with no upper bound.
- [pulls.rs](/crates/core/src/pulls.rs) and [server pulls.ts](/packages/server/src/pulls.ts):
  `gh pr list` at start, after a watcher burst, and every 60 seconds while a feature is past its
  last task. The last answer stays 10 minutes when `gh` fails. Nothing runs `git fetch`.
- [repositories.ts](/packages/server/src/repositories.ts) and
  [live.ts](/packages/server/src/live.ts): a landed commit publishes its feature at once. Commits
  waiting in the write queue live in memory: a server that stops forgets them, their files left
  written but uncommitted.
- [start/plan.rs](/crates/core/src/actions/start/plan.rs) and
  [start/typed.rs](/crates/core/src/actions/start/typed.rs): a typed start adds a link at the top of
  **Now**, titled by the first line cut at 80 characters, mid-word.
- [useStartFrom.ts](/packages/web/src/useStartFrom.ts): after a change started from a line, the
  browser removes the line in a separate call. It ignores a refusal, does not commit, and finds the
  line by a position the start has already shifted.

### The proposal's path and existing actions

- **A stopped session while another runs**: the sidebar shows the stopped one's "Needs attention"
  for the feature, since attention sorts first. The notifier shows it too when the stopped session
  is the latest. Confirmed by reading. Seen in data: three features held two or three sessions each
  in the runner's cache.
- **Approving a spec**: `review.approve` writes `spec.md`, and its commit waits in the write queue,
  then runs the pre-commit hook (`vp staged`). Until it lands, every view but the composer shows the
  gate. A landed commit publishes the feature. Two confirmed ways to stay stuck: the server stops
  before the commit lands, or a hook refuses it. The case seen by the human was not reproduced.
- **Manual edits**: an uncommitted edit never moves the step, as the [git](/specs/decisions/git.md)
  decision asks. A deleted and re-created worktree stops being watched, so its uncommitted edits are
  missed. Commits are still seen through `refs/`.
- **Task 16 shown as task 13**: a wave's tasks are built in parallel on `<branch>-task-N` branches,
  merged in the plan's order
  ([implementation](/skills/uraeda/references/implementation.md#for-each-wave)). Progress counts the
  feature branch alone, so it stays at the oldest task not merged.
- **A pull request up, then a new session**: the step stays `pull-request`, waiting on the human.
  The card's step reads "PR ready". The feature page says the review is the human's. Home lists it
  under Needs you. The session's own row says "Working", but the sidebar may pick another row
  (above).
- **A run stopped by a server crash**: its turn is `stopped`, "Needs attention" until a new turn.
  Opening the session does not clear it, and archiving a feature's session is refused. The runner's
  cache holds 14 turns ended this way, and 18 failed by a usage limit.
- **Starting a change from a line of Now**: the line stays, and a link is added above it. Seen in
  `7165b4e2` and `42120399` on main; both lines were removed only at finish.

### Rules and their owners

- **A feature's status** has four copies: `featureStatuses` (notifications, tab title), the
  sidebar's first-row pick in `entries.ts` and `home/Core.tsx`, home's buckets by `waitsOn`, and the
  feature page's `nextOf`. The first two disagree with each other. `STATUS_ORDER` is copied in
  [cards.ts](/packages/web/src/sidebar/cards.ts).
- **A session's status**: `sessionStatus` in [status.ts](/packages/server/src/runner/status.ts), the
  one owner.
- **The step**: [steps.rs](/crates/core/src/steps.rs), read at the tip; its disk-side copy is
  [expected.rs](/crates/core/src/api/expected.rs).
- **A started line of the priorities**: matched by its link only, in
  [workspace/links.rs](/crates/core/src/workspace/links.rs), `is_started` in
  [priorities/edits.rs](/crates/core/src/files/priorities/edits.rs), and the Ongoing split in
  [PrioritiesList.tsx](/packages/web/src/lists/PrioritiesList.tsx).

### Likely changes

- Under every option: `runner/status.ts`, `fate/sessions.ts`, `fate/needs-you.ts`,
  `sidebar/entries.ts`, `sidebar/cards.ts`, `home/Core.tsx`, `home/features.ts`, `feature/next.ts`,
  `FeaturePage.tsx`, `SessionAttention.tsx`, `watch.rs`, `start/plan.rs`, `start/typed.rs`,
  `useStartFrom.ts`, `fate/change-starts.ts`, and
  [projects.md](/skills/uraeda/references/projects.md)'s start of a change.
- With a step that moves at once ([after the human's write](#after-the-humans-write)):
  `workspace/read.rs` or the server's view of the queue, `api/expected.rs`, and the
  [git](/specs/decisions/git.md) decision.
- With progress across task branches ([progress in waves](#progress-in-waves)): `steps.rs` and
  `workspace/branches.rs`.
- With a pull request tied to its head ([an open pull request](#an-open-pull-request)): `pulls.rs`,
  `steps.rs`, the step table of [SKILL.md](/skills/uraeda/SKILL.md#finding-the-next-step), and
  `ura next`.
- Tests that guard replaced behaviour:
  - `packages/server/src/runner/__tests__/status.test.ts`: the table rows of a stopped and a failed
    latest turn.
  - `packages/server/src/__tests__/sessions.test.ts`: "a feature's status is its latest session's,
    raised by an older one blocked", "an older session's failed run does not hold its feature".
  - `crates/core/tests/actions.rs`: `a_long_first_line_is_cut_for_the_title_and_kept_whole`,
    `a_typed_text_starts_a_change`.
  - `crates/core/tests/workspace.rs`: `an_uncommitted_gate_does_not_move_the_step`, only if the disk
    moves the step.
  - `crates/core/tests/steps.rs`: `implementation_progress`, `pull_request_rows`.
  - `packages/server/src/__tests__/queued-commits.test.ts`: "an approval still landing has the
    composer read the step it gives".
- No test covers two sessions of one feature in the sidebar, a run on a feature with an open pull
  request, or a start from a line of **Now**.

## The proposal

### "Done" while a pull request is up

The proposal says a feature reads "done" once its pull request is up. The code has no "done" there:
it reads "PR ready", waiting on the human. The human's reading is fair, since nothing shows that an
agent works on it again.

### "Full refresh"

The UI has no refresh action. The human most likely reloaded the page. A reload re-reads every page;
the browser otherwise keeps pages it read and re-reads one only when it is shown again after 2
seconds away.

### Session states and the worker lifecycle

The proposal asks to clear a crash's warning.
[Worker lifecycle](/specs/proposals/worker-lifecycle.md), in **Next**, asks for runs that survive or
resume after a restart, and a button that continues every stopped agent. The two meet on interrupted
runs.

### Scope size

Six stories at most: one status rule, clearing attention, the step after the human's write, progress
in waves, an open pull request, and a start from a line. That is at the
[split rule](/skills/uraeda/references/writing.md#a-spec)'s limit, with one changed decision at
most. No split is needed.

## Worth it and feasibility

Worth it: these are correctness bugs in the views the human checks most, and the
[performance](/specs/decisions/performance.md) decision already accepts that "a cache that misses a
change shows stale data: invalidation is the core's to get right". Most fixes are small and local.
The two larger ones are a step that moves at once, and progress across task branches.

Outside behaviour:

- `gh pr list --json headRefOid` exists: checked with `gh pr list --help`.
- Unverified: that an unbounded quiet period delays updates in practice. The plan's first task
  measures event rates in a worktree while an agent works.
- Unverified: the exact cause of the approval that stayed "needs you". The plan's first task
  reproduces it in the sandbox.

No option relaxes a security guard.

## Approaches

Criteria: the proposal's "always visible" and "no way to remove", the
[constitution](/specs/CONSTITUTION.md)'s state recoverable from the repository (III), the
[git](/specs/decisions/git.md) decision's step read from commits, the
[ui-behaviour](/specs/decisions/ui-behaviour.md) decision's "an error staying there until dealt
with" and "a write MUST show its result at once", and the
[notifications](/specs/decisions/notifications.md) decision's "a notification always means an ask".

### Rolling up sessions

How a feature's status combines several sessions. See [important reads](#important-reads) and
[what they have in common](#what-they-have-in-common).

| Option                                      | Running always shows | Old failures | Change               |
| ------------------------------------------- | -------------------- | ------------ | -------------------- |
| A. Any running session, else the latest one | yes                  | ignored      | one rule, every view |
| B. The latest session only                  | not an older one     | ignored      | one rule, every view |
| C. The most urgent, working above attention | yes                  | count        | reorder the ranks    |

### Working while the step waits on the human

What a card says when an agent works on a feature whose step waits on the human, like an open pull
request or a round of questions.

| Option                             | Card's pane | What it says          | Notification when it ends |
| ---------------------------------- | ----------- | --------------------- | ------------------------- |
| A. Working, the gate after the run | In progress | Working, and the step | yes, if the step waits    |
| B. Needs you, with a running mark  | Needs you   | Needs you, and a mark | no, it already needed you |

### Clearing attention

How a failed or interrupted run stops asking for attention. See
[the code](#the-proposals-path-and-existing-actions).

| Option                                                     | Server crash          | Human's stop    | Failure         |
| ---------------------------------------------------------- | --------------------- | --------------- | --------------- |
| A. Interrupted is its own state, failures clear on opening | Interrupted, Continue | no attention    | until opened    |
| B. A Dismiss action on every warning                       | until dismissed       | until dismissed | until dismissed |
| C. Opening the session clears everything                   | until opened          | until opened    | until opened    |

### After the human's write

When the step moves after an approval or an answer. See
[VS Code's git extension](#vs-codes-git-extension).

| Option                                  | Moves      | git decision | Manual edits |
| --------------------------------------- | ---------- | ------------ | ------------ |
| A. From Uraeda's queued write, at once  | at once    | narrowed     | unchanged    |
| B. From the commit, with a landing mark | on landing | unchanged    | unchanged    |
| C. From every worktree's disk           | on save    | reversed     | move it      |

### Progress in waves

How a plan's progress reads while tasks are built in parallel.

| Option                                | Shows       | Reads          |
| ------------------------------------- | ----------- | -------------- |
| A. Tasks done, across task branches   | 14 of 20    | branches + tip |
| B. The range of tasks in flight       | 13–16 of 20 | branches + tip |
| C. The first unchecked task, as today | task 13     | tip            |

### An open pull request

What an open pull request means once the branch holds commits it lacks.

| Option                                          | Branch ahead of the pull request | Skill's step table |
| ----------------------------------------------- | -------------------------------- | ------------------ |
| A. The review waits only for the head           | agent's step: push               | one row added      |
| B. An open pull request is the review, as today | human's review                   | unchanged          |

### Needs no choice

- **Two layers**: covered by the rolling-up and working topics.
- **Orphans end in a named state**: the server already ends a dead process's runs at startup.
  Heartbeats and resuming are [Worker lifecycle](/specs/proposals/worker-lifecycle.md)'s.
- **Interrupted work named**: the banner's wording, a bug.
- **Archive**: a feature's sessions end with their feature, at finish or drop.
- **A start from a line**:
  [projects.md](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature)
  already says the proposal moves to the top of **Now** as a link; a change's start from a line only
  lacks the same sentence.
- **Merged pull requests without a fetch**: asking `gh` for merged pull requests too is a detail.
- **The watcher**: re-watching a re-created folder and bounding the quiet period are details.

## Not checked

- Cursor's, Conductor's, and Codex's labels in their UIs: no official page documents them.
- Linear's display of several sessions on one issue.
- Whether GitHub's Done brings a notification back on new activity.
