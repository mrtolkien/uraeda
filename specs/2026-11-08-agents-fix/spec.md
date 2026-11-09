---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Agents catch up open pull requests with main

> [!NOTE]
>
> Approved on 2026-11-09.
>
> - You approve a new step, "Catch up", for open pull requests behind main. With a switch in
>   Settings › Runs, off by default, Uraeda runs it by itself: rebase, validate, push.
> - Two decisions change: run lifecycle gains catch-ups as an automatic run, and feature status
>   stops calling a pull request behind main ready.
> - With the switch off, every open pull request reads "Catch up" after a merge, until you continue
>   it.
> - "Always trigger it" is read as: main gaining only priorities, inbox, proposals, or notes needs
>   no catch-up, since those never touch a branch.
> - The skill changes: a row of its step table, a catch-up section, and the comments pass catching
>   up first. A conflict needing your choice asks on the pull request, not in a round.
> - A catch-up force-pushes with lease, possibly while you read the pull request on GitHub.
> - Risk tier medium; the plan does not wait for your review.

Merging one pull request leaves the others behind main, and today the human restarts each one's
agent. This feature gives an open pull request behind main a step of its own, "Catch up", whose run
rebases the branch on main, validates it, and pushes it, then waits for review again. With a switch
the human turns on, Uraeda starts that run by itself as soon as it sees main move, without a pull. A
conflict that needs the human's choice stops it, with a comment on the pull request. See the
[proposal](proposal.md), the [discovery](discovery-01.md), and the [answers](clarifications-01.md).

## Decisions

- **Changed: [Run lifecycle](../decisions/run-lifecycle.md)**. An open pull request behind the
  default branch is caught up by itself only when the human turned it on, at most once per tip of
  the default branch. Every automatic run, not only a continue, says why and has its switch.
- **Changed: [Feature status](../decisions/feature-status.md)**. A pull request reads as ready only
  when its branch also holds every change of the default branch beyond its priorities, inbox,
  proposals, and notes.

Relied on:

| Decision                                       | What it means for this spec                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| [Git](../decisions/git.md)                     | The lease push stands as no loss of work; the server itself never pushes          |
| [Agents](../decisions/agents.md)               | The catch-up runs in the feature's session, in its worktree, with its permissions |
| [Settings](../decisions/settings.md)           | One key in `[runs]`, with a flag and an environment variable                      |
| [Notifications](../decisions/notifications.md) | A stopped catch-up notifies; one that ends at the pull request again does not     |
| [Preview](../decisions/preview.md)             | The mockups are stories, over the real components                                 |

## User stories

### US1: An open pull request behind main reads "Catch up" (P1)

After a merge, each other open pull request that main has moved past shows the agent's step, "Catch
up", everywhere a step shows and in `ura next`, instead of "PR ready". Continue, or Continue all,
sends its agent the catch-up.

[Behind main](/packages/web/src/CatchUpMockups.stories.tsx#BehindMain)

Key scenarios:

1. **Given** "Run options" has pull request #116 ready for review, **When** "Codex runtime" is
   merged on GitHub, and the server's fetch sees `origin/main` move, **Then** "Run options" reads
   "Catch up", waiting on the agent, idle.
2. **Given** "Run options" reads "Catch up" with the switch off, **When** you press Continue all,
   **Then** its latest session gets "Catch up with main" as its message.
3. **Given** "Run options" is ready for review, **When** main gains only a line of `PRIORITIES.md`
   and a started feature's `proposal.md`, **Then** it still reads "PR ready".

More scenarios:

1. **Given** "Run options" reads "Catch up", **When** you run `ura next 2026-11-08-run-options`,
   **Then** it prints the step `catch-up` and the reference
   `skills/uraeda/references/implementation.md`.
2. **Given** a change's pull request is behind main, **When** you open its page, **Then** its step
   reads "Catch up", with `skills/uraeda/references/change.md` as its reference.
3. **Given** "Run options" has changes requested and is behind main, **When** the comments pass
   runs, **Then** it catches the branch up first, then addresses the comments.

### US2: The agent catches up by itself, once you turn it on (P1)

With "Catch up open pull requests" on in Settings › Runs, a pull request reaching "Catch up" gets
its run at once, in its feature's latest session. The run rebases on main, follows the skill's
conflict rules, runs the complete validation, and pushes with lease. The pull request then reads
ready again, without notifying you.

[Catching up](/packages/web/src/CatchUpMockups.stories.tsx#CatchingUp)

[The switch, off](/packages/web/src/CatchUpMockups.stories.tsx#RunsSection)

[The session's line](/packages/web/src/CatchUpMockups.stories.tsx#SessionLines)

Key scenarios:

1. **Given** the switch is on and "Run options" has pull request #116 ready, **When** `origin/main`
   moves to "finish(codex-runtime): Codex runtime + model settings", **Then** its session shows
   "Catching up with main, which moved to “finish(codex-runtime): Codex runtime + model settings”."
   and its agent starts.
2. **Given** that catch-up rebased, validated, and pushed, **When** the pull request's head is the
   branch's tip, **Then** "Run options" reads "PR ready", and no notification shows.
3. **Given** the switch is on, **When** `origin/main` stays at the commit a catch-up of "Run
   options" already started for, **Then** no second catch-up starts, server restarts included.

More scenarios:

1. **Given** the switch is off and two pull requests read "Catch up", **When** you turn it on,
   **Then** both catch-ups start at once.
2. **Given** a session of "Run options" is at work, **When** main moves, **Then** the catch-up
   waits, and starts once that turn ends.
3. **Given** main moves again while "Run options" catches up, **When** that catch-up ends behind the
   new tip, **Then** one more catch-up starts, for the new tip.
4. **Given** the switch is off, **When** main moves, **Then** no agent turn starts by itself.

### US3: A conflict that needs your choice asks on the pull request (P2)

When resolving a conflict needs a choice the spec and the decisions do not settle, the agent leaves
the branch as it was, and comments on the pull request. The comment names the conflicting files and
the choice. The feature then asks for you until you answer by requesting changes, or dismiss it.

[Stopped](/packages/web/src/CatchUpMockups.stories.tsx#Stopped)

Key scenarios:

1. **Given** main removed `claudeArgs`, which "Run options" now calls, **When** its catch-up cannot
   keep both without a choice, **Then** the branch's tip is unchanged. Pull request #116 gets a
   comment naming `runner/claude.ts` and the choice.
2. **Given** that stop, **When** you look at the sidebar, **Then** "Run options" is under "Needs
   you", "Needs attention", and its session shows "The catch-up stopped on a conflict.".
3. **Given** that stop, **When** you request changes on #116 with "Drop the model flag", **Then**
   the comments pass catches up following your comment, and pushes.

More scenarios:

1. **Given** main added a decision the branch's code breaks, **When** the catch-up reads it,
   **Then** it stops and comments the same way.

## Replaced behaviour

- **An open, ready pull request reads "PR ready" whatever main gained since.** Guarded by
  `pull_request_rows` and `finishing_rows` in `crates/core/tests/steps.rs`, and
  `an_open_pull_request_and_the_implementation_keep_their_steps` in `crates/core/tests/pulls.rs`.
  They keep their cases, which are not behind main, and gain the behind ones.
- **Continue all sends a message only to runs that ask for you.** Guarded by "US5: Continue all
  sends each stopped run its step's message, and none to a gate" in
  `packages/server/src/__tests__/continue-all.test.ts`, which gains the idle "Catch up" case.
- **A finished turn whose step now waits on the agent reads "The agent stopped before a human
  gate."** At "Catch up", that holds only for a catch-up's own turn: an earlier turn reads idle.
  Guarded by the halted cases of `packages/server/src/runner/__tests__/status.test.ts`.

## Architecture

The rule lives in the workflow, as you chose, so the step table, the core, and `ura next` agree, and
an agent without the server catches up too
([where the rule lives](discovery-01.md#where-the-rule-lives)). The server only starts the step's
run, like the continues, from its own module. Since every pull request behind catches up, not only
the conflicting ones, nothing needs a merge simulated: the core compares the branch with the default
branch's tip ([which pull requests catch up](discovery-01.md#which-pull-requests-catch-up)).

- **The behind rule**, in the core, decides that a branch needs a catch-up. It holds when the branch
  lacks the tip of `origin/<default>`, or of the local default branch without a remote, and the
  commits it lacks change any file but the default branch's own. Those are `PRIORITIES.md`,
  `INBOX.md`, `INBOX-TRIAGE.md`, `DECISIONS-CHECK.md`, `decisions-check/`, `proposals/`, `notes/`,
  and a started folder's `proposal.md`. It owns that list; the skill's prose copies it. Its answer
  is kept by the pair of tips, so a read without a move diffs nothing.
- **The step** `catch-up`, in the core's step table, waits on the agent. It applies to a ready pull
  request: changes requested, a draft, and an unknown state keep their steps. It wins over `push`,
  since the catch-up pushes.
- **The catcher**, a server module beside the continuer, starts each catch-up. With the switch on,
  it sends the step's message to the latest session of each feature or change at `catch-up`. It
  skips one with a session at work, or already caught up for the current tip. It runs on each
  watcher burst, each turn's end, and each change of the switch, and owns "once per tip".
- **The catch-up turn**: the trigger `catch-up`, its work line "Catch up with main", its session
  line, and the tip it started for, stored with the turn.
- **The status** of a feature at `catch-up` reads idle until a catch-up turn ran, and "The catch-up
  stopped on a conflict." when one ended there. A catch-up ending at the pull request again does not
  notify. Continue all sends the idle ones their message.
- **The switch** `catch_up_pull_requests` in `[runs]`, off by default, its flag and variable, and
  its row in Settings › Runs. See [the data model](data-model.md).
- **The skill**: a row in the step tables of `SKILL.md` and the change reference, a section "Catch
  up an open pull request" in the implementation reference, and `catch-up` in `cli.md`. The section
  reuses the final review's catch-up, and replaces the round with a comment on the pull request when
  a conflict needs a choice. The comments pass catches up first when the branch is behind.

Tradeoffs:

- Every open pull request costs an agent run and a complete validation per merge into main, as
  Kodiak's N(N-1)/2 warns: you chose coherence over usage.
- A rebase force-pushes, so a review in progress on GitHub may see its comments marked outdated.
- The behind rule's list of the default branch's own files is a copy the skill and the core both
  hold.

## Edge cases

| Importance | Situation                                                     | What happens                                                                                  |
| ---------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| High       | You push to the branch while its catch-up runs                | The lease refuses the push; the agent pulls with rebase, validates again, and pushes          |
| High       | A conflict needs a choice                                     | The rebase is aborted, the tip unchanged, a comment on the pull request, and the feature asks |
| High       | A catch-up pushes while you review the pull request on GitHub | GitHub shows a force-push; your comments may read outdated                                    |
| Normal     | A session of the feature is at work when main moves           | The catch-up starts once its turn ends                                                        |
| Normal     | Main moves again during a catch-up                            | Once it ends, one more catch-up starts, for the new tip                                       |
| Normal     | You turn the switch off during a catch-up                     | The running one finishes; no new one starts                                                   |
| Normal     | You stop or dismiss a catch-up                                | No other one starts until main moves again, or you continue it                                |
| Normal     | The pull request has changes requested and is behind          | The comments pass catches up first                                                            |
| Normal     | `gh` cannot tell the pull request's state                     | The step stays "PR unknown"; no catch-up                                                      |
| Normal     | The agent is not available, or its usage limit is reached     | The message is refused or waits as any run's; the feature reads "Catch up"                    |
| Niche      | Your local main holds a merge not pushed yet                  | Nothing is caught up until `origin/main` holds it                                             |
| Niche      | The repository has no remote                                  | The local default branch is the one to catch up with                                          |
| Niche      | The server restarts during a catch-up                         | It continues after the restart, as any run does                                               |

## Success criteria

- **SC-001** (no pull needed): a merge on GitHub turns every open pull request behind into "Catch
  up" within one fetch of the server, 5 minutes, without a pull.
- **SC-002** (once per tip): a pull request gets at most one automatic catch-up per tip of the
  default branch, across server restarts.
- **SC-003** (off means off): with the switch off, no turn ever starts by itself because main moved.
- **SC-004** (all or nothing): a catch-up stopped on a conflict leaves the branch's local and remote
  tips as they were.
- **SC-005** (no needless diff): reading the workspace again with no branch or tip moved computes no
  diff for the behind rule.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, with two
changed by your answers. "There is no opt-out per pull request" now has the switch you asked for,
off by default. "The conflict check" is gone: catching up every pull request behind needs no merge
simulated. Settled while writing this spec:

- **The default branch's own files** never trigger a catch-up, reading "always trigger it" as every
  change that can reach a branch. See [the behind rule](#architecture).
- **"Catch up" wins over "Push"**, as the catch-up pushes the branch's commits too.
- **Continue all** includes the pull requests at "Catch up" with no run, as the answer on where the
  rule lives expected.
- **A new decision on main that the branch breaks** asks on the pull request too, like a conflict,
  instead of a round.
- **The once-per-tip record** lives with the catch-up's turn in the session cache. Losing the cache
  at worst catches up once more.
- **The local default branch** is used only without a remote, as the final review's catch-up does.

## Constitution check

| I. Humans in control | II. Git and plain text | III. Asynchronous | IV. Review effort | V. Tools optional |
| -------------------- | ---------------------- | ----------------- | ----------------- | ----------------- |
| ✅                   | ✅                     | ✅                | ✅                | ✅                |

## Risk tier

**Medium**: a new kind of automatic run that pushes without your message, and a new settings key.
