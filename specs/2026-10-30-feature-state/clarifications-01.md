---
status: awaiting-human
---

# Clarifications, round 01: Feature state pass

> [!IMPORTANT]
>
> 7 questions, about 20 minutes.
>
> - Verdict: worth building, with changes: each symptom has a cause in the code, and three of them
>   need a rule only you can set.
> - A changed decision: moving the step as soon as you approve, before the commit lands, narrows the
>   git decision's "step read from the latest commit".
> - Three questions work together: which session a feature's card follows, and what it says while an
>   agent works on a gate. The third is how a failed or interrupted run stops asking for you.
> - A change to the workflow: an open pull request that lacks the branch's latest commits stops
>   counting as ready for your review.
> - The approval that stayed "Needs you" was not reproduced: two causes are confirmed, and the plan
>   starts by reproducing it.
> - Four points are settled without you: check them under "Check these", before the questions.

## Context

### Goal

The [proposal](proposal.md) asks for a feature's state to be right, everywhere, at once. That covers
its step, its sessions, and its place in the priorities, including after manual edits, a crash, or a
restarted session.

### Today

A feature's state has two layers. Its step comes from the branch's latest commit, read by the core
([steps.rs](/crates/core/src/steps.rs)). Its sessions' statuses come from the runner's cache
([status.ts](/packages/server/src/runner/status.ts)). The feature's status is combined from both in
four places, by two different rules:

| Place                | Picks                                                  |
| -------------------- | ------------------------------------------------------ |
| Sidebar, home's core | the session that ranks first: attention before working |
| Notifications, title | the latest session, raised by an older one that works  |
| Home's columns       | the step alone                                         |
| Feature page         | the latest session's "working", ignored at a gate      |

Agent products keep a run's lifecycle apart from its outcome. They follow the active or latest run,
and let errors clear: Linear, Cursor, Devin, GitHub Actions, and Copilot all do.

### Scope

The nine symptoms of the proposal, each with its cause:

- the feature's status, picked differently in four places;
- a failed or stopped run that asks for you until a new run starts;
- the step after your own approval, which waits for the commit and its hook;
- a plan's progress while tasks are built in parallel;
- an open pull request, after the branch moved on;
- a change started from a line of **Now**, which leaves the line;
- the file watcher, which misses re-created worktrees.

Left out: runs that survive or resume after a server restart, and a button that continues every
stopped agent. Both are [Worker lifecycle](/specs/proposals/worker-lifecycle.md)'s, in **Next**.

### Sources

- The runner, the server's views, the sidebar, home, and the feature page, linked in each question.
- The core's step, cache, watcher, and pull requests.
- The runner's cache on this machine: 14 runs ended by a server stop, 18 by a usage limit.
- GitHub Actions, Linear's agent sessions, Cursor's and Devin's APIs, Copilot, Claude Code on the
  web, Kubernetes, VS Code's git extension.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **A start from a line of Now** turns the line into the change's link in the start commit, its
  nested lines going into the proposal. A feature's start already moves its line this way; the
  browser's separate removal, which removed nothing, goes. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **A started item's title** is cut at the last whole word under 80 characters, with "…", instead of
  mid-word: "Add ? in status, after leader. It should show all shortcuts of the page and be s"
  becomes "…of the page and…". See [discovery](discovery-01.md#important-reads).
- **No refresh button**: each cause of a stale view is fixed instead. A page reload stays the escape
  hatch. See [discovery](discovery-01.md#full-refresh).
- **Resuming after a restart** stays in Worker lifecycle. This feature only makes an interrupted run
  read right. With the recommended way to clear attention, it also offers to continue it, one
  session at a time. See [discovery](discovery-01.md#session-states-and-the-worker-lifecycle).

## Q1: Which session does a feature's card follow, when it has several?

Example: "Leader key" has two sessions. The older one was stopped by a server crash yesterday. You
started a new one this morning, which is working now.

Today the sidebar shows "Needs attention", from the stopped session, because attention ranks before
working. Notifications follow the latest session only, so they stay quiet. No agent product lets an
older failed run hide a newer one that runs. What the card says while the step waits on you is Q2;
how the stopped run stops asking is Q3. More in [discovery](discovery-01.md#rolling-up-sessions).

Why it matters: one rule replaces four copies. It sets what the sidebar, home, the feature page,
notifications, and the tab's title all say.

- **A (recommended). A feature follows its running session when one runs, otherwise its latest
  session; older sessions' outcomes never show on the feature.**
  - Example: "Leader key" reads "Working". The stopped session keeps its mark on its own row, in the
    feature's Sessions.
  - [pro] a running agent always shows, even in an older session.
  - [con] an older session's failure only shows on the feature's page.
  - Why recommended: it is what every product compared does, and only one session of a feature can
    work at a time.
- **B. A feature follows its latest session only.**
  - Example: "Leader key" reads "Working", from the latest session. Had the older one been running
    instead, the card would not show it.
  - [pro] the simplest rule.
  - [con] a run in an older session, which you can start from its page, is invisible.
- **C. A feature shows its most urgent session, with "working" ranked above "needs attention".**
  - Example: "Leader key" reads "Working". Once it ends, the card goes back to the stopped session's
    "Needs attention".
  - [pro] nothing that went wrong is ever hidden.
  - [con] an old crash comes back after every run, until it is cleared.

**Answer:**

## Q2: While an agent works on a feature that waits on you, what does its card say?

Example: "Panes size" has pull request #75 open, waiting for your review. You start a session to fix
a comment. The agent works for 10 minutes.

Today the session's own row says "Working", but the card's step reads "PR ready". Home lists it
under Needs you, and the feature page says the review is yours: it looks done. Devin and Linear
treat "waiting for you" as a detail of a live session, not a state beside it. Which session counts
is Q1. More in [discovery](discovery-01.md#working-while-the-step-waits-on-the-human).

Why it matters: it decides whether "Needs you" means "you can act now", and when a notification
fires.

- **A (recommended). The card reads "Working" in the In progress pane while the agent runs. It then
  goes back to the gate, "PR ready", in Needs you, with a notification.**
  - Example: "Panes size" moves to In progress for 10 minutes, then back to Needs you.
  - [pro] Needs you lists only what you can act on now.
  - [con] a card moves between panes twice per run.
  - Why recommended: you cannot review a pull request an agent is still changing. A notification
    then means the ask is ready, as the notifications decision asks.
- **B. The card stays in Needs you, "PR ready", with the running agent's mark beside it.**
  - Example: "Panes size" stays in Needs you, with the agent's mark, for 10 minutes.
  - [pro] the card never moves.
  - [con] Needs you lists work you should not touch yet.

**Answer:**

## Q3: How does a failed or interrupted run stop asking for you?

Example: the server restarted while "Feature state" was in discovery. Its run ended with "the server
stopped while it ran". Another run failed on a usage limit, at 1:20.

Today both read "Needs attention" until a new run starts. Opening the session does not clear it, and
a feature's session cannot be archived. The banner says "You stopped the agent." even when the
server did. The UI behaviour decision asks for an error "staying there until dealt with". Linear
clears a stale session on new activity; Cursor shows a failed run's agent as idle and usable. More
in [discovery](discovery-01.md#clearing-attention).

Why it matters: it decides what "Needs attention" means, and whether an old crash can sit in Needs
you for days.

- **A (recommended). A run the server stopped, or that you stopped, reads "Interrupted", not "Needs
  attention", with a Continue button that sends "continue" to its session. A failed run needs
  attention until you open its session.**
  - Example: "Feature state" reads "Interrupted · Continue" in In progress. The usage-limit failure
    sits in Needs you until you open it.
  - [pro] only real failures ask for you, and opening one is dealing with it.
  - [con] an interrupted run waits for a click, until Worker lifecycle resumes runs alone.
  - Why recommended: you know when you stopped a run, and a restart is not the agent's failure.
- **B. Every failed or stopped run needs attention until you press Dismiss, on its card or its
  session's banner.**
  - Example: both read "Needs attention" until you dismiss each.
  - [pro] nothing clears without an explicit act.
  - [con] one more click per run, including for runs you stopped yourself.
- **C. Every failed or stopped run needs attention until you open its session.**
  - Example: both clear as soon as you open their sessions.
  - [pro] the same rule as a chat's new reply.
  - [con] a run you stopped yourself still asks for you once.

**Answer:**

## Q4: When should the step move after you approve a spec or answer a round?

Example: you approve the spec of "Leader key". Its commit waits behind two others, then runs the
pre-commit hook, for 40 seconds.

Today the step is read from the branch's latest commit, as the [git](/specs/decisions/git.md)
decision asks: "A branch's step SHOULD be read from its latest commit." Until the commit lands,
every view but the composer still shows the spec waiting for you. If the server stops first, the
approval stays uncommitted, and the card says "Needs you" until someone commits. The UI behaviour
decision asks that "a write MUST show its result at once". More in
[discovery](discovery-01.md#after-the-humans-write).

Why it matters: A and C change the git decision; the step stays recoverable from the repository
either way.

- **A (recommended). The step moves at once, from Uraeda's own write waiting to be committed, and
  moves back if the commit is refused. Edits made outside Uraeda still move it only once
  committed.**
  - Example: "Leader key" reads "Approval" the moment you approve, while the toast shows the commit
    landing.
  - [pro] your action shows at once, as the UI behaviour decision asks.
  - [con] the git decision gains a case where the step is not the commit's.
  - Why recommended: a commit you made and that is landing is not a guess, and a refusal already
    puts back what the page showed.
- **B. The step still moves only once the commit lands, and the card shows the approval landing
  meanwhile.**
  - Example: "Leader key" reads "Needs you · approving…" for 40 seconds, then "Approval".
  - [pro] the git decision stays as it is.
  - [con] 40 seconds in Needs you for something you already did.
- **C. The step is read from each worktree's files, saved or committed.**
  - Example: "Leader key" moves at once; so does a status you edit by hand in your editor.
  - [pro] manual edits show at once too.
  - [con] reverses the git decision, which dropped this for showing gates not committed yet.

**Answer:**

## Q5: How should a plan's progress read while its tasks are built in parallel?

Example: the plan has 20 tasks. Tasks 13 to 16 are built at the same time, each on its own task
branch. Tasks 14 and 15 are done and wait for 13 to be merged first.

Today progress is the first task with unchecked boxes on the feature branch: "task 13", for the
whole wave. Task branches stay local, so the core can read them. More in
[discovery](discovery-01.md#progress-in-waves).

Why it matters: progress is the one number on a working feature's card.

- **A (recommended). The tasks done, counting those done on their task branches: "14 of 20 done".**
  - Example: 12 merged plus 14 and 15 done on their branches: "14 of 20 done".
  - [pro] it moves as each task ends, whatever the merge order.
  - [con] it no longer names the task in progress.
  - Why recommended: it always moves forward, and needs no notion of a current task.
- **B. The range of tasks in flight: "tasks 13–16 of 20".**
  - Example: "tasks 13–16 of 20" until the wave is merged.
  - [pro] shows what the agents are on.
  - [con] does not move while the wave builds.
- **C. The first unchecked task on the feature branch, as today.**
  - Example: "task 13" until task 13 is merged.
  - [pro] no change.
  - [con] the symptom of the proposal stays.

**Answer:**

## Q6: Should an open pull request count as ready for your review once the branch has newer commits?

Example: pull request #75 of "Panes size" is open. You restart a session, which commits two fixes
locally and has not pushed them yet.

Today an open pull request is the human gate of the
[step table](/skills/uraeda/SKILL.md#finding-the-next-step), whatever the branch holds after it.
GitHub ties a pull request's checks to its head commit, and `gh` can report that commit. With A, the
skill and `ura next` gain a row. More in [discovery](discovery-01.md#an-open-pull-request).

Why it matters: it changes the workflow's step table, which agents follow without Uraeda.

- **A (recommended). The review waits for you only when the pull request's head is the branch's
  latest commit. Otherwise the step is the agent's: pushing its commits.**
  - Example: "Panes size" reads "Push" while its two fixes are local, then "PR ready" once pushed.
  - [pro] "PR ready" means what you would review is what the branch holds.
  - [con] a step and a row more in the skill.
  - Why recommended: reviewing a pull request that lacks the latest fixes wastes your review.
- **B. An open pull request stays ready for your review, as today.**
  - Example: "Panes size" reads "PR ready" with two fixes unpushed.
  - [pro] the workflow does not change.
  - [con] you may review a pull request missing fixes the agent already made.

**Answer:**

## Q7: Where should the rule of a feature's status be written down?

The rule set by your answers to Q1 to Q3 is read by the sidebar, home, the feature page, and
notifications. Each was written alone, which is how four copies drifted. More in
[discovery](discovery-01.md#rules-and-their-owners).

Why it matters: a decision binds every later feature and is checked in review; a UI guide is read
before changing a view.

- **A (recommended). In the UI guides, in [surfaces](/specs/ui/surfaces.md), with one owner in the
  server's code that every view reads.**
  - [pro] no new decision to approve, and the guide is where views are designed.
  - [con] a guide binds less than a decision.
  - Why recommended: it is how views read, which is the guides' subject, and one owner in the code
    keeps the copies from coming back.
- **B. In a new decision, "Feature status".**
  - [pro] binding on every feature that adds a view or a notification.
  - [con] one more decision to approve, for a rule about how views read.

**Answer:**

## Settled without the human

### Behaviour

- **The banner of a stopped run** names who stopped it: you, or the server. See
  [discovery](discovery-01.md#important-reads).
- **The feature page** shows a running session wherever it is in its Sessions, not only the latest.
  See [discovery](discovery-01.md#important-reads).
- **Home's columns** sort features by the same status as the sidebar, not by the step alone. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **A merged pull request** shows as merged without a manual fetch, by asking `gh` for merged pull
  requests too. See [discovery](discovery-01.md#gh).

### Under the hood

- **One owner of a feature's status**, in the server, sent with each feature; the browser's copy of
  the status ranks goes. See [discovery](discovery-01.md#rules-and-their-owners).
- **The watcher** watches a re-created worktree again. It sends a burst's changes at most 1 second
  after its first event, as VS Code's git extension does. See
  [discovery](discovery-01.md#vs-codes-git-extension).
- **Each symptom gets a test** reproducing it, and the spec lists the tests of replaced behaviour.
  See [discovery](discovery-01.md#likely-changes).
- **The plan starts by reproducing** the approval that stayed "Needs you", in the sandbox, and by
  measuring the watcher's events while an agent works. See
  [discovery](discovery-01.md#worth-it-and-feasibility).

**Notes:**
