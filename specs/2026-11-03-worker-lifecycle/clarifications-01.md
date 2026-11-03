---
status: awaiting-human
---

# Clarifications, round 01: Worker lifecycle

> [!IMPORTANT]
>
> 6 questions and 1 follow-up, about 20 minutes.
>
> - Verdict: worth building, with changes: restarts and usage limits still cost hours, and early
>   stops are mostly fixed. Run options and scheduled jobs are features of their own.
> - The split comes first: it decides whether run options and scheduled jobs wait for later.
> - Resuming after a restart and after a usage limit work together, and set a new rule for how runs
>   resume themselves.
> - A run waiting for a limit's reset changes the feature status decision: today a stopped run
>   always asks for you.
> - Not verified: how Claude Code reports a weekly limit, and how it continues a cut turn in
>   Uraeda's mode. The plan checks them first.
> - Six settled points to check come before the questions, the cap on automatic resumes most of all.

## Context

### Goal

The [proposal](proposal.md) asks that agent runs keep going until the next human gate. Server
restarts, usage limits, background work, and early stops should never need a "Continue" from you. It
also lists scheduled jobs and run options: one session per feature or per step, review and model
settings, global defaults with per-feature overrides.

### Today

From the runner's cache and transcripts, 2026-10-17 to 2026-11-03: 85 runner sessions, 240 turns.

| Problem                   | Since 2026-10-17                                                         |
| ------------------------- | ------------------------------------------------------------------------ |
| Usage limits              | 9 limits, 15 runs stopped, 16 "Continue", about 14.5 h idle after resets |
| Server restarts           | 5 restarts, 7 runs killed, 5 "Continue", one run never resumed           |
| Polling                   | 618 polling calls, about 19 h spent in wait loops                        |
| Lost wakeups              | leader-key idle 3h51, then 51 min, on 2026-10-26                         |
| Early stops before a gate | 2 episodes, none after an auto-approved plan                             |
| "Not logged in"           | none                                                                     |

The server [kills its agents on exit](/packages/server/src/runner/claude.ts) on purpose. At the next
start it marks their runs stopped, and they ask for you until dismissed. A usage limit
[fails the run](/packages/server/src/runner/transcript.ts) like any error. You continue a run only
by typing a message.

The lost wakeups have a cause in the code. An idle agent process closes after 15 minutes
([turns.ts](/packages/server/src/runner/turns.ts)), even when the agent set itself a wakeup for
later.

Claude Code 2.1.317 now has the pieces Uraeda lacks. It can continue a session cut mid-turn. It
reports a usage limit with its reset time as data. It wakes the session when background work ends.

### Scope

Keeping runs going: restarts, usage limits, background work, early stops, and one action to continue
every stopped run. Run options and scheduled jobs depend on the first question.

### Sources

- The runner, under [`packages/server/src/runner/`](/packages/server/src/runner/), and its tests.
- The runner's cache and Claude Code's transcripts, for the evidence above.
- Claude Code's docs on sessions, headless mode, errors, hooks, and environment variables, and its
  open issues.
- Claude Code's background sessions, Vibe Kanban, Claude Squad, CCManager, OpenClaw, Devin, Jules,
  Cline, Roo, Aider, superpowers, and usage-limit resume tools.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **A cap on automatic resumes**: at most 3 in a row without a commit or a message from you. After
  that the run asks for you. Claude Code caps its own at 3, and every compared tool caps them, to
  avoid loops. See [what they have in common](discovery-01.md#what-they-have-in-common).
- **Weekly limits** resume at their reset too, even days later, and the session shows the date.
  Claude Code skips waits past 24 hours, but a run left stopped needs you all the same.
- **A switch for each automatic behaviour**: resuming after a restart, after a limit, and before a
  gate. All are on by default, under Runs in the settings, as the
  [settings](/specs/decisions/settings.md) decision asks of later settings.
- **Continue all** sits at the top of the home page's list of what needs you. It sends each stopped
  run the message of its step, as starting the step does. See
  [the code](discovery-01.md#important-reads).
- **"Not logged in"** stays a failure that asks you to sign in to Claude Code. Uraeda may not touch
  the agent's login ([agents](/specs/decisions/agents.md)). Continue all resumes the runs after.
- **A dismissed run never resumes by itself**: dismissing says you have dealt with it.

## Q1: Should this feature cover only keeping runs going, with run options and scheduled jobs as features of their own?

The proposal holds three subsystems. Keeping runs going covers restarts, limits, background work,
early stops, and Continue all. Run options cover one session per feature or per step, models, and
reviews, with per-feature overrides. Scheduled jobs name no job yet. More in
[discovery](discovery-01.md#the-proposal-holds-three-subsystems).

Keeping runs going alone makes about 5 stories. All three would pass the split rule: past 6 stories,
a spec cannot be approved in one sitting. The settings page already lists run options as planned
rows.

Why it matters: it decides when you get per-step models and session choices, and how long this
feature takes.

- **A (recommended). Build keeping runs going now. Run options become the next feature in Now, with
  their own proposal, and scheduled jobs a proposal in Later until a job is named.**
  - [pro] the hours lost to limits and restarts stop first, in a spec you approve in one sitting.
  - [con] per-step models and the session choice wait one more feature.
  - Why recommended: the evidence puts the cost in limits and restarts, and run options have their
    own products and settings to compare.
- **B. Build all three in this feature.**
  - [pro] one feature for everything about runs.
  - [con] a spec past the split rule. Run options get their own round of questions after this one,
    since their research and choices are separate.

**Answer:**

### Q1.B: Which jobs should run on a schedule?

Only if you picked B in Q1. The proposal says "heartbeat/cron jobs" without a job. OpenClaw's
heartbeat checks every 30 minutes and stays quiet when nothing needs doing. Claude Code's cloud
tasks run a prompt in a fresh clone, at most hourly. More in
[discovery](discovery-01.md#scheduled-jobs-name-no-job).

Why it matters: each job is a run that uses your usage while you are away.

These options combine: A, B, and C can be picked together.

- **A (recommended). The inbox triage and the decisions check, on a schedule you set per
  repository.**
  - [pro] the two rounds that need no feature run themselves.
  - [con] a run while you sleep spends usage you may want for features.
  - Why recommended: they are the only runs started without a feature today.
- **B. A check for new comments on open pull requests, which starts the comments pass.**
  - [pro] review comments get addressed without a message from you.
  - [con] needs `gh` and a check every few minutes.
- **C. A prompt of your own, on a schedule, in a repository's main checkout.**
  - [pro] covers any job.
  - [con] a run on the default branch, outside any feature.

**Answer:**

## Q2: How should a run survive a server restart?

Example: you restart Uraeda while "move-relinks" is 1h40 into its plan, with a subagent working.
Today the run is killed, asks for you, and you type "Continue".

Claude Code can continue a session cut mid-turn from its transcript. A tool call cut short is not
rerun, and background agents that died show as notes. Claude Code's own background sessions use a
supervisor process instead. It keeps agents alive, but cannot stream their events as Uraeda reads
them. More in [discovery](discovery-01.md#surviving-a-restart).

Why it matters: it sets how much a restart loses, and how much of the runner changes.

- **A (recommended). Stop agents with the server. At the next start, continue each run cut less than
  6 hours ago from its transcript.**
  - Example: move-relinks continues its plan a few seconds after the restart. Its subagent's work is
    redone, and the session says "Resumed after the server restarted".
  - [pro] a small change in the runner, built on a documented Claude Code feature.
  - [con] a cut tool call and background agents are redone.
  - Why recommended: it removes the "Continue" for the least work, and agents keep stopping cleanly
    with the server.
- **B. Let agents outlive the server, and reattach to them at the next start.**
  - Example: move-relinks never notices the restart, and its subagent finishes.
  - [pro] nothing is lost or redone.
  - [con] a large change: agents talk through files instead of pipes. How Claude Code behaves
    without its parent is undocumented, with reports of orphans spinning at full CPU.
- **C. Resume nothing by itself: Continue all continues every cut run in one action.**
  - Example: move-relinks waits, asking for you, until you press Continue all.
  - [pro] nothing runs without you.
  - [con] the run waits for you: on 2026-11-01 it was never resumed.

**Answer:**

## Q3: What should happen when a run hits a usage limit?

Example: at 23:01 two features hit "You've hit your session limit · resets 8:40am". Today both runs
fail, and you type "Continue" in each after 8:40.

Claude Code waits out a limit by itself only in its interactive mode, never in `-p` mode, which
Uraeda uses. It has a retry setting that waits inside the process. An open issue says that setting
fails for subscriptions without extra usage. More in
[discovery](discovery-01.md#waiting-out-a-usage-limit).

Why it matters: limits caused most of the lost time, about 14.5 hours in 18 days, mostly overnight.

- **A (recommended). Uraeda stores the reset time, and continues the session itself at the reset,
  even after a restart in between.**
  - Example: at 8:41 both runs continue, a minute apart. Each session says "Resumed after the usage
    limit reset".
  - [pro] visible in the session with its time, and kept across restarts.
  - [con] Uraeda reads Claude Code's limit events, which can change between versions.
  - Why recommended: it removes the overnight idle, and you see when each run will go on.
- **B. Let Claude Code's retry setting wait inside the process until the reset.**
  - Example: at 8:40 both runs continue on their own; the sessions show "retrying" lines meanwhile.
  - [pro] almost no code in Uraeda.
  - [con] a restart during the wait loses it, and the open issue may apply to your plan.
- **C. Show the reset time, and leave the continuing to you.**
  - Example: both runs say "Usage limit, resets 8:40am", and wait for you.
  - [pro] nothing runs while you are away.
  - [con] keeps the "Continue" this feature exists to remove.

**Answer:**

## Q4: Should a run waiting to continue by itself ask for you?

Only matters if a run continues by itself, after a restart or a limit (A in Q2 or Q3).

Example: a run waits for the 8:40 reset. Today a stopped run reads "Needs attention", notifies you,
and counts in the tab's title.

The [feature status](/specs/decisions/feature-status.md) decision says "A failed or stopped run MUST
ask for the human until they dismiss it". The [notifications](/specs/decisions/notifications.md)
decision says a notification always means an ask. More in
[discovery](discovery-01.md#status-while-waiting).

Why it matters: it decides whether limits and restarts still notify you, and changes a decision.

- **A (recommended). It reads "Waiting until 8:40", neither working nor needing you, and never
  notifies. It asks for you only if it fails, or after the cap on resumes.**
  - [pro] a notification still always means you have something to do.
  - [con] the feature status decision gains a case where a stopped run does not ask.
  - Why recommended: a run that will go on by itself has no ask, as the notifications decision
    defines one.
- **B. It asks for you, as today, until it continues.**
  - [pro] no decision changes, and you always know a run stopped.
  - [con] a notification for each limit, with nothing for you to do.

**Answer:**

## Q5: What should happen when a run stops before the next human gate?

Example: on 2026-10-26 leader-key ended its turn saying "PR not open yet, nothing needs your
decision". It sat idle for 3h51 until you asked.

The runner already detects such a stop: it reads "Needs attention" as halted. Since 2026-10-17 it
happened twice, and never after an auto-approved plan. More in
[discovery](discovery-01.md#early-stops-are-mostly-fixed).

Why it matters: it decides whether Uraeda sends a message to an agent without you.

- **A (recommended). Send the run one automatic "continue to the next human gate". If it stops
  again, it asks for you.**
  - Example: leader-key gets the message at once, and opens its pull request.
  - [pro] the stop costs minutes, not hours, from a state the runner already detects.
  - [con] Uraeda writes a message to the agent in your place, once.
  - Why recommended: the skill already says a run goes on to the next gate, so the message only
    repeats the rule.
- **B. A hook in Uraeda's Claude Code plugin refuses the stop, and tells the agent to go on.**
  - Example: leader-key's turn never ends there.
  - [pro] no turn ends early at all.
  - [con] works only with Claude Code, and the hook must know the step.
- **C. Nothing: you continue it, or press Continue all.**
  - [pro] Uraeda never speaks for you.
  - [con] the two episodes stay.

**Answer:**

## Q6: How should agents wait for their own background work?

Example: an agent runs the tests in the background, then runs `sleep 60` in a loop to check whether
they finished.

The runner already continues a run when background work reports back: it happened 26 times. Yet
agents still polled 618 times, about 19 hours in wait loops. Some started work Claude Code cannot
track, like a shell ending with `&`. The lost wakeups are fixed in any case, since the idle close
waits for them. More in [discovery](discovery-01.md#polling).

Why it matters: a run blocked in a wait loop cannot read your messages, and an untracked task never
reports back.

B comes on top of A.

- **A (recommended). Add a rule to the skill: start background work your agent tracks, end the turn,
  and wait for its notice. Never poll it in loops.**
  - [pro] works with any agent, as the skill must.
  - [con] a rule the agent may still miss.
  - Why recommended: it fixes the cause where every agent reads it, at no cost.
- **B. Also refuse sleep loops and untracked `&` in Uraeda's Claude Code plugin, telling the agent
  the tracked way.**
  - [pro] the agent cannot miss the rule.
  - [con] Claude Code only, and it may refuse a wait that was right, like a pull request's checks.
- **C. Nothing beyond fixing the lost wakeups.**
  - [pro] no change to the skill.
  - [con] the polling stays.

**Answer:**

## Settled without the human

### Behaviour

- **A resumed run says why**, in a line of its session: after a restart, a limit, or a stop before a
  gate. You see what Uraeda did in your place.
- **Stop during a wait cancels the resume**, and the run asks for you as a stopped run does.
- **A message during a wait** goes to the agent at once, and replaces the automatic resume.
- **Two features hitting a limit together** resume a minute apart, so they do not hit it again at
  the same moment.

### Under the hood

- **Pending resumes live in the runner's cache**, with their time, so they survive restarts. The
  [agents](/specs/decisions/agents.md) decision keeps sessions there.
- **The limit is read from Claude Code's `rate_limit_event`**, its `rejected` status and reset time.
  The message's text is the fallback. Without a reset time, the run retries hourly, within the cap.
  See [Claude Code](discovery-01.md#claude-code).
- **The idle close waits for pending wakeups and crons**, not only background tasks. See
  [important reads](discovery-01.md#important-reads).
- **The runner's session module is split first**: it is at 499 lines, one under the project's limit.
  See [important reads](discovery-01.md#important-reads).
- **Resumed runs keep the same flags and permission mode**: no guard changes.

**Notes:**
