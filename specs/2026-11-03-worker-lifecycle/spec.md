---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Worker lifecycle

> [!NOTE]
>
> Approved on 2026-11-03.
>
> - You approve that Uraeda continues runs by itself after a server restart, a session limit's
>   reset, or an early stop. A waiting run reads as in progress, capped and switchable.
> - New decision, run lifecycle: Uraeda may send messages to an agent in your place, and every later
>   agent runtime must support it.
> - Changed decision, feature status: a run waiting to continue no longer asks for you or notifies.
> - Weekly limits and limits on one model family still stop the run and ask for you, as your note
>   asked.
> - Not verified: whether Claude Code reports the limit's reset time before the run fails. The plan
>   checks it first; without it, the run retries hourly within the cap.
> - A restart's continue redoes the cut tool call and any background agents: the agent is told why,
>   not resumed mid-call.
> - Risk tier medium: new columns in the runner's cache and new settings. The plan does not wait for
>   your review.

Agent runs stop for reasons outside the work: Uraeda's server restarting, Claude Code's session
limit, or an agent ending its turn before the next human gate. Each stop then waits for you to type
"Continue", often overnight: about 14.5 hours idle after limits and 7 runs killed by restarts in 18
days. This feature continues those runs by itself, says so in each session, and lets you cap and
turn off each kind of continue. Run options and scheduled jobs became proposals of their own. See
the [proposal](proposal.md), the [discovery](discovery-01.md), and the
[questions](clarifications-01.md).

## Decisions

- **New: [Run lifecycle](../decisions/run-lifecycle.md)**. Uraeda continues a run after a restart, a
  limit's reset, or an early end, says why, stops after the cap you set, and never continues a run
  you stopped.
- **Changed: [Feature status](../decisions/feature-status.md)**. A run waiting to continue by itself
  reads as in progress, with when it goes on, instead of asking for you.

Relied on:

| Decision                                       | What it means for this spec                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Agents](../decisions/agents.md)               | runs continue in the user's own `claude`, with the same permissions; Uraeda never touches its login |
| [Notifications](../decisions/notifications.md) | a notification means an ask: a waiting run never notifies                                           |
| [Settings](../decisions/settings.md)           | the switches and the cap join `[runs]` in the TOML file, and apply at once                          |
| [Code quality](../decisions/code-quality.md)   | the runner's session module, at 499 lines, is split before it grows                                 |
| [Preview](../decisions/preview.md)             | the mockups are stories with the real components                                                    |
| [Testing](../decisions/testing.md)             | the runner's tests reach the agent through the fake adapter                                         |

## User stories

### US1: A run continues after a session limit's reset (P1)

A run hits Claude Code's session limit. It waits, reads as in progress with the reset time, and
continues by itself a minute after the reset.

[Waiting for the reset](/packages/web/src/RunLifecycle.stories.tsx#WaitingForReset)

[Home, with a waiting run](/packages/web/src/RunLifecycle.stories.tsx#Home)

Key scenarios:

1. **Given** a run of "leader-key" at 23:01, **When** Claude Code reports "You've hit your session
   limit · resets 8:40am", **Then** the session shows "Waiting for the usage limit's reset.", and
   home lists it in progress with "waiting for the usage limit, until 8:40".
2. **Given** that wait, **When** it is 8:41, **Then** Uraeda sends the session "The usage limit has
   reset. Continue where you left off.", and the session shows "Continued after the usage limit's
   reset."
3. **Given** "leader-key" and "panes-size" waiting for the same 8:40 reset, **When** it passes,
   **Then** leader-key continues at 8:41 and panes-size at 8:42.

More scenarios:

1. **Given** a wait until 8:40, **When** you send "Skip the review" at 7:00, **Then** the message
   goes at once, and no continue happens at 8:41.
2. **Given** a wait until 8:40, **When** you press Stop, **Then** the wait ends, and the session
   reads "You stopped the agent."
3. **Given** a wait until 8:40, **When** the server restarts at 6:00, **Then** the run still
   continues at 8:41.
4. **Given** a wait until 8:40 and the server down until 9:30, **When** it starts at 9:30, **Then**
   the run continues at once.
5. **Given** a run, **When** Claude Code reports "You've hit your weekly limit · resets Mon
   12:00am", **Then** the run fails and asks for you, as today.

### US2: A run continues after a server restart (P1)

The server restarts while a run works. When it starts again, the run continues from its agent's
session, if it was cut less than 6 hours before.

[The lines a continue leaves](/packages/web/src/RunLifecycle.stories.tsx#ContinuedLines)

Key scenarios:

1. **Given** "move-relinks" 1h40 into its plan, **When** the server restarts, **Then** within 10
   seconds of the start, Uraeda sends "The server restarted while you worked. Continue where you
   left off.", and the session shows "Continued after the server restarted."
2. **Given** a run cut at 01:00, **When** the server starts at 08:00, **Then** the run is not
   continued, and reads "The server stopped the agent." until you act.

More scenarios:

1. **Given** a run cut by the restart whose agent's transcript is gone, **When** the server starts,
   **Then** it is not continued, and asks for you.
2. **Given** two sessions of one feature, the older one cut, **When** the server starts, **Then**
   only the latest session's run continues.

### US3: A run that stops before its gate is asked to go on (P2)

A workflow run ends while its step still waits on the agent. Uraeda asks it once to continue to the
next human gate; a second such stop asks for you.

Key scenarios:

1. **Given** leader-key's run ends saying "PR not open yet", its step still the implementation,
   **When** the turn ends, **Then** Uraeda sends "You stopped before the next human gate. Continue
   to it.", and the session shows "The run stopped before a human gate. Uraeda asked it to continue
   to the next one."
2. **Given** that continue, **When** the run stops before its gate again, **Then** it reads "The
   agent stopped before a human gate." and asks for you.

### US4: You cap and turn off automatic continues (P2)

Under Runs in the settings, three switches turn off each kind of continue, and a number caps the
continues in a row. Past the cap, the run asks for you.

[The Runs settings](/packages/web/src/RunLifecycle.stories.tsx#RunsSection)

[The cap reached](/packages/web/src/RunLifecycle.stories.tsx#CapOnContinues)

Key scenarios:

1. **Given** "Automatic continues in a row" at 3 and a run continued 3 times without a commit or
   your message, **When** it stops a fourth time, **Then** it reads "The agent keeps stopping." and
   asks for you.
2. **Given** a run continued twice, **When** it commits, **Then** its count goes back to 0.
3. **Given** two runs waiting for a reset, **When** you turn off "Continue after a usage limit",
   **Then** both waits end, and both runs ask for you.

### US5: Continue all (P3)

Runs that stopped and ask for you all continue at once from home's Needs you pane: failed, cut,
stopped by you, or stopped before a gate. Before you press it, Continue all shows which runs it
continues.

[Home, with Continue all](/packages/web/src/RunLifecycle.stories.tsx#Home)

[Continue all under the pointer](/packages/web/src/RunLifecycle.stories.tsx#ContinueAllPreview)

Key scenarios:

1. **Given** "move-relinks" failed on "Not logged in · Please run /login" and "panes-size" cut by a
   restart, **When** you sign in to Claude Code and press Continue all, **Then** each gets its
   step's message, as starting the step sends it.
2. **Given** those two runs and "vim-text" whose questions wait for you, **When** the pointer or the
   keyboard's focus is on Continue all, **Then** the two runs are tinted, and every other row of
   home is dimmed, fading in 150 ms.
3. **Given** that preview, **When** you press Continue all, **Then** "vim-text" gets no message.

### US6: Agents wait for their background work without polling (P3)

An agent that starts background work ends its turn and is woken by its notice. A wakeup it set for
later keeps its process open until it fires.

Key scenarios:

1. **Given** an agent that set a wakeup in 25 minutes and ended its turn, **When** 15 minutes pass,
   **Then** its process stays open, and the wakeup fires at 25 minutes.
2. **Given** the skill's implementation step, **When** an agent reads it, **Then** it says to start
   background work its agent tracks, end the turn, and wait for its notice, never polling.

## Replaced behaviour

- **A run cut by a server restart asks for you until dismissed.** Guarded by
  `runner/__tests__/status.test.ts` (a server stop reads interrupted until dismissed), and
  `__tests__/sessions.test.ts` (a running session makes its feature Working everywhere).
- **A usage limit fails the run.** Guarded by `runner/__tests__/sessions.test.ts` (the process exits
  during a turn: it fails with its stderr).
- **A workflow run ending before its gate asks for you at once.** Guarded by
  `runner/__tests__/status.test.ts`, its halted cases.
- **An idle process closes after 15 minutes, a pending wakeup aside.** Guarded by
  `runner/__tests__/sessions.test.ts` (US1.7 and C1: an idle process closes after 15 minutes).

## Architecture

Uraeda stays the one that continues runs: it reads why each run stopped, stores when to continue it
in its cache, and sends the session a message then. A message works with any agent, and is how a run
continues today. Agents keep stopping with the server; outliving it was rejected in the
[discovery](discovery-01.md#surviving-a-restart). The [run lifecycle](../decisions/run-lifecycle.md)
decision holds the rules.

- **The stop reader** reads why a turn ended from Claude Code's events: a session limit with its
  reset time, a weekly or model limit, a login error, or another failure. It owns reading Claude
  Code's limit events, and the limit message's text as the fallback.
- **The continuer**, a new runner module, decides whether and when a stopped run continues. It owns
  the switches, the cap and what resets it, the 6-hour window, the stagger, and the dismiss and Stop
  rules. It stores pending continues in the cache, and arms them again at start.
- **The continue messages** are written in one place, by reason, next to the step messages.
- **The session status** reads a pending continue as working, labelled with its time, and the cap as
  a new attention reason. Every view, notification, and count follows it, as today.
- **The idle close** also waits for an agent's pending one-shot wakeup, read from its tool call.
- **Continue all** is a server action that sends each asking run its step's message, and a button in
  the border of home's Needs you pane.
- **The settings** gain three switches and the cap in the core, and their rows under Runs.
- **The skill** gains the rule on waiting for background work, in its implementation step.
- **The runner's session module** is split first, to make room under the 500-line limit.

Tradeoffs:

- A restart redoes the tool call it cut and any background agent, instead of keeping them alive.
- Uraeda reads Claude Code's limit events, which can change between versions: a best effort, as you
  answered.
- Recurring crons an agent sets do not hold its process open: only one-shot wakeups do.

## Edge cases

| Importance | Situation                                       | What happens                                                     |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| High       | You send a message during a wait                | it goes at once, and the pending continue is dropped             |
| High       | You press Stop during a wait                    | the wait ends; the run reads "You stopped the agent."            |
| High       | You dismissed a run                             | it never continues by itself                                     |
| High       | The limit hits again right after a continue     | the run waits again; the continue counts toward the cap          |
| High       | The server restarts during a wait               | the wait is read back from the cache, and kept                   |
| Normal     | No reset time can be read                       | the run tries again every hour, each try counting toward the cap |
| Normal     | A weekly or model-family limit                  | the run fails and asks for you, with the limit's text            |
| Normal     | "Not logged in"                                 | the run fails and asks for you; Continue all resumes it after    |
| Normal     | A setting is turned off during a wait           | the waits of that kind end, and their runs ask for you           |
| Normal     | Another session of the same worktree is working | the continue queues, as any message does                         |
| Niche      | The agent's transcript is gone after a restart  | the run is not continued, and asks for you                       |
| Niche      | A restart from Vite while developing Uraeda     | the same as any restart                                          |

## Success criteria

- **SC-001** (limit, no message): a run stopped by a session limit continues within 2 minutes of the
  reset, with no message from you.
- **SC-002** (restart, 10 s): a run cut less than 6 hours before continues within 10 seconds of the
  server's start.
- **SC-003** (no notification): a waiting run raises no notification, and no count in the tab's
  title.
- **SC-004** (cap): with the cap at N, the N+1th stop in a row without a commit or a message asks
  for you.
- **SC-005** (wakeup kept): a wakeup set 25 minutes ahead fires before the process closes.
- **SC-006** (one action): Continue all sends one message to each asking run, and none to a gate.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, except
two your notes changed. The cap is a setting, 3 by default. Weekly limits are not continued. Settled
while writing this spec:

- **A continue is a message, not Claude Code's resume of a cut turn**: it works with any agent, and
  with documented behaviour. See [Claude Code](discovery-01.md#claude-code).
- **Only the session limit continues**: a model-family limit, like the Opus limit, stops the run as
  a weekly one does, since switching models is the run options' work.
- **A continue comes a minute after the reset**, then a minute more for each other waiting run, so
  they do not hit the limit together.
- **Progress sets the count back to 0**: a commit on the feature's branch, or a message from you.
- **Continue all** sends each run its step's message, and skips runs waiting on you at a gate or for
  an allowed action.
- **The 6-hour window** follows Claude Code's own limit on resuming old interrupted turns.
- **Turning a setting off** ends its pending waits at once, as the settings decision asks of a
  change.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: new columns in the runner's cache, new settings, and messages sent to agents without
you, but no workflow file changes format.
